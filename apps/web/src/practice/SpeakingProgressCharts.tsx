import type { Level } from "@writing-helper/practice";
import type { SpeakingProgressPoint } from "../api/progress";
import { chartDots, polyline, type BandPoint } from "./band-chart";
import { bandSeriesByLevel } from "./progress-series";

const WIDTH = 560;
const HEIGHT = 140;

const LEVEL_ORDER: Level[] = ["A2", "B1", "B2", "C1"];

const LEVEL_COLOR: Record<Level, string> = {
  A2: "text-level-a2",
  B1: "text-level-b1",
  B2: "text-level-b2",
  C1: "text-level-c1",
};

interface SpeakingProgressChartsProps {
  series: SpeakingProgressPoint[];
}

/**
 * Speaking charts stay separate from writing ProgressBandChart.
 * Speaking and writing are different skills — one shared band line would mislead.
 */
export function SpeakingProgressCharts({ series }: SpeakingProgressChartsProps) {
  if (series.length === 0) return null;

  return (
    <section aria-label="Speaking progress" className="min-w-0 space-y-10">
      <header>
        <h2 className="font-display text-2xl font-semibold">Speaking</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Part 2 band and pace — kept apart from writing progress.
        </p>
      </header>
      <SpeakingBandChart series={series} />
      <SpeakingWpmChart series={series} />
    </section>
  );
}

function SpeakingBandChart({ series }: { series: SpeakingProgressPoint[] }) {
  // Reuse level grouping; chart only needs at/level/band.
  const byLevel = bandSeriesByLevel(
    series.map((point) => ({
      at: point.at,
      level: point.level,
      band: point.band,
      scores: { task: 0, coherence: 0, lexical: 0, grammar: 0 },
      per100: null,
    })),
  );
  const levels = LEVEL_ORDER.filter((level) => byLevel.has(level));
  const allTimes = series.map((point) => new Date(point.at).getTime());
  const scale = { minT: Math.min(...allTimes), maxT: Math.max(...allTimes) };

  return (
    <section aria-label="Speaking band over time">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Band over time
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full max-w-full text-ink"
        role="img"
        aria-label={`Speaking band across ${levels.length} ${levels.length === 1 ? "level" : "levels"}`}
      >
        <AxisLines />
        {levels.map((level) => {
          const points = byLevel.get(level) as BandPoint[];
          const dots = chartDots(points, WIDTH, HEIGHT, scale);
          return (
            <g key={level} className={LEVEL_COLOR[level]}>
              {dots.length > 1 && (
                <polyline
                  data-level={level}
                  points={polyline(dots)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              )}
              {dots.map((dot, index) => (
                <circle
                  key={`${level}-${index}`}
                  data-level={level}
                  cx={dot.x}
                  cy={dot.y}
                  r="2.4"
                  fill="currentColor"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-4" aria-label="Speaking level legend">
        {levels.map((level) => (
          <li
            key={level}
            className={`flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] ${LEVEL_COLOR[level]}`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {level}
          </li>
        ))}
      </ul>
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
