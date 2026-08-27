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

export type FeedbackAuditStatus = "resolved" | "partial" | "unresolved";

export interface FeedbackAuditItem {
  point: string;
  status: FeedbackAuditStatus;
}

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
  /** Number of revisions in the chain (0 for unreised roots). */
  revisionCount: number;
  /** Band of the furthest graded revision; null when revisionCount === 0. */
  latestBand: number | null;
}

export interface PracticeAttemptDetail
  extends Omit<PracticeAttemptSummary, "revisionCount" | "latestBand"> {
  prompt: string;
  ideas: string[];
  vocabulary: Array<VocabularyItem & { review?: boolean }>;
  content: SerializedEditorState | null;
  plainText: string;
  scores: CriterionScores | null;
  feedback: Feedback | null;
  styleSnapshot: AnalysisResult | null;
  parentAttemptId: string | null;
  revisionRound: number;
  feedbackAudit: FeedbackAuditItem[] | null;
  parentBand: number | null;
  hasRevision: boolean;
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

export const reviseAttempt = (id: string) =>
  apiJson<PracticeAttemptDetail>(`/practice/attempts/${id}/revise`, "POST", {});
