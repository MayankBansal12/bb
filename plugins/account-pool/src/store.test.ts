import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import Database from "better-sqlite3";
import type { PluginKvStorage } from "@get-bb/plugin-sdk";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Account } from "./contracts.js";
import { AccountStore, QUOTA_MIGRATIONS, QuotaStore } from "./store.js";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

function delayedAccountReads(kv: PluginKvStorage): PluginKvStorage {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const value = await kv.get<T>(key);
      if (key === "accounts:v1") {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return value;
    },
    set: (key, value) => kv.set(key, value),
    delete: (key) => kv.delete(key),
    list: (prefix) => kv.list(prefix),
  };
}

describe("AccountStore", () => {
  const oauthInput = {
    provider: "claude",
    kind: "oauth",
    label: "original",
    email: null,
    accountUuid: null,
    subscriptionType: null,
    rateLimitTier: null,
    enabled: false,
    priority: 7,
  } as const;
  const secret = {
    kind: "oauth" as const,
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: null,
  };
  let host: ReturnType<typeof createFakePluginHost>;
  let store: AccountStore;
  let secretsDir: string;

  beforeEach(async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "bb-account-store-"));
    host = createFakePluginHost({ pluginId: "account-pool", dataDir });
    secretsDir = path.join(dataDir, "secrets");
    store = new AccountStore(host.bb.storage.kv, secretsDir);
    cleanups.push(async () => {
      await host.harness.lifecycle.dispose();
      await fs.rm(dataDir, { recursive: true, force: true });
    });
  });

  it("loads account metadata written before account UUIDs were stored", async () => {
    await host.bb.storage.kv.set("accounts:v1", [
      {
        id: "11111111-1111-4111-8111-111111111111",
        provider: "claude",
        kind: "oauth",
        label: "existing",
        email: null,
        subscriptionType: null,
        rateLimitTier: null,
        enabled: true,
        priority: 100,
        createdAt: 1,
      },
    ]);

    expect(await store.list()).toEqual([
      expect.objectContaining({ accountUuid: null }),
    ]);
  });

  it.each([
    { provider: "claude", accountUuid: "11111111-1111-4111-8111-111111111111" },
    { provider: "codex", codexAccountId: "chatgpt-account" },
    { provider: "claude", email: "person@example.com" },
    { provider: "claude" },
  ] as const)(
    "rejects concurrent duplicate OAuth imports: %j",
    async (identity) => {
      store = new AccountStore(
        delayedAccountReads(host.bb.storage.kv),
        secretsDir,
      );
      const input = { ...oauthInput, ...identity };
      const results = await Promise.allSettled([
        store.add(input, secret),
        store.add(
          { ...input, label: "duplicate", enabled: true, priority: 100 },
          "email" in identity
            ? { ...secret, accessToken: "rotated", refreshToken: "rotated" }
            : secret,
        ),
      ]);
      expect(results.map((result) => result.status)).toEqual([
        "fulfilled",
        "rejected",
      ]);
      expect(results[1]).toMatchObject({
        reason: new Error(
          "This account is already connected. Use the existing account instead.",
        ),
      });
      const accounts = await store.list();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject(input);
      expect(await fs.readdir(secretsDir)).toHaveLength(1);
      expect(await store.readSecret(accounts[0]!.id)).toMatchObject(secret);
    },
  );

  it("uses provider identity across token rotation and keeps different Codex workspaces", async () => {
    const input = {
      ...oauthInput,
      provider: "codex" as const,
      email: "person@example.com",
      codexAccountId: "workspace-1",
    };
    await store.add(input, secret);
    await expect(
      store.add(
        { ...input, email: "changed@example.com" },
        { ...secret, accessToken: "rotated", refreshToken: "rotated-refresh" },
      ),
    ).rejects.toThrow("already connected");
    await store.add({ ...input, codexAccountId: "workspace-2" }, secret);
    await store.add(
      { ...input, provider: "claude", codexAccountId: undefined },
      secret,
    );
    expect(await store.list()).toHaveLength(3);
  });

  it("preserves both accounts added concurrently", async () => {
    store = new AccountStore(
      delayedAccountReads(host.bb.storage.kv),
      secretsDir,
    );
    await store.initialize();
    const account = (
      label: string,
    ): Omit<Account, "id" | "createdAt" | "lastUsedAt" | "lastUsedHostId"> => ({
      ...oauthInput,
      kind: "api-key",
      label,
    });

    const [first, second] = await Promise.all([
      store.add(account("first"), { kind: "api-key", apiKey: "sk-first" }),
      store.add(account("second"), { kind: "api-key", apiKey: "sk-second" }),
    ]);

    expect((await store.list()).map((entry) => entry.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });
});

describe("QuotaStore", () => {
  it("migrates an existing quota table to family observations", () => {
    const database = new Database(":memory:");
    const initial = QUOTA_MIGRATIONS[0];
    const familyMigration = QUOTA_MIGRATIONS[1];
    const windowMigration = QUOTA_MIGRATIONS[2];
    if (
      initial === undefined ||
      familyMigration === undefined ||
      windowMigration === undefined
    ) {
      throw new Error("Expected quota migrations.");
    }
    database.exec(initial);
    database
      .prepare(
        `INSERT INTO account_quota (
          account_id, seven_day_utilization, bucket_exhaustion_json
        ) VALUES (?, ?, ?)`,
      )
      .run(
        "11111111-1111-4111-8111-111111111111",
        0.5,
        '{"7d_oi":4102452000000}',
      );
    database.exec(familyMigration);
    database.exec(windowMigration);
    for (const migration of QUOTA_MIGRATIONS.slice(3)) database.exec(migration);
    const quotas = new QuotaStore(database);

    const migrated = quotas.get("11111111-1111-4111-8111-111111111111");
    expect(migrated.sevenDayUtilization).toBe(0.5);
    expect(migrated.limitWindows).toEqual([]);
    expect(migrated.extraUsage).toBeNull();
    expect(migrated.familyWeekly).toEqual({
      fable: null,
      sonnet: null,
      opus: null,
      haiku: null,
      other: null,
    });
    quotas.put({
      ...migrated,
      familyWeekly: {
        ...migrated.familyWeekly,
        fable: {
          utilization: 1,
          resetAt: 4_102_452_000_000,
          status: "rejected",
          observedAt: 10,
          source: "usage",
        },
      },
    });
    expect(
      quotas.get("11111111-1111-4111-8111-111111111111").familyWeekly.fable,
    ).toMatchObject({ utilization: 1, source: "usage" });
    quotas.put({
      ...migrated,
      limitWindows: [
        {
          slot: "primary",
          windowMinutes: 10_080,
          utilization: 0.48,
          resetAt: 4_102_452_000_000,
          status: "allowed",
          observedAt: 10,
          source: "usage",
        },
      ],
    });
    expect(
      quotas.get("11111111-1111-4111-8111-111111111111").limitWindows,
    ).toEqual([
      {
        slot: "primary",
        windowMinutes: 10_080,
        utilization: 0.48,
        resetAt: 4_102_452_000_000,
        status: "allowed",
        observedAt: 10,
        source: "usage",
      },
    ]);
    database.close();
  });
});
