import type { Level } from "@writing-helper/practice";

export const WINDOW_SIZE = 5;
export const BAND_THRESHOLD = 6.5;
export const CRITERION_FLOOR = 6.0;

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 30;

const LEVEL_ORDER: Level[] = ["A2", "B1", "B2", "C1"];

export type ProgressScores = {
  task: number;
  coherence: number;
  lexical: number;
  grammar: number;
};

export type ProgressSeriesPoint = {
  at: string;
  level: Level;
  band: number;
  scores: ProgressScores;
  per100: { passives: number; adverbs: number } | null;
};

export type LevelUpVerdict = {
  suggest: Level;
  reason: string;
};

/** Suggest the next CEFR level from recent practice, or null when not ready. */
export function levelUpVerdict(
  series: ProgressSeriesPoint[],
  now: Date = new Date(),
): LevelUpVerdict | null {
  if (series.length === 0) return null;

  const since = now.getTime() - LOOKBACK_DAYS * MS_PER_DAY;
  const recent = series.filter((point) => new Date(point.at).getTime() >= since);
  if (recent.length === 0) return null;

  const modal = modalLevel(recent);
  if (modal === "C1") return null;

  const atLevel = series
    .filter((point) => point.level === modal)
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (atLevel.length < WINDOW_SIZE) return null;

  const window = atLevel.slice(-WINDOW_SIZE);
  const ready = window.every(
    (point) =>
      point.band >= BAND_THRESHOLD &&
      point.scores.task >= CRITERION_FLOOR &&
      point.scores.coherence >= CRITERION_FLOOR &&
      point.scores.lexical >= CRITERION_FLOOR &&
      point.scores.grammar >= CRITERION_FLOOR,
  );
  if (!ready) return null;

  const suggest = nextLevel(modal);
  if (!suggest) return null;

  return {
    suggest,
    reason: `${WINDOW_SIZE} bài ${modal} gần nhất đều ≥ ${BAND_THRESHOLD}`,
  };
}

function modalLevel(recent: ProgressSeriesPoint[]): Level {
  const counts = new Map<Level, number>();
  for (const point of recent) {
    counts.set(point.level, (counts.get(point.level) ?? 0) + 1);
  }

  let best: Level = recent[0]!.level;
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    } else if (count === bestCount) {
      // Prefer the higher CEFR level on a tie.
      if (LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(best)) {
        best = level;
      }
    }
  }
  return best;
}

function nextLevel(level: Level): Level | null {
  const index = LEVEL_ORDER.indexOf(level);
  if (index < 0 || index >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[index + 1]!;
}
