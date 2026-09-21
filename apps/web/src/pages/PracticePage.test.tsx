import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeAttemptDetail, PracticeAttemptSummary } from "../api/practice";
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

import { createAttempt, deleteAttempt, listAttempts } from "../api/practice";

const ieltsPaper: PracticeAttemptSummary = {
  id: "root-1",
  level: "B1",
  taskType: "email-request",
  scale: "ielts",
  rawRating: null,
  estimatedScaled: null,
  cefrEstimate: null,
  band: 5.5,
  wordCount: 100,
  hintsOpened: false,
  startedAt: "2026-08-25T10:00:00.000Z",
  submittedAt: "2026-08-25T10:20:00.000Z",
  elapsedSeconds: 1200,
  revisionCount: 0,
  latestBand: null,
};

const ieltsWithRevisions: PracticeAttemptSummary = {
  ...ieltsPaper,
  id: "root-2",
  revisionCount: 2,
  latestBand: 6.5,
};

const toeicPaper: PracticeAttemptSummary = {
  id: "toeic-1",
  level: "TOEIC",
  taskType: "email-request",
  scale: "toeic",
  rawRating: 4,
  estimatedScaled: 160,
  cefrEstimate: "B2",
  band: null,
  wordCount: 120,
  hintsOpened: false,
  startedAt: "2026-08-26T10:00:00.000Z",
  submittedAt: "2026-08-26T10:20:00.000Z",
  elapsedSeconds: 600,
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
        <PracticePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PracticePage papers list", () => {
  beforeEach(() => {
    vi.mocked(listAttempts).mockReset();
    vi.mocked(createAttempt).mockReset();
    vi.mocked(deleteAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("offers writing task types instead of a CEFR level picker", async () => {
    vi.mocked(listAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("group", { name: "Task" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email response" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Opinion essay" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Level" })).toBeNull();
    expect(screen.queryByRole("button", { name: "A2" })).toBeNull();
    expect(screen.queryByRole("button", { name: "B1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "C1" })).toBeNull();
  });

  it("starts an email-request paper with the selected task type", async () => {
    vi.mocked(listAttempts).mockResolvedValue([]);
    vi.mocked(createAttempt).mockResolvedValue({ id: "new-1" } as PracticeAttemptDetail);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Email response" }));
    fireEvent.click(screen.getByRole("button", { name: /Start writing/i }));

    await waitFor(() =>
      expect(createAttempt).toHaveBeenCalledWith({ taskType: "email-request" }),
    );
  });

  it("marks IELTS papers as Legacy and keeps the band stamp", async () => {
    vi.mocked(listAttempts).mockResolvedValue([ieltsPaper]);
    renderPage();

    expect(await screen.findByText("Legacy")).toBeTruthy();
    expect(screen.getByText(/Band 5\.5/)).toBeTruthy();
  });

  it("keeps IELTS rows off the TOEIC practice-score chart", async () => {
    vi.mocked(listAttempts).mockResolvedValue([toeicPaper, ieltsPaper]);
    renderPage();

    expect(await screen.findByText("160")).toBeTruthy();
    expect(screen.getByText("Legacy")).toBeTruthy();
    const chart = screen.getByRole("img", { name: /scored attempt/i });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
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

  it("sits the catalog on the desk plate", async () => {
    vi.mocked(listAttempts).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Practice" })).toBeTruthy();
    expect(document.querySelector(".practice-desk")).toBeTruthy();
    expect(document.querySelector(".practice-sheet")).toBeTruthy();
    expect(document.querySelector("[data-atmosphere='practice']")).toBeTruthy();
  });

  it("shows chain summary when a paper has revisions", async () => {
    vi.mocked(listAttempts).mockResolvedValue([ieltsWithRevisions]);
    renderPage();

    expect(await screen.findByText("5.5 → 6.5 · 2 revisions")).toBeTruthy();
  });

  it("asks before deleting a paper and cancels without calling the API", async () => {
    vi.mocked(listAttempts).mockResolvedValue([ieltsPaper]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this paper" }));
    expect(screen.getByRole("dialog", { name: "Delete this paper?" })).toBeTruthy();
    expect(screen.getByText(/permanently delete this paper and any revisions/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAttempt).not.toHaveBeenCalled();
  });

  it("deletes a paper after confirming", async () => {
    vi.mocked(listAttempts).mockResolvedValue([ieltsPaper]);
    vi.mocked(deleteAttempt).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this paper" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAttempt).toHaveBeenCalledWith("root-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
