import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeakingAttemptDetail } from "../api/speaking";
import { SpeakingAttemptPage } from "./SpeakingAttemptPage";

type RecState = "idle" | "recording" | "done" | "error";

const startSpy = vi.fn();
const stopSpy = vi.fn();
const resetSpy = vi.fn();

/** Mutable knobs the tests set before Stop so the mock can finish with chosen PCM. */
const finishConfig = {
  durationMs: 12_000,
  silent: false,
};

vi.mock("../speaking/useRecorder", () => ({
  MAX_RECORDING_MS: 120_000,
  recordingSupported: () => true,
  useRecorder: () => {
    const [state, setState] = useState<RecState>("idle");
    const [pcm, setPcm] = useState(() => new Float32Array(0));
    const [sampleRate, setSampleRate] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [level] = useState(0.4);
    const [errorMessage] = useState<string | null>(null);

    const start = useCallback(async () => {
      startSpy();
      setSampleRate(16_000);
      setDurationMs(0);
      setPcm(new Float32Array(0));
      setState("recording");
    }, []);

    const stop = useCallback(() => {
      stopSpy();
      const samples = Math.max(1, Math.floor((finishConfig.durationMs / 1000) * 16_000));
      const next = new Float32Array(samples);
      if (!finishConfig.silent) {
        for (let i = 0; i < next.length; i++) next[i] = i % 2 === 0 ? 0.2 : -0.2;
      }
      setPcm(next);
      setDurationMs(finishConfig.durationMs);
      setSampleRate(16_000);
      setState("done");
    }, []);

    const reset = useCallback(() => {
      resetSpy();
      setState("idle");
      setPcm(new Float32Array(0));
      setDurationMs(0);
      setSampleRate(0);
    }, []);

    return { state, pcm, sampleRate, durationMs, level, errorMessage, start, stop, reset };
  },
}));

vi.mock("../api/speaking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/speaking")>();
  return {
    ...actual,
    getSpeakingAttempt: vi.fn(),
    submitSpeakingAttempt: vi.fn(),
    reviseSpeakingAttempt: vi.fn(),
  };
});

import { getSpeakingAttempt, reviseSpeakingAttempt, submitSpeakingAttempt } from "../api/speaking";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const openAttempt: SpeakingAttemptDetail = {
  id: "s1",
  level: "B1",
  cueCard: {
    topic: "Describe a memorable journey",
    bullets: ["where you went", "who you went with", "why it was memorable"],
  },
  band: null,
  durationMs: null,
  transcript: null,
  marks: null,
  fluency: null,
  scores: null,
  feedback: null,
  startedAt: "2026-08-28T10:00:00.000Z",
  submittedAt: null,
  parentAttemptId: null,
  revisionRound: 0,
  parentBand: null,
  hasRevision: false,
  pendingRevisionId: null,
};

function renderPage(attemptId = "s1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/speaking/${attemptId}`]}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingAttemptPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SpeakingAttemptPage phases", () => {
  beforeEach(() => {
    startSpy.mockClear();
    stopSpy.mockClear();
    resetSpy.mockClear();
    navigate.mockReset();
    finishConfig.durationMs = 12_000;
    finishConfig.silent = false;
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(submitSpeakingAttempt).mockReset();
    vi.mocked(reviseSpeakingAttempt).mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-audio"),
      revokeObjectURL: vi.fn(),
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows Prep with cue card and can skip the countdown", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();

    expect(await screen.findByText("Describe a memorable journey")).toBeTruthy();
    expect(screen.getByText("where you went")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Skip prep/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Skip prep/i }));

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(startSpy).toHaveBeenCalled();
  });

  it("moves from Prep to Record when the minute ends", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();
    await screen.findByText("Describe a memorable journey");

    for (let i = 0; i < 60; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
  });

  it("enters Review after stop and allows re-record without calling submit", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Skip prep/i }));
    await screen.findByRole("button", { name: /Stop recording/i });

    fireEvent.click(screen.getByRole("button", { name: /Stop recording/i }));

    expect(await screen.findByRole("button", { name: /^Submit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record again/i })).toBeTruthy();
    expect(submitSpeakingAttempt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Record again/i }));
    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(submitSpeakingAttempt).not.toHaveBeenCalled();
  });

  it("keeps Review and audio after submit failure so the user can retry", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    vi.mocked(submitSpeakingAttempt).mockRejectedValue(new Error("marking failed"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Skip prep/i }));
    await screen.findByRole("button", { name: /Stop recording/i });
    fireEvent.click(screen.getByRole("button", { name: /Stop recording/i }));

    fireEvent.click(await screen.findByRole("button", { name: /^Submit$/i }));

    expect(await screen.findByText(/Marking failed/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record again/i })).toBeTruthy();
  });

  it("blocks submit when the clip is too short", async () => {
    finishConfig.durationMs = 5_000;
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Skip prep/i }));
    await screen.findByRole("button", { name: /Stop recording/i });
    fireEvent.click(screen.getByRole("button", { name: /Stop recording/i }));

    fireEvent.click(await screen.findByRole("button", { name: /^Submit$/i }));

    expect(await screen.findByText(/at least 10 seconds/i)).toBeTruthy();
    expect(submitSpeakingAttempt).not.toHaveBeenCalled();
  });

  it("shows Result transcript when the attempt is already graded", async () => {
    vi.useRealTimers();
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      submittedAt: "2026-08-28T10:05:00.000Z",
      band: 6,
      transcript: "I went to Paris um yesterday",
      marks: [{ start: 15, end: 17, kind: "filler", note: "filler word" }],
      fluency: { wordsPerMinute: 110, fillerCount: 1 },
      scores: {
        fluencyCoherence: 6,
        lexicalResource: 6,
        grammaticalRange: 5.5,
        pronunciation: 6,
      },
      feedback: {
        fluencyCoherence: "Steady pace.",
        lexicalResource: "Adequate.",
        grammaticalRange: "Simple forms.",
        pronunciation: "Clear enough.",
        overview: "A fair talk.",
        nextFocus: "Cut fillers.",
      },
    });
    renderPage();

    expect(await screen.findByText(/I went to Paris um yesterday/)).toBeTruthy();
    expect(screen.getByText(/Band 6/)).toBeTruthy();
    expect(screen.getByText(/110 WPM/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record again/i })).toBeTruthy();
  });

  it("hides Record again at revision round 2", async () => {
    vi.useRealTimers();
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      submittedAt: "2026-08-28T10:05:00.000Z",
      band: 6.5,
      revisionRound: 2,
      parentAttemptId: "root",
      parentBand: 6,
      transcript: "A short talk.",
      scores: {
        fluencyCoherence: 6.5,
        lexicalResource: 6.5,
        grammaticalRange: 6,
        pronunciation: 6.5,
      },
      feedback: {
        fluencyCoherence: "Better.",
        lexicalResource: "Better.",
        grammaticalRange: "Better.",
        pronunciation: "Better.",
        overview: "Improved.",
        nextFocus: "Keep going.",
      },
    });
    renderPage();

    await screen.findByText("A short talk.");
    expect(screen.getByText("6.0 → 6.5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Record again/i })).toBeNull();
  });

  it("resumes a pending revision without calling revise", async () => {
    vi.useRealTimers();
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      submittedAt: "2026-08-28T10:05:00.000Z",
      band: 6,
      transcript: "A short talk.",
      hasRevision: true,
      pendingRevisionId: "rev-pending",
      scores: {
        fluencyCoherence: 6,
        lexicalResource: 6,
        grammaticalRange: 6,
        pronunciation: 6,
      },
      feedback: {
        fluencyCoherence: "Ok.",
        lexicalResource: "Ok.",
        grammaticalRange: "Ok.",
        pronunciation: "Ok.",
        overview: "Ok.",
        nextFocus: "Practice.",
      },
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Resume recording/i }));
    expect(reviseSpeakingAttempt).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/speaking/rev-pending");
  });

  it("calls revise and navigates to the new recording", async () => {
    vi.useRealTimers();
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      submittedAt: "2026-08-28T10:05:00.000Z",
      band: 6,
      transcript: "A short talk.",
      scores: {
        fluencyCoherence: 6,
        lexicalResource: 6,
        grammaticalRange: 6,
        pronunciation: 6,
      },
      feedback: {
        fluencyCoherence: "Ok.",
        lexicalResource: "Ok.",
        grammaticalRange: "Ok.",
        pronunciation: "Ok.",
        overview: "Ok.",
        nextFocus: "Practice.",
      },
    });
    vi.mocked(reviseSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      id: "rev-1",
      revisionRound: 1,
      parentAttemptId: "s1",
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Record again/i }));

    await waitFor(() => {
      expect(reviseSpeakingAttempt).toHaveBeenCalledWith("s1");
      expect(navigate).toHaveBeenCalledWith("/speaking/rev-1");
    });
  });
});
