import { SCORE_MAX, chartDots, polyline } from "./band-chart";
import type { ProgressSeriesPoint } from "./level-up";

const WIDTH = 560;
const HEIGHT = 140;

interface ProgressBandChartProps {
  series: ProgressSeriesPoint[];
}

/** One writing series of practice scaled scores (0–200). Not grouped by CEFR. */
export function ProgressBandChart({ series }: ProgressBandChartProps) {
  if (series.length === 0) return null;

  const points = series
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((point) => ({
      at: new Date(point.at).getTime(),
      band: point.estimatedScaled ?? point.band,
    }));

  const times = points.map((point) => point.at);
  const dots = chartDots(points, WIDTH, HEIGHT, {
    minT: Math.min(...times),
    maxT: Math.max(...times),
    valueMax: SCORE_MAX,
  });

  return (
    <section aria-label="Practice score over time">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Practice score over time
      </h2>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full text-ink"
        role="img"
        aria-label="Writing practice scores over time"
      >
        <line
          x1="8"
          x2="8"
          y1="10"
          y2={HEIGHT - 10}
          stroke="currentColor"
          strokeWidth="0.6"
          className="text-rule"
        />
        <line
          x1="8"
          x2={WIDTH - 8}
          y1={HEIGHT - 10}
          y2={HEIGHT - 10}
          stroke="currentColor"
          strokeWidth="0.6"
          className="text-rule"
        />
        <g className="text-vermilion">
          {dots.length > 1 && (
            <polyline
              data-series="score"
              points={polyline(dots)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )}
          {dots.map((dot, index) => (
            <circle
              key={`score-${index}`}
              data-series="score"
              cx={dot.x}
              cy={dot.y}
              r="2.4"
              fill="currentColor"
            />
          ))}
        </g>
      </svg>
    </section>
  );
}
