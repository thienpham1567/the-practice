import { MARK_CATEGORIES } from "./mark-catalog";
import type {
  AttemptMarkInput,
  MarkCategory,
  MarkTally,
  MistakeProfile,
} from "./types";

/** Recent papers considered — close enough to reflect the current level. */
export const PROFILE_WINDOW = 10;
/** One occurrence is an accident, not a pattern. */
export const MIN_OCCURRENCES = 2;
/** Below this, halving the window says nothing. */
export const MIN_ATTEMPTS_FOR_TREND = 4;

/** Thresholds differ so small wobble is not read as a direction. */
const IMPROVED_BELOW = 0.75;
const WORSENED_ABOVE = 1.33;

/**
 * Recurring-mistake profile, derived from graded papers — there is no tally
 * table. Sorts and windows its own input so callers carry no preconditions.
 */
export function summarizeMarks(attempts: AttemptMarkInput[]): MistakeProfile {
  const window = [...attempts]
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(-PROFILE_WINDOW);

  if (window.length === 0) return { tallies: [], attemptsConsidered: 0 };

  const counts = new Map<MarkCategory, number>();
  for (const attempt of window) {
    for (const mark of attempt.marks) {
      counts.set(mark.category, (counts.get(mark.category) ?? 0) + 1);
    }
  }

  // Odd count: the middle paper belongs to the recent half, biasing toward now.
  const split = Math.floor(window.length / 2);
  const older = window.slice(0, split);
  const recent = window.slice(split);
  const canTrend = window.length >= MIN_ATTEMPTS_FOR_TREND;

  const tallies: MarkTally[] = [];
  for (const category of MARK_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count < MIN_OCCURRENCES) continue;
    tallies.push({
      category,
      count,
      trend: canTrend ? trendFor(category, older, recent) : null,
    });
  }

  // Stable sort: ties keep the taxonomy order this loop walked in.
  tallies.sort((a, b) => b.count - a.count);

  return { tallies, attemptsConsidered: window.length };
}

/** Mistakes per 100 words — unnormalised, a longer paper looks like decline. */
function ratePer100Words(category: MarkCategory, attempts: AttemptMarkInput[]): number {
  let marks = 0;
  let words = 0;

  for (const attempt of attempts) {
    marks += attempt.marks.filter((mark) => mark.category === category).length;
    words += attempt.wordCount;
  }

  return words === 0 ? 0 : (marks / words) * 100;
}

function trendFor(
  category: MarkCategory,
  older: AttemptMarkInput[],
  recent: AttemptMarkInput[],
): "down" | "flat" | "up" {
  const before = ratePer100Words(category, older);
  const after = ratePer100Words(category, recent);

  if (before === 0) return after === 0 ? "flat" : "up";
  if (after < before * IMPROVED_BELOW) return "down";
  if (after > before * WORSENED_ABOVE) return "up";
  return "flat";
}
