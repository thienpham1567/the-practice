import type { Level } from "@writing-helper/practice";
import type { BandPoint } from "./band-chart";
import type { ProgressScores, ProgressSeriesPoint } from "./level-up";

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 30;

const CRITERION_KEYS: (keyof ProgressScores)[] = [
  "task",
  "coherence",
  "lexical",
  "grammar",
];

export type Per100Point = {
  at: number;
  passives: number;
  adverbs: number;
};

export type CriteriaAverage = {
  averages: ProgressScores;
  weakest: keyof ProgressScores;
};

/** Split series into chronological BandPoint lists keyed by CEFR level. */
export function bandSeriesByLevel(
  series: ProgressSeriesPoint[],
): Map<Level, BandPoint[]> {
  const grouped = new Map<Level, BandPoint[]>();

  const chronological = series
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  for (const point of chronological) {
    const list = grouped.get(point.level) ?? [];
    list.push({ at: new Date(point.at).getTime(), band: point.band });
    grouped.set(point.level, list);
  }

  return grouped;
}

/** Mean criterion scores over the last 30 days, plus the lowest key. */
export function criteriaAverage30d(
  series: ProgressSeriesPoint[],
  now: Date = new Date(),
): CriteriaAverage | null {
  const since = now.getTime() - LOOKBACK_DAYS * MS_PER_DAY;
  const recent = series.filter((point) => new Date(point.at).getTime() >= since);
  if (recent.length === 0) return null;

  const sums: ProgressScores = { task: 0, coherence: 0, lexical: 0, grammar: 0 };
  for (const point of recent) {
    sums.task += point.scores.task;
    sums.coherence += point.scores.coherence;
    sums.lexical += point.scores.lexical;
    sums.grammar += point.scores.grammar;
  }

  const n = recent.length;
  const averages: ProgressScores = {
    task: sums.task / n,
    coherence: sums.coherence / n,
    lexical: sums.lexical / n,
    grammar: sums.grammar / n,
  };

  let weakest: keyof ProgressScores = "task";
  for (const key of CRITERION_KEYS) {
    if (averages[key] < averages[weakest]) weakest = key;
  }

  return { averages, weakest };
}

/** Drop null per100 points so style charts keep a continuous time axis. */
export function per100Series(series: ProgressSeriesPoint[]): Per100Point[] {
  return series
    .filter(
      (point): point is ProgressSeriesPoint & { per100: NonNullable<ProgressSeriesPoint["per100"]> } =>
        point.per100 != null,
    )
    .map((point) => ({
      at: new Date(point.at).getTime(),
      passives: point.per100.passives,
      adverbs: point.per100.adverbs,
    }));
}
