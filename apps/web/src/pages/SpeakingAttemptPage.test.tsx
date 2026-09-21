import { speakingDescriptor } from "@writing-helper/practice";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeakingAttemptDetail } from "../api/speaking";
import { SpeakingAttemptPage } from "./SpeakingAttemptPage";

type RecState = "idle" | "recording" | "done" | "error";

const recorderOpts = vi.hoisted(() => ({ maxMs: undefined as number | undefined }));
const startSpy = vi.fn();
const stopSpy = vi.fn();
const resetSpy = vi.fn();

/** Mutable knobs the tests set before Stop so the mock can finish with chosen PCM. */
const finishConfig = {
  durationMs: 12_000,
  silent: false,
};

vi.mock("../speaking/useRecorder", () => ({
  MAX_RECORDING_MS: 60_000,
  recordingSupported: () => true,
  useRecorder: (opts?: { maxMs?: number }) => {
    recorderOpts.maxMs = opts?.maxMs;
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
      // Keep durationMs realistic for gate checks, but a tiny PCM buffer so
      // encodeWav/base64 in Review/Submit stay cheap under parallel vitest load.
      const next = new Float32Array(1_600);
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
    deleteSpeakingAttempt: vi.fn(),
    updateSpeakingAttempt: vi.fn(),
    generateSampleTalks: vi.fn(),
  };
});

import {
  deleteSpeakingAttempt,
  generateSampleTalks,
  getSpeakingAttempt,
  reviseSpeakingAttempt,
  submitSpeakingAttempt,
  updateSpeakingAttempt,
} from "../api/speaking";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const openAttempt: SpeakingAttemptDetail = {
  id: "s1",
  level: "B1",
  scale: "ielts",
  rawRating: null,
  estimatedScaled: null,
  cefrEstimate: null,
  cueCard: {
    type: "express-opinion",
    prepSeconds: 60,
    speakSeconds: 120,
    maxRaw: 9,
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
  structure: [
    "Name the journey",
    "Where you went",
    "Who you went with",
    "Why it was memorable",
    "Close with how you feel now",
  ],
  vocabulary: [
    { word: "scenic", meaning: "beautiful to look at", example: "We took a scenic route." },
  ],
  hintsOpened: false,
  sampleTalks: null,
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
    vi.mocked(deleteSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockReset();
    vi.mocked(generateSampleTalks).mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-audio"),
      revokeObjectURL: vi.fn(),
    });
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
    expect(document.querySelector(".speaking-desk")).toBeTruthy();
    expect(document.querySelector("[data-atmosphere='speaking']")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Skip prep/i }));

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(startSpy).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/Recording. Microphone live/);
    expect(screen.getByText("Rec")).toBeTruthy();
  });

  it("moves from Prep to Record when the minute ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

  it("asks before deleting a talk and navigates to the talks list", async () => {
    vi.useRealTimers();
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    vi.mocked(deleteSpeakingAttempt).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete this talk" }));
    expect(screen.getByRole("dialog", { name: "Delete this talk?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteSpeakingAttempt).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/speaking"));
  });
});

describe("SpeakingAttemptPage prep hints", () => {
  beforeEach(() => {
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockImplementation(async (_id, input) => ({
      ...openAttempt,
      ...input,
      hintsOpened: input.hintsOpened ?? openAttempt.hintsOpened,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Show hints on prep and PATCHes hintsOpened", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show hints" }));

    expect(await screen.findByText("Structure")).toBeTruthy();
    expect(screen.getByText("Name the journey")).toBeTruthy();
    expect(screen.getByText("scenic")).toBeTruthy();
    expect(updateSpeakingAttempt).toHaveBeenCalledWith("s1", { hintsOpened: true });
  });

  it("hides hints after skipping prep", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show hints" }));
    expect(await screen.findByText("Structure")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Skip prep/i }));

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(screen.queryByText("Structure")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show hints" })).toBeNull();
  });

  it("does not show the hints door when structure and vocabulary are missing", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      structure: null,
      vocabulary: null,
    });
    renderPage();
    await screen.findByText("Describe a memorable journey");
    expect(screen.queryByRole("button", { name: "Show hints" })).toBeNull();
  });
});

describe("SpeakingAttemptPage result aids", () => {
  const graded = {
    ...openAttempt,
    submittedAt: "2026-08-28T10:05:00.000Z",
    band: 6,
    transcript: "I went to Paris um yesterday",
    marks: [{ start: 15, end: 17, kind: "filler" as const, note: "filler word" }],
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
  };

  beforeEach(() => {
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(generateSampleTalks).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows structure, vocabulary, and the model-answer button after grading", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(graded);
    renderPage();

    expect(await screen.findByText("Structure")).toBeTruthy();
    expect(screen.getByText("Name the journey")).toBeTruthy();
    expect(screen.getByText("scenic")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See model answers" })).toBeTruthy();
  });

  it("loads sample talks and hides the button", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(graded);
    vi.mocked(generateSampleTalks).mockResolvedValue({
      ...graded,
      sampleTalks: ["First model talk.", "Second model talk."],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "See model answers" }));

    expect(await screen.findByText("First model talk.")).toBeTruthy();
    expect(screen.getByText("Second model talk.")).toBeTruthy();
    expect(generateSampleTalks).toHaveBeenCalledWith("s1");
    expect(screen.queryByRole("button", { name: "See model answers" })).toBeNull();
  });

  it("omits structure and vocab blocks when the attempt has no prep notes", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...graded,
      structure: null,
      vocabulary: null,
    });
    renderPage();

    await screen.findByText(/I went to Paris um yesterday/);
    expect(screen.queryByText("Structure")).toBeNull();
    expect(screen.getByRole("button", { name: "See model answers" })).toBeTruthy();
  });
});

const toeicOpinion: SpeakingAttemptDetail = {
  ...openAttempt,
  scale: "toeic",
  cueCard: {
    type: "express-opinion",
    prepSeconds: 45,
    speakSeconds: 60,
    maxRaw: 5,
    question:
      "Do you think companies should allow employees to work from home two days a week?",
  },
};

describe("SpeakingAttemptPage TOEIC exam room", () => {
  beforeEach(() => {
    startSpy.mockClear();
    stopSpy.mockClear();
    resetSpy.mockClear();
    recorderOpts.maxMs = undefined;
    navigate.mockReset();
    finishConfig.durationMs = 12_000;
    finishConfig.silent = false;
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(submitSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-audio"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("caps express-opinion recording at 60 seconds", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(toeicOpinion);
    renderPage();

    expect(
      await screen.findByText(
        "Do you think companies should allow employees to work from home two days a week?",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Express an opinion")).toBeTruthy();
    expect(screen.queryByText(/Part 2/)).toBeNull();
    expect(recorderOpts.maxMs).toBe(60_000);
  });

  it("shows a read-aloud passage during prep and record", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      scale: "toeic",
      cueCard: {
        type: "read-aloud",
        prepSeconds: 45,
        speakSeconds: 45,
        maxRaw: 3,
        passage: "Good morning. The staff cafeteria on the second floor will open at seven thirty.",
      },
    });
    renderPage();

    expect(await screen.findByText(/staff cafeteria on the second floor/)).toBeTruthy();
    expect(screen.getByText("Read a text aloud")).toBeTruthy();
    expect(screen.queryByText("You should say:")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Skip prep/i }));

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(screen.getByText(/staff cafeteria on the second floor/)).toBeTruthy();
    expect(recorderOpts.maxMs).toBe(45_000);
  });

  it("shows a large describe-picture image and no IELTS bullets", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      scale: "toeic",
      cueCard: {
        type: "describe-picture",
        prepSeconds: 45,
        speakSeconds: 30,
        maxRaw: 3,
        imageUrl: "/toeic/office-desk.jpg",
      },
    });
    renderPage();

    const image = await screen.findByRole("img");
    expect(image.getAttribute("src")).toBe("/toeic/office-desk.jpg");
    expect(screen.getByText("Describe a picture")).toBeTruthy();
    expect(screen.queryByText("You should say:")).toBeNull();
    expect(screen.queryByText("where you went")).toBeNull();
    expect(screen.queryByText(/Part 2/)).toBeNull();
  });

  it("shows the info block before record on respond-with-info", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      scale: "toeic",
      cueCard: {
        type: "respond-with-info",
        prepSeconds: 3,
        speakSeconds: 30,
        infoSeconds: 45,
        maxRaw: 3,
        info: "City Business Forum — Friday schedule:\n9:15 Keynote: Ms. Elena Park, Hall A",
        question: "What time does the keynote speech begin, and where is it held?",
      },
    });
    renderPage();

    expect(await screen.findByText(/City Business Forum/)).toBeTruthy();
    expect(screen.getByText(/9:15 Keynote/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Stop recording/i })).toBeNull();
    expect(screen.queryByText(/Part 2/)).toBeNull();
  });

  it("shows the speaking descriptor next to the practice score stamp", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...toeicOpinion,
      submittedAt: "2026-08-28T10:05:00.000Z",
      band: null,
      rawRating: 4,
      estimatedScaled: 160,
      cefrEstimate: "B2",
      transcript: "I think people should work from home two days a week.",
      feedback: {
        overview: "A clear opinion.",
        nextFocus: "Add one workplace example.",
        taskAppropriateness: "On topic.",
        delivery: "Steady.",
        languageUse: "Clear enough.",
      },
    });
    renderPage();

    expect(await screen.findByText("160")).toBeTruthy();
    expect(screen.getByText(speakingDescriptor(160))).toBeTruthy();
    expect(screen.getByText("Practice score, not an official TOEIC score")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See model answers" })).toBeTruthy();
    expect(screen.queryByText(/Band 5\.5/)).toBeNull();
    expect(screen.queryByText(/Part 2/)).toBeNull();
  });
});

