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
