import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabEntry } from "../api/vocab";
import { VocabPage } from "./VocabPage";

vi.mock("../api/vocab", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/vocab")>();
  return {
    ...actual,
    listVocab: vi.fn(),
  };
});

vi.mock("../api/auth-store", () => ({
  useAuthStore: () => ({ user: { id: "u1", email: "a@b.c" }, clearSession: vi.fn() }),
}));

import { listVocab } from "../api/vocab";

const unused: VocabEntry = {
  id: "1",
  word: "lively",
  meaning: "full of energy",
  example: "The crowd was lively.",
  level: "B1",
  usedCount: 0,
  suggestedCount: 1,
  lastSuggestedAt: "2026-08-20T10:00:00.000Z",
  firstUsedAt: null,
  createdAt: "2026-08-20T10:00:00.000Z",
};

const used: VocabEntry = {
  id: "2",
  word: "commute",
  meaning: "travel to work",
  example: "I commute by bus.",
  level: "B1",
  usedCount: 2,
  suggestedCount: 1,
  lastSuggestedAt: "2026-08-19T10:00:00.000Z",
  firstUsedAt: "2026-08-19T12:00:00.000Z",
  createdAt: "2026-08-19T10:00:00.000Z",
};

const advanced: VocabEntry = {
  id: "3",
  word: "resilient",
  meaning: "able to recover quickly",
  example: "She stayed resilient through the setback.",
  level: "C1",
  usedCount: 0,
  suggestedCount: 1,
  lastSuggestedAt: "2026-08-18T10:00:00.000Z",
  firstUsedAt: null,
  createdAt: "2026-08-18T10:00:00.000Z",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VocabPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VocabPage", () => {
  beforeEach(() => {
    vi.mocked(listVocab).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when the notebook has no words", async () => {
    vi.mocked(listVocab).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nothing here yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start a practice paper" })).toBeTruthy();
  });

  it("sits the notebook on the desk plate", async () => {
    vi.mocked(listVocab).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Vocabulary" })).toBeTruthy();
    expect(document.querySelector(".vocab-desk")).toBeTruthy();
    expect(document.querySelector(".vocab-sheet")).toBeTruthy();
    expect(document.querySelector("[data-atmosphere='vocab']")).toBeTruthy();
  });

  it("lists words with usage badges and filters by status", async () => {
    vi.mocked(listVocab).mockResolvedValue([unused, used]);
    renderPage();

    expect(await screen.findByText("lively")).toBeTruthy();
    expect(screen.getByText("commute")).toBeTruthy();
    expect(screen.getByText("unused")).toBeTruthy();
    expect(screen.getByText("used ×2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Unused" }));
    expect(screen.getByText("lively")).toBeTruthy();
    expect(screen.queryByText("commute")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Used" }));
    expect(screen.getByText("commute")).toBeTruthy();
    expect(screen.queryByText("lively")).toBeNull();
  });

  it("filters by word or meaning as the learner types", async () => {
    vi.mocked(listVocab).mockResolvedValue([unused, used, advanced]);
    renderPage();

    expect(await screen.findByText("lively")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "commute" } });
    expect(screen.getByText("commute")).toBeTruthy();
    expect(screen.queryByText("lively")).toBeNull();
    expect(screen.queryByText("resilient")).toBeNull();

    // Matches the meaning too, not just the word itself.
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "recover" } });
    expect(screen.getByText("resilient")).toBeTruthy();
    expect(screen.queryByText("commute")).toBeNull();
  });

  it("filters by level", async () => {
    vi.mocked(listVocab).mockResolvedValue([unused, used, advanced]);
    renderPage();

    expect(await screen.findByText("lively")).toBeTruthy();

    const levelGroup = screen.getByRole("group", { name: "Filter by level" });
    fireEvent.click(within(levelGroup).getByRole("button", { name: "C1" }));

    expect(screen.getByText("resilient")).toBeTruthy();
    expect(screen.queryByText("lively")).toBeNull();
    expect(screen.queryByText("commute")).toBeNull();
  });

  it("says so when search and filters together match nothing", async () => {
    vi.mocked(listVocab).mockResolvedValue([unused, used, advanced]);
    renderPage();

    expect(await screen.findByText("lively")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz" } });

    expect(await screen.findByText("No words match your search or filters.")).toBeTruthy();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(listVocab).mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText(/Could not load your vocabulary/)).toBeTruthy();
  });
});
