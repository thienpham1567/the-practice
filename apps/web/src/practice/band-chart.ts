export interface BandPoint {
  at: number;
  band: number;
}

export interface ChartDot {
  x: number;
  y: number;
}

const PAD_X = 8;
const PAD_Y = 10;
const BAND_MAX = 9;

/** Map scored attempts onto an SVG viewBox. One point sits at the right edge. */
export function chartDots(points: BandPoint[], width: number, height: number): ChartDot[] {
  if (points.length === 0) return [];

  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;
  const yOf = (band: number) => PAD_Y + innerH * (1 - band / BAND_MAX);

  if (points.length === 1) {
    return [{ x: PAD_X + innerW, y: yOf(points[0]!.band) }];
  }

  const times = points.map((point) => point.at);
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
