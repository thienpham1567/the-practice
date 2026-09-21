export type Level = "A2" | "B1" | "B2" | "C1";

export type WritingTaskType =
  | "picture-sentence"
  | "email-request"
  | "opinion-essay";

export type TaskType = WritingTaskType; // new catalog; old ielts strings may still exist on DB rows

export type SpeakingTaskType =
  | "read-aloud"
  | "describe-picture"
  | "respond-question"
  | "respond-with-info"
  | "express-opinion";

export interface SpeakingTaskSpec {
  type: SpeakingTaskType;
  label: string;
  prepSeconds: number;
  speakSeconds: number;
  infoSeconds?: number; // 45s read info before Q8–10
  maxRaw: 3 | 5;
}

export interface TaskSpec {
  type: TaskType;
  minWords: number;
  maxWords: number;
  timeMinutes: number;
  timeSeconds: number;
  maxRaw: 3 | 4 | 5;
  label: string;
  /** Fixed task frame. The model invents the topic, not this instruction. */
  instruction: string;
}

export interface CriterionScores {
  taskResponse: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
}

export interface Feedback {
  taskResponse: string;
  coherenceCohesion: string;
  lexicalResource: string;
  grammaticalRange: string;
  overview: string;
  nextFocus: string;
  /** 2-3 whole-essay suggestions (ideas, structure, vocabulary) — attempts
   * graded before this field existed won't have it. */
  improvements?: string[];
}

export interface VocabularyItem {
  word: string;
  meaning: string;
  example: string;
}

export type MarkSeverity = "error" | "refinement";

export type MarkCategory =
  // "error" tier — objectively wrong
  | "article"
  | "verb-tense"
  | "subject-verb-agreement"
  | "noun-number"
  | "preposition"
  | "word-order"
  | "word-form"
  | "spelling"
  | "punctuation"
  | "sentence-structure"
  | "pronoun"
  // "refinement" tier — grammatical but not idiomatic
  | "word-choice"
  | "register";

/**
 * A marked mistake on a written attempt, located by character offset on
 * plainText. Same span shape as the speaking transcript's SpeakingMark.
 */
export interface WritingMark {
  /** inclusive */
  start: number;
  /** exclusive */
  end: number;
  category: MarkCategory;
  severity: MarkSeverity;
  correction: string;
  note: string;
}

/**
 * A stylistic upgrade on already-correct text — not a mistake, so it never
 * enters the "to fix" count or the mistake profile. Same offset shape as
 * WritingMark for reuse of the same locate/render machinery.
 */
export interface Enhancement {
  /** inclusive */
  start: number;
  /** exclusive */
  end: number;
  suggestion: string;
  note: string;
}

/** Just enough of an attempt to build the recurring-mistake profile. */
export interface AttemptMarkInput {
  marks: WritingMark[];
  wordCount: number;
  submittedAt: Date;
}

export interface MarkTally {
  category: MarkCategory;
  count: number;
  /** null when there are too few attempts to read a direction. */
  trend: "down" | "flat" | "up" | null;
}

export interface MistakeProfile {
  tallies: MarkTally[];
  attemptsConsidered: number;
}
