import type { SpeakingProgressPoint } from "../api/progress";
import { SCORE_MAX, chartDots, polyline } from "./band-chart";

const WIDTH = 560;
const HEIGHT = 140;

interface SpeakingProgressChartsProps {
  series: SpeakingProgressPoint[];
}

/**
 * Speaking charts stay separate from writing ProgressBandChart.
 * One series of practice scaled scores (0–200) — not grouped by CEFR.
 */
export function SpeakingProgressCharts({ series }: SpeakingProgressChartsProps) {
  if (series.length === 0) return null;

  return (
    <section aria-label="Speaking progress" className="min-w-0 space-y-10">
      <header>
        <h2 className="font-display text-2xl font-semibold">Speaking</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Practice scores and pace, kept apart from writing progress.
        </p>
      </header>
      <SpeakingScoreChart series={series} />
      <SpeakingWpmChart series={series} />
    </section>
  );
}

function SpeakingScoreChart({ series }: { series: SpeakingProgressPoint[] }) {
  const points = series
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((point) => ({
      at: new Date(point.at).getTime(),
      band: point.band,
    }));
  const times = points.map((point) => point.at);
  const dots = chartDots(points, WIDTH, HEIGHT, {
    minT: Math.min(...times),
    maxT: Math.max(...times),
    valueMax: SCORE_MAX,
  });

  return (
    <section aria-label="Speaking score over time">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Practice score over time
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full max-w-full text-ink"
        role="img"
        aria-label="Speaking practice scores over time"
      >
        <AxisLines />
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

function SpeakingWpmChart({ series }: { series: SpeakingProgressPoint[] }) {
  const points = series
    .filter(
      (point): point is SpeakingProgressPoint & { wordsPerMinute: number } =>
        point.wordsPerMinute != null,
    )
    .map((point) => ({
      at: new Date(point.at).getTime(),
      band: point.wordsPerMinute,
    }));

  if (points.length === 0) return null;

  const times = points.map((point) => point.at);
  const valueMax = Math.max(...points.map((point) => point.band), 1);
  const dots = chartDots(points, WIDTH, HEIGHT, {
    minT: Math.min(...times),
    maxT: Math.max(...times),
    valueMax,
  });

  return (
    <section aria-label="Speaking WPM over time">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Words per minute
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full max-w-full text-ink"
        role="img"
        aria-label="Speaking words per minute over time"
      >
        <AxisLines />
        <g className="text-vermilion">
          {dots.length > 1 && (
            <polyline
              data-series="wpm"
              points={polyline(dots)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )}
          {dots.map((dot, index) => (
            <circle
              key={`wpm-${index}`}
              data-series="wpm"
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

function AxisLines() {
  return (
    <>
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
    </>
  );
}
