import type { CriterionScores } from "./types.js";

const CRITERIA: (keyof CriterionScores)[] = [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRange",
];

/**
 * Mean of the four IELTS criteria, rounded to the nearest 0.5.
 * Ties at .25 / .75 round up (5.25 → 5.5, 5.75 → 6.0), matching IELTS.
 */
export function overallBand(scores: CriterionScores): number {
  const mean = CRITERIA.reduce((sum, key) => sum + scores[key], 0) / CRITERIA.length;
  return Math.round(mean * 2) / 2;
}
