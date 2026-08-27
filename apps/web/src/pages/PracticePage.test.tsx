import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
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
  };
});

vi.mock("../api/auth-store", () => ({
  useAuthStore: () => ({ user: { id: "u1", email: "a@b.c" }, clearSession: vi.fn() }),
}));

import { listAttempts } from "../api/practice";

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
  });

  afterEach(() => {
    cleanup();
  });

  it("shows BandStamp when a paper has no revisions", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    expect(await screen.findByText(/Band 5\.5/)).toBeTruthy();
    expect(screen.queryByText(/lần sửa/)).toBeNull();
  });

  it("shows chain summary when a paper has revisions", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootWithRevisions]);
    renderPage();

    expect(await screen.findByText("5.5 → 6.5 · 2 lần sửa")).toBeTruthy();
  });
});
