export type {
  AttemptMarkInput,
  CriterionScores,
  Feedback,
  Level,
  MarkCategory,
  MarkSeverity,
  MarkTally,
  MistakeProfile,
  TaskSpec,
  TaskType,
  VocabularyItem,
  WritingMark,
} from "./types";

export type { SpeakingCueCard } from "./speaking-catalog";
export type { SpeakingFluency } from "./speaking-fluency";

export { TASK_CATALOG, tasksForLevel } from "./task-catalog";
export { SPEAKING_CATALOG, speakingTasksForLevel } from "./speaking-catalog";
export { pickTask } from "./pick-task";
export { pickSpeakingTask } from "./pick-speaking-task";
export { overallBand } from "./overall-band";
export { speakingFluency } from "./speaking-fluency";
export { computeStreak, type Streak } from "./compute-streak";
export { MARK_CATEGORIES, MARK_LABELS, MARK_SEVERITY } from "./mark-catalog";
export {
  summarizeMarks,
  PROFILE_WINDOW,
  MIN_OCCURRENCES,
  MIN_ATTEMPTS_FOR_TREND,
} from "./summarize-marks";
export { focusCategories } from "./focus-categories";
export { countHandled, markKey } from "./handled-marks";
