import type { SpeakingTaskType } from "@writing-helper/practice";
import { apiFetch, apiJson } from "./client";
import type { PracticeScale } from "./practice";

export type SpeakingCueCard = {
  type: string;
  prepSeconds: number;
  speakSeconds: number;
  maxRaw: number;
  passage?: string;
  imageUrl?: string;
  question?: string;
  info?: string;
  infoSeconds?: number;
  /** Legacy IELTS Part 2 fields. */
  topic?: string;
  bullets?: string[];
};

export type SpeakingScores = {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRange: number;
  pronunciation: number;
};

export type SpeakingFeedback = {
  overview: string;
  nextFocus: string;
  pronunciation?: string;
  intonationStress?: string;
  taskAppropriateness?: string;
  delivery?: string;
  languageUse?: string;
  fluencyCoherence?: string;
  lexicalResource?: string;
  grammaticalRange?: string;
};

export type SpeakingMarkKind = "pronunciation" | "hesitation" | "grammar" | "filler";

export type SpeakingMark = {
  start: number;
  end: number;
  kind: SpeakingMarkKind;
  note: string;
};

export type SpeakingFluency = {
  wordsPerMinute: number;
  fillerCount: number;
};

export interface SpeakingAttemptSummary {
  id: string;
  level: string;
  taskType?: string;
  scale: PracticeScale;
  rawRating: number | null;
  estimatedScaled: number | null;
  cefrEstimate: string | null;
  band: number | null;
  durationMs: number | null;
  startedAt: string;
  submittedAt: string | null;
  revisionCount: number;
  latestBand: number | null;
}

export interface SpeakingAttemptDetail {
  id: string;
  level: string;
  taskType?: string;
  scale: PracticeScale;
  rawRating: number | null;
  estimatedScaled: number | null;
  cefrEstimate: string | null;
  cueCard: SpeakingCueCard;
  band: number | null;
  durationMs: number | null;
  transcript: string | null;
  marks: SpeakingMark[] | null;
  fluency: SpeakingFluency | null;
  scores: SpeakingScores | null;
  feedback: SpeakingFeedback | null;
  startedAt: string;
  submittedAt: string | null;
  parentAttemptId: string | null;
  revisionRound: number;
  parentBand: number | null;
  hasRevision: boolean;
  pendingRevisionId: string | null;
  structure: string[] | null;
  vocabulary: { word: string; meaning: string; example: string; review?: boolean }[] | null;
  hintsOpened: boolean;
  sampleTalks: string[] | null;
}

export interface CreateSpeakingAttemptInput {
  taskType: SpeakingTaskType;
  speakSeconds?: 15 | 30;
}

export interface SubmitSpeakingInput {
  audioBase64: string;
  /** API chỉ nhận WAV (đọc thời lượng thật từ header). */
  format: "wav";
  durationMs: number;
}

export const listSpeakingAttempts = async () => {
  const page = await apiFetch<{ items: SpeakingAttemptSummary[]; nextCursor: string | null }>(
    "/speaking/attempts",
  );
  return page.items;
};

export const getSpeakingAttempt = (id: string) =>
  apiFetch<SpeakingAttemptDetail>(`/speaking/attempts/${id}`);

export const createSpeakingAttempt = (input: CreateSpeakingAttemptInput) =>
  apiJson<SpeakingAttemptDetail>("/speaking/attempts", "POST", input);

export const submitSpeakingAttempt = (id: string, input: SubmitSpeakingInput) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/submit`, "POST", input);

export const reviseSpeakingAttempt = (id: string) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/revise`, "POST", {});

export const updateSpeakingAttempt = (id: string, input: { hintsOpened?: boolean }) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}`, "PATCH", input);

export const generateSampleTalks = (id: string) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/samples`, "POST", {});

export const deleteSpeakingAttempt = (id: string) =>
  apiFetch<void>(`/speaking/attempts/${id}`, { method: "DELETE" });
