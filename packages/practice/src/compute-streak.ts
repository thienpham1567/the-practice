export interface Streak {
  current: number;
  longest: number;
}

function utcDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const MS_PER_DAY = 86_400_000;

/**
 * Consecutive calendar days with at least one submission.
 * `current` is counted back from `now` (today or yesterday must be present).
 * Streak is derived, never stored — callers pass submittedAt dates.
 */
export function computeStreak(submittedDates: Date[], now: Date = new Date()): Streak {
  const uniqueDays = [...new Set(submittedDates.map(utcDayKey))].sort((a, b) => a - b);
  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const gap = (uniqueDays[i]! - uniqueDays[i - 1]!) / MS_PER_DAY;
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const today = utcDayKey(now);
  const latest = uniqueDays[uniqueDays.length - 1]!;
  const daysBehind = (today - latest) / MS_PER_DAY;
  if (daysBehind > 1) return { current: 0, longest };

  let current = 1;
  for (let i = uniqueDays.length - 1; i > 0; i--) {
    const gap = (uniqueDays[i]! - uniqueDays[i - 1]!) / MS_PER_DAY;
    if (gap !== 1) break;
    current += 1;
  }

  return { current, longest };
}
