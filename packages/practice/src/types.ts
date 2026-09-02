export type Level = "A2" | "B1" | "B2" | "C1";

export type TaskType =
  | "email"
  | "describe-experience"
  | "letter"
  | "review"
  | "opinion-essay"
  | "discussion-essay"
  | "problem-solution"
  | "report";

export interface TaskSpec {
  type: TaskType;
  levels: Level[];
  minWords: number;
  maxWords: number;
  timeMinutes: number;
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
