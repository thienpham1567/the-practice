import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeAttemptSummary } from "../api/practice";
import { PracticePage } from "./PracticePage";

vi.mock("../api/practice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/practice")>();
  return {
    ...actual,
    listAttempts: vi.fn(),
    createAttempt: vi.fn(),
    deleteAttempt: vi.fn(),
  };
});

vi.mock("../api/auth-store", () => ({
  useAuthStore: () => ({ user: { id: "u1", email: "a@b.c" }, clearSession: vi.fn() }),
}));

import { deleteAttempt, listAttempts } from "../api/practice";

const rootNoRevisions: PracticeAttemptSummary = {
  id: "root-1",
  level: "B1",
  taskType: "email",
  band: 5.5,
  wordCount: 100,
  hintsOpened: false,
  startedAt: "2026-08-25T10:00:00.000Z",
  submittedAt: "2026-08-25T10:20:00.000Z",
  elapsedSeconds: 1200,
  revisionCount: 0,
  latestBand: null,
};

const rootWithRevisions: PracticeAttemptSummary = {
  ...rootNoRevisions,
  id: "root-2",
  band: 5.5,
  revisionCount: 2,
  latestBand: 6.5,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PracticePage papers list", () => {
  beforeEach(() => {
    vi.mocked(listAttempts).mockReset();
    vi.mocked(deleteAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows BandStamp when a paper has no revisions", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    expect(await screen.findByText(/Band 5\.5/)).toBeTruthy();
    expect(screen.queryByText(/revision/)).toBeNull();
  });

  it("shows which level the paper's band was earned on", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    expect(await screen.findByText("B1 task")).toBeTruthy();
  });

  it("links to the progress page", async () => {
    vi.mocked(listAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("link", { name: "Progress" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Progress" }).getAttribute("href")).toBe(
      "/progress",
    );
  });

  it("links to speaking practice", async () => {
    vi.mocked(listAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("link", { name: "Speaking" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Speaking" }).getAttribute("href")).toBe("/speaking");
  });

  it("shows chain summary when a paper has revisions", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootWithRevisions]);
    renderPage();

    expect(await screen.findByText("5.5 → 6.5 · 2 revisions")).toBeTruthy();
  });

  it("asks before deleting a paper and cancels without calling the API", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this paper" }));
    expect(screen.getByRole("dialog", { name: "Delete this paper?" })).toBeTruthy();
    expect(screen.getByText(/permanently delete this paper and any revisions/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAttempt).not.toHaveBeenCalled();
  });

  it("deletes a paper after confirming", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    vi.mocked(deleteAttempt).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this paper" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAttempt).toHaveBeenCalledWith("root-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
