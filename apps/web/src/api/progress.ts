import type { Level } from "@writing-helper/practice";
import { apiFetch } from "./client";

export type ProgressScores = {
  task: number;
  coherence: number;
  lexical: number;
  grammar: number;
};

export type ProgressPer100 = {
  passives: number;
  adverbs: number;
};

export type ProgressSeriesPoint = {
  at: string;
  level: Level;
  band: number;
  scores: ProgressScores;
  per100: ProgressPer100 | null;
};

export type ProgressSummary = {
  series: ProgressSeriesPoint[];
  streak: { current: number; submittedDates: string[] };
};

export const getProgress = () => apiFetch<ProgressSummary>("/practice/progress");
