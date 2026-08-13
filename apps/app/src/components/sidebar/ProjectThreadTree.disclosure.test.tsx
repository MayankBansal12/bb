// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ThreadListEntry } from "@bb/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProjectThreadTree } from "./ProjectRow";
import { makeThreadListEntry } from "@/test/fixtures/thread-list-entries";

vi.mock("@/hooks/useThreadSplitsEnabled", () => ({
  useThreadSplitsEnabled: () => false,
}));

vi.mock("@/hooks/usePromptDraftStorage", () => ({
  usePromptDraftHasInput: () => false,
  usePromptDraftInputThreadIds: () => new Set(),
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
  selectedThreadId?: string,
) {
  return render(
    <MemoryRouter>
      <ProjectThreadTree
        threadListState={{ status: "ready", threads }}
        compareThreads={() => 0}
        selectedThreadId={selectedThreadId}
        collapsedThreadIds={new Set()}
        collapsedEnvironmentIds={new Set()}
        variant="section"
        onToggleThreadCollapsed={vi.fn()}
        onToggleEnvironmentCollapsed={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ProjectThreadTree progressive disclosure", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders every item without controls when the list fits the attention limit", () => {
    renderThreadTree(makePlainThreads(5));

    expect(screen.getByText("Thread 0")).not.toBeNull();
    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse" })).toBeNull();
  });

  it("keeps busy threads visible beyond the attention limit", () => {
    const threads = makePlainThreads(7);
    threads[6] = {
      ...threads[6],
      activity: { ...threads[6].activity, activeBackgroundAgentCount: 1 },
    };
    renderThreadTree(threads);

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
    renderThreadTree(threads);

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("keeps the selected thread visible beyond the attention limit", () => {
    renderThreadTree(makePlainThreads(7), "thr_item_6");

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByText("Thread 6")).not.toBeNull();
  });

  it("reveals ten more items per Show more click and hides the button when exhausted", () => {
    renderThreadTree(makePlainThreads(17));

    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();
    expect(screen.getByRole("button", { name: "Show more" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Collapse" })).not.toBeNull();

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
    renderThreadTree(threads);

    expect(screen.getByText("Thread 14")).not.toBeNull();
    expect(screen.queryByText("Thread 15")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 15")).not.toBeNull();
    expect(screen.getByText("Thread 17")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("collapses back to the attention set", () => {
    renderThreadTree(makePlainThreads(17));

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText("Thread 14")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.getByText("Thread 4")).not.toBeNull();
    expect(screen.queryByText("Thread 5")).toBeNull();
    expect(screen.getByRole("button", { name: "Show more" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse" })).toBeNull();
  });
});
