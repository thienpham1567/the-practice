import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeAttemptDetail } from "../api/practice";
import { PracticeAttemptPage } from "./PracticeAttemptPage";

vi.mock("../editor/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

vi.mock("../api/practice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/practice")>();
  return {
    ...actual,
    getAttempt: vi.fn(),
    reviseAttempt: vi.fn(),
  };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

import { getAttempt, reviseAttempt } from "../api/practice";

const gradedAttempt: PracticeAttemptDetail = {
  id: "a1",
  level: "A2",
  taskType: "email",
  band: 5.5,
  wordCount: 100,
  hintsOpened: false,
  startedAt: "2026-08-25T10:00:00.000Z",
  submittedAt: "2026-08-25T10:20:00.000Z",
  elapsedSeconds: 1200,
  prompt: "Write to your teacher.",
  ideas: ["thank them"],
  vocabulary: [{ word: "grateful", meaning: "thankful", example: "I am grateful." }],
  content: null,
  plainText: "Dear teacher, thank you.",
  scores: {
    taskResponse: 5.5,
    coherenceCohesion: 5.5,
    lexicalResource: 5.5,
    grammaticalRange: 5.5,
  },
  feedback: {
    taskResponse: "You answered the task.",
    coherenceCohesion: "Ideas are ordered.",
    lexicalResource: "Vocabulary is adequate.",
    grammaticalRange: "Mostly simple sentences.",
    overview: "A fair A2 email.",
    nextFocus: "Use one complex sentence next time.",
  },
  styleSnapshot: null,
  parentAttemptId: null,
  revisionRound: 0,
  feedbackAudit: null,
  parentBand: null,
  hasRevision: false,
};

function renderPage(attemptId = "a1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/practice/${attemptId}`]}>
        <Routes>
          <Route path="/practice/:id" element={<PracticeAttemptPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PracticeAttemptPage ResultView revise button", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(getAttempt).mockReset();
    vi.mocked(reviseAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows "Revise this paper" when the attempt can be revised', async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedAttempt);
    renderPage();

    expect(await screen.findByRole("button", { name: "Revise this paper" })).toBeTruthy();
  });

  it("hides the revise button when a child revision already exists", async () => {
    vi.mocked(getAttempt).mockResolvedValue({ ...gradedAttempt, hasRevision: true });
    renderPage();

    await screen.findByText("Next time");
    expect(screen.queryByRole("button", { name: "Revise this paper" })).toBeNull();
  });

  it("hides the revise button at revision round 2", async () => {
    vi.mocked(getAttempt).mockResolvedValue({
      ...gradedAttempt,
      revisionRound: 2,
      parentAttemptId: "root",
      parentBand: 5.5,
    });
    renderPage();

    await screen.findByText("Next time");
    expect(screen.queryByRole("button", { name: "Revise this paper" })).toBeNull();
  });

  it("calls reviseAttempt and navigates to the new attempt", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedAttempt);
    vi.mocked(reviseAttempt).mockResolvedValue({ ...gradedAttempt, id: "rev-1", revisionRound: 1 });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Revise this paper" }));

    await waitFor(() => {
      expect(reviseAttempt).toHaveBeenCalledWith("a1");
      expect(navigate).toHaveBeenCalledWith("/practice/rev-1");
    });
  });
});

const revisionAttempt: PracticeAttemptDetail = {
  ...gradedAttempt,
  id: "rev-1",
  band: null,
  submittedAt: null,
  scores: null,
  feedback: null,
  parentAttemptId: "a1",
  revisionRound: 1,
  parentBand: 5.5,
  hasRevision: false,
  startedAt: new Date().toISOString(),
};

describe("PracticeAttemptPage ExamRoom revision", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(getAttempt).mockReset();
    vi.mocked(reviseAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides the countdown and shows Revision 1/2 with parent feedback", async () => {
    vi.mocked(getAttempt).mockImplementation(async (id: string) => {
      if (id === "rev-1") return revisionAttempt;
      if (id === "a1") return gradedAttempt;
      throw new Error(`unexpected id ${id}`);
    });

    renderPage("rev-1");

    expect(await screen.findByText("Revision 1/2")).toBeTruthy();
    expect(screen.queryByLabelText("Time remaining")).toBeNull();
    expect(screen.queryByText(/Time is up/)).toBeNull();

    expect(await screen.findByText("Previous feedback")).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.taskResponse)).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.coherenceCohesion)).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.lexicalResource)).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.grammaticalRange)).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.overview)).toBeTruthy();
    expect(screen.getByText(gradedAttempt.feedback!.nextFocus)).toBeTruthy();
  });

  it("shows Revision 2/2 on the second revision round", async () => {
    const round2 = { ...revisionAttempt, id: "rev-2", revisionRound: 2, parentAttemptId: "rev-1" };
    vi.mocked(getAttempt).mockImplementation(async (id: string) => {
      if (id === "rev-2") return round2;
      if (id === "rev-1") return { ...gradedAttempt, id: "rev-1", revisionRound: 1, parentAttemptId: "a1" };
      throw new Error(`unexpected id ${id}`);
    });

    renderPage("rev-2");

    expect(await screen.findByText("Revision 2/2")).toBeTruthy();
    expect(screen.queryByLabelText("Time remaining")).toBeNull();
  });
});

const gradedRevision: PracticeAttemptDetail = {
  ...gradedAttempt,
  id: "rev-1",
  band: 6.5,
  parentAttemptId: "a1",
  revisionRound: 1,
  parentBand: 5.5,
  hasRevision: false,
  feedbackAudit: [
    { point: "Task address fixed.", status: "resolved" },
    { point: "Cohesion partly improved.", status: "partial" },
    { point: "Grammar still weak.", status: "unresolved" },
  ],
};

describe("PracticeAttemptPage ResultView revision results", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(getAttempt).mockReset();
    vi.mocked(reviseAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows band delta next to the stamp on a revision result", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedRevision);
    renderPage("rev-1");

    expect(await screen.findByText("Band 6.5")).toBeTruthy();
    expect(screen.getByText("5.5 → 6.5")).toBeTruthy();
  });

  it("marks resolved audit points with ✓", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedRevision);
    renderPage("rev-1");

    const item = await screen.findByText(/Task address fixed/);
    expect(item.closest("li")?.textContent).toMatch(/✓/);
    expect(item.closest("li")?.className).not.toMatch(/text-vermilion/);
  });

  it("marks partial audit points with ±", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedRevision);
    renderPage("rev-1");

    const item = await screen.findByText(/Cohesion partly improved/);
    expect(item.closest("li")?.textContent).toMatch(/±/);
  });

  it("marks unresolved audit points with ✗ in vermilion", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedRevision);
    renderPage("rev-1");

    const item = await screen.findByText(/Grammar still weak/);
    expect(item.closest("li")?.textContent).toMatch(/✗/);
    expect(item.closest("li")?.className).toMatch(/text-vermilion/);
  });

  it("shows delta only when feedbackAudit is null", async () => {
    vi.mocked(getAttempt).mockResolvedValue({ ...gradedRevision, feedbackAudit: null });
    renderPage("rev-1");

    expect(await screen.findByText("5.5 → 6.5")).toBeTruthy();
    expect(screen.queryByText(/Task address fixed/)).toBeNull();
    expect(screen.queryByText(/Cohesion partly improved/)).toBeNull();
    expect(screen.queryByText(/Grammar still weak/)).toBeNull();
    expect(screen.queryByText(/✓|±|✗/)).toBeNull();
  });

  it("keeps the revise button available on revision round 1 without a child", async () => {
    vi.mocked(getAttempt).mockResolvedValue(gradedRevision);
    renderPage("rev-1");

    expect(await screen.findByRole("button", { name: "Revise this paper" })).toBeTruthy();
  });
});

const openAttemptWithReview: PracticeAttemptDetail = {
  ...gradedAttempt,
  id: "open-1",
  band: null,
  submittedAt: null,
  scores: null,
  feedback: null,
  styleSnapshot: null,
  vocabulary: [
    { word: "commute", meaning: "travel to work", example: "I commute by bus.", review: true },
    { word: "punctual", meaning: "on time", example: "She is always punctual." },
  ],
};

describe("PracticeAttemptPage PromptPane review chip", () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(getAttempt).mockReset();
    vi.mocked(reviseAttempt).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows "review" only on vocabulary items marked review', async () => {
    vi.mocked(getAttempt).mockResolvedValue(openAttemptWithReview);
    renderPage("open-1");

    fireEvent.click(await screen.findByRole("button", { name: "Show hints" }));

    expect(await screen.findByText("review")).toBeTruthy();
    const commute = screen.getByText("commute").closest("li");
    const punctual = screen.getByText("punctual").closest("li");
    expect(commute?.textContent).toMatch(/review/);
    expect(punctual?.textContent).not.toMatch(/review/);
  });
});
