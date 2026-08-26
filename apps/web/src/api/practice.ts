import type { AnalysisResult } from "@writing-helper/analysis";
import type {
  CriterionScores,
  Feedback,
  Level,
  TaskType,
  VocabularyItem,
} from "@writing-helper/practice";
import type { SerializedEditorState } from "lexical";
import { apiFetch, apiJson } from "./client";

export interface PracticeAttemptSummary {
  id: string;
  level: Level;
  taskType: TaskType;
  band: number | null;
  wordCount: number;
  hintsOpened: boolean;
  startedAt: string;
  submittedAt: string | null;
  elapsedSeconds: number | null;
}

export interface PracticeAttemptDetail extends PracticeAttemptSummary {
  prompt: string;
  ideas: string[];
  vocabulary: VocabularyItem[];
  content: SerializedEditorState | null;
  plainText: string;
  scores: CriterionScores | null;
  feedback: Feedback | null;
  styleSnapshot: AnalysisResult | null;
}

export interface CreateAttemptInput {
  level: Level;
  taskType?: TaskType;
}

export interface UpdateAttemptInput {
  content?: SerializedEditorState;
  plainText?: string;
  wordCount?: number;
  hintsOpened?: boolean;
}

export interface SubmitAttemptInput {
  styleSnapshot: AnalysisResult;
  content?: SerializedEditorState;
  plainText?: string;
  wordCount?: number;
}

export const listAttempts = async () => {
  const page = await apiFetch<{ items: PracticeAttemptSummary[]; nextCursor: string | null }>(
    "/practice/attempts",
  );
  return page.items;
};

export const getAttempt = (id: string) =>
  apiFetch<PracticeAttemptDetail>(`/practice/attempts/${id}`);

export const createAttempt = (input: CreateAttemptInput) =>
  apiJson<PracticeAttemptDetail>("/practice/attempts", "POST", input);

export const updateAttempt = (id: string, input: UpdateAttemptInput) =>
  apiJson<PracticeAttemptDetail>(`/practice/attempts/${id}`, "PATCH", input);

export const submitAttempt = (id: string, input: SubmitAttemptInput) =>
  apiJson<PracticeAttemptDetail>(`/practice/attempts/${id}/submit`, "POST", input);
