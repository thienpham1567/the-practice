import { cefrFromScaled, type CefrEstimate, type Level } from "@writing-helper/practice";

export const WINDOW_SIZE = 5;

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 30;

const CEFR_ORDER: CefrEstimate[] = ["A1", "A2", "B1", "B2", "C1"];

/** Writing ETS lower bound for the *next* CEFR after the current estimate. */
const WRITING_NEXT_CUT: Record<Exclude<CefrEstimate, "C1">, number> = {
  A1: 70,
  A2: 120,
  B1: 150,
  B2: 180,
};

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
  estimatedScaled?: number | null;
  cefrEstimate?: string | null;
};

export type LevelUpVerdict = {
  suggest: Level;
  reason: string;
};

function writingCefr(point: ProgressSeriesPoint): CefrEstimate | null {
  if (point.estimatedScaled == null) return null;
  if (point.cefrEstimate && CEFR_ORDER.includes(point.cefrEstimate as CefrEstimate)) {
    return point.cefrEstimate as CefrEstimate;
  }
  return cefrFromScaled(point.estimatedScaled, "writing");
}

/** Suggest the next CEFR from recent TOEIC writing scores, or null when not ready. */
export function levelUpVerdict(
  series: ProgressSeriesPoint[],
  now: Date = new Date(),
): LevelUpVerdict | null {
  if (series.length === 0) return null;

  const since = now.getTime() - LOOKBACK_DAYS * MS_PER_DAY;
  const recent = series.filter(
    (point) => new Date(point.at).getTime() >= since && writingCefr(point) != null,
  );
  if (recent.length === 0) return null;

  const modal = modalCefr(recent);
  if (modal === "C1") return null;

  const atLevel = series
    .filter((point) => writingCefr(point) === modal)
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (atLevel.length < WINDOW_SIZE) return null;

  const suggest = nextCefr(modal);
  if (!suggest) return null;

  return {
    suggest,
    reason: `Last ${WINDOW_SIZE} papers at ${modal} — writing ${suggest} starts at ${WRITING_NEXT_CUT[modal]}`,
  };
}

function modalCefr(recent: ProgressSeriesPoint[]): CefrEstimate {
  const counts = new Map<CefrEstimate, number>();
  for (const point of recent) {
    const cefr = writingCefr(point);
    if (!cefr) continue;
    counts.set(cefr, (counts.get(cefr) ?? 0) + 1);
  }

  let best: CefrEstimate = writingCefr(recent[0]!) ?? "A1";
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    } else if (count === bestCount && CEFR_ORDER.indexOf(level) > CEFR_ORDER.indexOf(best)) {
      best = level;
    }
  }
  return best;
}

function nextCefr(level: CefrEstimate): Level | null {
  const index = CEFR_ORDER.indexOf(level);
  if (index < 0 || index >= CEFR_ORDER.length - 1) return null;
  const next = CEFR_ORDER[index + 1]!;
  return next === "A1" ? null : next;
}
