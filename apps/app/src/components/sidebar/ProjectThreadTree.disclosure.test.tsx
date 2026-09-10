// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ThreadListEntry } from "@bb/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@bb/shared-ui/tooltip";
import { Provider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildSidebarEntitySectionId } from "@bb/client-core";
import {
  ChronologicalSectionThreadSections,
  ProjectThreadTree,
} from "./ProjectRow";
import { makeThreadListEntry } from "@bb/test-helpers/domain-fixtures";

vi.mock("@/hooks/useThreadSplitsEnabled", () => ({
  useThreadSplitsEnabled: () => false,
}));

vi.mock("@/hooks/usePromptDraftStorage", () => ({
  usePromptDraftHasInput: () => false,
  usePromptDraftInputThreadIds: () => new Set(),
}));

vi.mock("@/components/thread/ThreadActionsProvider", () => ({
  useThreadActions: () => ({
    renameThread: vi.fn(),
    requestRename: vi.fn(),
    requestDelete: vi.fn(),
    archiveThreadAndChildren: vi.fn(),
    unarchiveThread: vi.fn(),
    togglePin: vi.fn(),
    toggleRead: vi.fn(),
  }),
}));

function makePlainThreads(count: number): ThreadListEntry[] {
  return Array.from({ length: count }, (_, index) =>
    makeThreadListEntry({
      id: `thr_item_${index}`,
      title: `Thread ${index}`,
      titleFallback: `Thread ${index}`,
      createdAt: index,
      updatedAt: index,
    }),
  );
}

function renderThreadTree(
  threads: ThreadListEntry[],
  {
    progressiveDisclosureEnabled = true,
    selectedThreadId,
    mode = "project",
    looseThreadIds = new Set<string>(),
  }: {
    mode?: "project" | "manual-loose" | "manual-section";
    looseThreadIds?: ReadonlySet<string>;
    progressiveDisclosureEnabled?: boolean;
    selectedThreadId?: string;
  } = {},
) {
  const store = createStore();
  const queryClient = new QueryClient();
  const tree = (entries: ThreadListEntry[]) => (
    <TooltipProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            {mode === "project" ? (
              <ProjectThreadTree
                threadListState={{ status: "ready", threads: entries }}
                progressiveDisclosureEnabled={progressiveDisclosureEnabled}
                compareThreads={() => 0}
                selectedThreadId={selectedThreadId}
                collapsedThreadIds={new Set()}
                collapsedEnvironmentIds={new Set()}
                variant="section"
                onToggleThreadCollapsed={vi.fn()}
                onToggleEnvironmentCollapsed={vi.fn()}
              />
            ) : (
              <ChronologicalSectionThreadSections
                progressiveDisclosureEnabled={progressiveDisclosureEnabled}
                threadListState={{
                  status: "ready",
                  threads: entries.map((thread) => ({
                    ...thread,
                    sectionId:
                      mode === "manual-section" &&
                      !looseThreadIds.has(thread.id)
                        ? "sec_test"
                        : null,
                  })),
                }}
                compareThreads={() => 0}
                sections={
                  mode === "manual-section"
                    ? [{ id: "sec_test", name: "Custom" }]
                    : []
                }
                selectedThreadId={selectedThreadId}
                collapsedThreadIds={new Set()}
                collapsedEnvironmentIds={new Set()}
                onToggleThreadCollapsed={vi.fn()}
                onToggleEnvironmentCollapsed={vi.fn()}
                topLevelSectionOrder={
                  mode === "manual-section"
                    ? [
                        buildSidebarEntitySectionId("section", "sec_test"),
                        "threads",
                      ]
                    : ["threads"]
                }
                onTopLevelSectionOrderChange={vi.fn()}
                pinnedReorderPending={false}
                pinnedThreads={[]}
                onReorderPinnedThread={vi.fn()}
                renderThreadsSection={(content) => content}
              />
            )}
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    </TooltipProvider>
  );
  const view = render(tree(threads));
  return {
    ...view,
    rerenderThreads: (entries: ThreadListEntry[]) =>
      view.rerender(tree(entries)),
  };
}

const modes = ["project", "manual-loose", "manual-section"] as const;

describe.each(modes)("%s progressive disclosure", (mode) => {
  const renderModeTree: typeof renderThreadTree = (threads, options) =>
    renderThreadTree(threads, { ...options, mode });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the full list when the experiment is disabled", () => {
    renderModeTree(makePlainThreads(7), {
      progressiveDisclosureEnabled: false,
    });

    expect(screen.getByText("Thread 6")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("renders every item without controls when the list fits the attention limit", () => {
    renderModeTree(makePlainThreads(5));

    expect(screen.getByText("Thread 0")).not.toBeNull();
    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps busy threads visible beyond the attention limit", () => {
    const threads = makePlainThreads(7);
    threads[6] = {
      ...threads[6],
      activity: { ...threads[6].activity, activeBackgroundAgentCount: 1 },
    };
    renderModeTree(threads);

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("keeps threads waiting for input visible beyond the attention limit", () => {
    const threads = makePlainThreads(7);
    threads[6] = {
      ...threads[6],
      hasPendingInteraction: true,
      runtime: { displayStatus: "idle", hostReconnectGraceExpiresAt: null },
    };
    renderModeTree(threads);

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("keeps unread finished threads visible beyond the attention limit", () => {
    const threads = makePlainThreads(7);
    threads[6] = {
      ...threads[6],
      lastReadAt: 100,
      latestAttentionAt: 200,
    };
    renderModeTree(threads);

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("keeps the selected thread visible beyond the attention limit", () => {
    renderModeTree(makePlainThreads(7), { selectedThreadId: "thr_item_6" });

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("reveals ten more items per Show more click and hides the button when exhausted", () => {
    renderModeTree(makePlainThreads(17));

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    const showMoreButton = screen.getByRole("button", { name: "Show more" });

    fireEvent.click(showMoreButton);
    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();
    expect(screen.getByRole("button", { name: "Show more" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show less" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 16")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("does not spend Show more slots on attention items", () => {
    const threads = makePlainThreads(18);
    for (let index = 5; index <= 14; index += 1) {
      threads[index] = {
        ...threads[index],
        lastReadAt: 100,
        latestAttentionAt: 200,
      };
    }
    renderModeTree(threads);

    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 15")).not.toBeNull();
    expect(screen.getByText("Thread 17")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
  it("retains revealed groups when attention clears or the list is reordered", () => {
    const threads = makePlainThreads(17);
    threads[5] = { ...threads[5], hasPendingInteraction: true };
    const { rerenderThreads } = renderModeTree(threads);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 15")).not.toBeNull();

    const readThreads = threads.map((thread) => ({
      ...thread,
      hasPendingInteraction: false,
    }));
    rerenderThreads(readThreads);
    expect(screen.getByText("Thread 15")).not.toBeNull();
    expect(screen.queryByText("Thread 16")).toBeNull();

    rerenderThreads([...readThreads].reverse());
    expect(screen.getByText("Thread 0")).not.toBeNull();
    expect(screen.getByText("Thread 5")).not.toBeNull();
    expect(screen.getByText("Thread 15")).not.toBeNull();
  });

  it("focuses the first newly revealed thread for each keyboard expansion", () => {
    renderModeTree(makePlainThreads(17));
    const showMore = screen.getByRole("button", { name: "Show more" });
    showMore.focus();
    fireEvent.click(showMore, { detail: 0 });
    expect(document.activeElement?.getAttribute("data-sidebar-thread-id")).toBe(
      "thr_item_5",
    );

    showMore.focus();
    fireEvent.click(showMore, { detail: 0 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(document.activeElement?.getAttribute("data-sidebar-thread-id")).toBe(
      "thr_item_15",
    );
  });

  it("does not move focus into the list for pointer expansion", () => {
    renderModeTree(makePlainThreads(17));
    const showMore = screen.getByRole("button", { name: "Show more" });
    showMore.focus();
    fireEvent.click(showMore, { detail: 1 });
    expect(document.activeElement).toBe(showMore);
  });

  it("keeps a parent group visible when a nested thread needs attention", () => {
    const threads = makePlainThreads(8);
    threads[7] = {
      ...threads[7],
      parentThreadId: threads[6].id,
      hasPendingInteraction: true,
    };
    renderModeTree(threads);
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
    expect(screen.getByText("Thread 7")).not.toBeNull();
  });
});

describe("manual section disclosure isolation", () => {
  afterEach(cleanup);

  it("expands custom sections independently of loose threads", () => {
    const threads = makePlainThreads(34);
    renderThreadTree(threads, {
      mode: "manual-section",
      looseThreadIds: new Set(threads.slice(17).map((thread) => thread.id)),
    });

    expect(screen.getAllByRole("button", { name: "Show more" })).toHaveLength(
      2,
    );
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.queryByText("Thread 22")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Show more" })[0]);
    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();
    expect(screen.queryByText("Thread 22")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Custom section" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Expand Custom section" }),
    );
    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Show more" })[1]);
    expect(screen.getByText("Thread 31")).not.toBeNull();
    expect(screen.queryByText("Thread 32")).toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();
  });
});
