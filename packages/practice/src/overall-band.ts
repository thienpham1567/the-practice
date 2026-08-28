import type { CriterionScores } from "./types";

const CRITERIA: (keyof CriterionScores)[] = [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRange",
];

/**
 * Mean of four IELTS criteria, rounded to the nearest 0.5.
 * Ties at .25 / .75 round up (5.25 → 5.5, 5.75 → 6.0), matching IELTS.
 *
 * Accepts writing {@link CriterionScores} or any four numbers (e.g. speaking).
 */
export function overallBand(scores: CriterionScores | readonly number[]): number {
  const values = Array.isArray(scores)
    ? [...scores]
    : CRITERIA.map((key) => (scores as CriterionScores)[key]);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(mean * 2) / 2;
}
