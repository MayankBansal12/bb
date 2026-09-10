// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageTimestamp } from "./MessageTimestamp.js";
import { formatMessageTimestamp } from "./message-timestamp.js";

const local = (day: number, hour = 12) =>
  new Date(2026, 8, day, hour).getTime();
const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("message timestamp labels", () => {
  it("shows only the time today", () => {
    expect(formatMessageTimestamp(local(10, 9), local(10))).toBe(
      time(local(10, 9)),
    );
  });

  it("uses the weekday earlier in the current calendar week", () => {
    expect(formatMessageTimestamp(local(9), local(10))).toBe(
      `Wednesday ${time(local(9))}`,
    );
  });

  it("uses a date for Sunday before the current Monday", () => {
    expect(formatMessageTimestamp(local(6), local(7))).toBe(
      `Sep 6, ${time(local(6))}`,
    );
  });

  it("includes the year for messages from a different year", () => {
    const at = new Date(2025, 11, 31, 12).getTime();
    expect(formatMessageTimestamp(at, local(10))).toBe(
      `Dec 31, 2025, ${time(at)}`,
    );
  });

  it("uses a date for future days rather than an earlier-week label", () => {
    expect(formatMessageTimestamp(local(11), local(10))).toBe(
      `Sep 11, ${time(local(11))}`,
    );
  });

  it("keeps the full timestamp accessible and reveals it with message actions", () => {
    const at = local(9, 13);
    const { container } = render(<MessageTimestamp at={at} />);
    const stamp = container.querySelector("time");
    expect(stamp?.getAttribute("datetime")).toBe(new Date(at).toISOString());
    expect(stamp?.title).toContain("2026");
    expect(stamp?.classList.contains("opacity-0")).toBe(true);
    expect(stamp?.classList.contains("group-hover/message:opacity-100")).toBe(
      true,
    );
    expect(
      stamp?.classList.contains("group-focus-within/message:opacity-100"),
    ).toBe(true);
  });
});
