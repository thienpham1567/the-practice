import type { Level } from "@writing-helper/practice";
import { apiFetch, apiJson } from "./client";

export type SpeakingCueCard = {
  topic: string;
  bullets: string[];
};

export type SpeakingScores = {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRange: number;
  pronunciation: number;
};

export type SpeakingFeedback = {
  fluencyCoherence: string;
  lexicalResource: string;
  grammaticalRange: string;
  pronunciation: string;
  overview: string;
  nextFocus: string;
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
  level: Level;
  band: number | null;
  durationMs: number | null;
  startedAt: string;
  submittedAt: string | null;
  revisionCount: number;
  latestBand: number | null;
}

export interface SpeakingAttemptDetail {
  id: string;
  level: Level;
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
}

export interface SubmitSpeakingInput {
  audioBase64: string;
  format: "wav" | "mp3";
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

export const createSpeakingAttempt = (input: { level: Level }) =>
  apiJson<SpeakingAttemptDetail>("/speaking/attempts", "POST", input);

export const submitSpeakingAttempt = (id: string, input: SubmitSpeakingInput) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/submit`, "POST", input);

export const reviseSpeakingAttempt = (id: string) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/revise`, "POST", {});
