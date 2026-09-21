import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeakingAttemptDetail, SpeakingAttemptSummary } from "../api/speaking";
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

import {
  createSpeakingAttempt,
  deleteSpeakingAttempt,
  listSpeakingAttempts,
} from "../api/speaking";

const ieltsTalk: SpeakingAttemptSummary = {
  id: "s1",
  level: "B1",
  scale: "ielts",
  rawRating: null,
  estimatedScaled: null,
  cefrEstimate: null,
  band: 5.5,
  durationMs: 90_000,
  startedAt: "2026-08-25T10:00:00.000Z",
  submittedAt: "2026-08-25T10:05:00.000Z",
  revisionCount: 0,
  latestBand: null,
};

const ieltsWithRevisions: SpeakingAttemptSummary = {
  ...ieltsTalk,
  id: "s2",
  revisionCount: 2,
  latestBand: 6.5,
};

const toeicTalk: SpeakingAttemptSummary = {
  id: "s-toeic",
  level: "TOEIC",
  taskType: "express-opinion",
  scale: "toeic",
  rawRating: 4,
  estimatedScaled: 160,
  cefrEstimate: "B2",
  band: null,
  durationMs: 60_000,
  startedAt: "2026-08-26T10:00:00.000Z",
  submittedAt: "2026-08-26T10:05:00.000Z",
  revisionCount: 0,
  latestBand: null,
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
    vi.mocked(createSpeakingAttempt).mockReset();
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
    expect(screen.queryByText(/Pick a level/i)).toBeNull();
  });

  it("offers speaking task types instead of a CEFR level picker", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("group", { name: "Task" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Express an opinion" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Level" })).toBeNull();
    expect(screen.queryByRole("button", { name: "A2" })).toBeNull();
    expect(screen.queryByRole("button", { name: "C1" })).toBeNull();
  });

  it("starts an express-opinion talk with the selected task type", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([]);
    vi.mocked(createSpeakingAttempt).mockResolvedValue({
      id: "new-s",
    } as SpeakingAttemptDetail);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Express an opinion" }));
    fireEvent.click(screen.getByRole("button", { name: /Start speaking/i }));

    await waitFor(() =>
      expect(createSpeakingAttempt).toHaveBeenCalledWith({ taskType: "express-opinion" }),
    );
  });

  it("marks IELTS talks as Legacy and keeps the band stamp", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([ieltsTalk]);
    renderPage();

    expect(await screen.findByText("Legacy")).toBeTruthy();
    expect(screen.getByText(/Band 5\.5/)).toBeTruthy();
  });

  it("keeps IELTS rows off the TOEIC practice-score chart", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([toeicTalk, ieltsTalk]);
    renderPage();

    expect(await screen.findByText("160")).toBeTruthy();
    expect(screen.getByText("Legacy")).toBeTruthy();
    const chart = screen.getByRole("img", { name: /scored attempt/i });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
  });

  it("shows a chain summary when revisions exist", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([ieltsWithRevisions]);
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
    expect(screen.getByRole("link", { name: "Writing" }).getAttribute("href")).toBe("/writing");
  });

  it("sits the catalog on the desk plate", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Speaking" })).toBeTruthy();
    expect(document.querySelector(".speaking-desk")).toBeTruthy();
    expect(document.querySelector(".speaking-sheet")).toBeTruthy();
    expect(document.querySelector("[data-atmosphere='speaking']")).toBeTruthy();
  });

  it("asks before deleting a talk and cancels without calling the API", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([ieltsTalk]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this talk" }));
    expect(screen.getByRole("dialog", { name: "Delete this talk?" })).toBeTruthy();
    expect(screen.getByText(/permanently delete this talk and any re-recordings/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteSpeakingAttempt).not.toHaveBeenCalled();
  });

  it("deletes a talk after confirming", async () => {
    vi.mocked(listSpeakingAttempts).mockResolvedValue([ieltsTalk]);
    vi.mocked(deleteSpeakingAttempt).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this talk" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSpeakingAttempt).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
