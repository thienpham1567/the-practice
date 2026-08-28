import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeakingAttemptSummary } from "../api/speaking";
import { SpeakingPage } from "./SpeakingPage";

vi.mock("../api/speaking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/speaking")>();
  return {
    ...actual,
    listSpeakingAttempts: vi.fn(),
    createSpeakingAttempt: vi.fn(),
    deleteSpeakingAttempt: vi.fn(),
  };
});

vi.mock("../api/auth-store", () => ({
  useAuthStore: () => ({ user: { id: "u1", email: "a@b.c" }, clearSession: vi.fn() }),
}));

import { deleteSpeakingAttempt, listSpeakingAttempts } from "../api/speaking";

const rootNoRevisions: SpeakingAttemptSummary = {
  id: "s1",
  level: "B1",
  band: 5.5,
  durationMs: 90_000,
  startedAt: "2026-08-25T10:00:00.000Z",
  submittedAt: "2026-08-25T10:05:00.000Z",
  revisionCount: 0,
  latestBand: null,
};

const rootWithRevisions: SpeakingAttemptSummary = {
  ...rootNoRevisions,
  id: "s2",
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
        <SpeakingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SpeakingPage", () => {
  beforeEach(() => {
    vi.mocked(listSpeakingAttempts).mockReset();
    vi.mocked(deleteSpeakingAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty state when there are no attempts", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/Nothing here yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start speaking/i })).toBeTruthy();
  });

  it("lists past attempts with band stamps", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    expect(await screen.findByText(/Band 5\.5/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /B1/i })).toBeTruthy();
  });

  it("shows a chain summary when revisions exist", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([rootWithRevisions]);
    renderPage();

    expect(await screen.findByText("5.5 → 6.5 · 2 revisions")).toBeTruthy();
  });

  it("shows an error when the list fails to load", async () => {
    vi.mocked(listSpeakingAttempts).mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText(/Could not load your talks/i)).toBeTruthy();
  });

  it("links to writing practice", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("link", { name: "Writing" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Writing" }).getAttribute("href")).toBe("/practice");
  });

  it("asks before deleting a talk and cancels without calling the API", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this talk" }));
    expect(screen.getByRole("dialog", { name: "Delete this talk?" })).toBeTruthy();
    expect(screen.getByText(/permanently delete this talk and any re-recordings/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteSpeakingAttempt).not.toHaveBeenCalled();
  });

  it("deletes a talk after confirming", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([rootNoRevisions]);
    vi.mocked(deleteSpeakingAttempt).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this talk" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSpeakingAttempt).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
