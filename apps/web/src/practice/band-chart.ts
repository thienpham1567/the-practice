export interface BandPoint {
  at: number;
  band: number;
}

export interface ChartDot {
  x: number;
  y: number;
}

/** Optional shared axes so several series can share one SVG. */
export type ChartScale = {
  minT?: number;
  maxT?: number;
  /** Y-axis ceiling; defaults to band max (9). */
  valueMax?: number;
};

const PAD_X = 8;
const PAD_Y = 10;
const BAND_MAX = 9;

/** Map scored attempts onto an SVG viewBox. One point sits at the right edge. */
export function chartDots(
  points: BandPoint[],
  width: number,
  height: number,
  scale?: ChartScale,
): ChartDot[] {
  if (points.length === 0) return [];

  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;
  const valueMax = scale?.valueMax ?? BAND_MAX;
  const yOf = (band: number) => PAD_Y + innerH * (1 - band / valueMax);

  const hasDomain = scale?.minT != null && scale?.maxT != null;

  if (points.length === 1 && !hasDomain) {
    return [{ x: PAD_X + innerW, y: yOf(points[0]!.band) }];
  }

  const times = hasDomain
    ? [scale.minT!, scale.maxT!]
    : points.map((point) => point.at);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const span = Math.max(maxT - minT, 1);

  return points.map((point) => ({
    x: PAD_X + ((point.at - minT) / span) * innerW,
    y: yOf(point.band),
  }));
}

export function polyline(dots: ChartDot[]): string {
  return dots.map((dot) => `${dot.x},${dot.y}`).join(" ");
}

/** List-root fields used to build BandChart points. */
export type ChartRoot = {
  band: number | null;
  submittedAt: string | null;
  /** Present on list roots; deliberately ignored — chart uses first-draft `band`. */
  latestBand?: number | null;
};

/**
 * BandChart input from practice list roots.
 * Uses first-draft `attempt.band`, never `latestBand` from the revision chain.
 * Expects newest-first roots (API order); returns chronological points.
 */
export function firstDraftChartPoints(roots: ChartRoot[]): BandPoint[] {
  return roots
    .filter(
      (item): item is ChartRoot & { band: number; submittedAt: string } =>
        item.submittedAt != null && item.band !== null,
    )
    .slice()
    .reverse()
    .map((item) => ({
      at: new Date(item.submittedAt).getTime(),
      band: item.band,
    }));
}
