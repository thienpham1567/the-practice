import type { Level } from "@writing-helper/practice";
import { chartDots, polyline, type BandPoint } from "./band-chart";
import { bandSeriesByLevel } from "./progress-series";
import type { ProgressSeriesPoint } from "./level-up";

const WIDTH = 560;
const HEIGHT = 140;

const LEVEL_ORDER: Level[] = ["A2", "B1", "B2", "C1"];

/** Distinct series colors per CEFR level (tokens in index.css). */
const LEVEL_COLOR: Record<Level, string> = {
  A2: "text-level-a2",
  B1: "text-level-b1",
  B2: "text-level-b2",
  C1: "text-level-c1",
};

interface ProgressBandChartProps {
  series: ProgressSeriesPoint[];
}

export function ProgressBandChart({ series }: ProgressBandChartProps) {
  const byLevel = bandSeriesByLevel(series);
  const levels = LEVEL_ORDER.filter((level) => byLevel.has(level));

  const allTimes = series.map((point) => new Date(point.at).getTime());
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const scale = { minT, maxT };

  return (
    <section aria-label="Band over time by level">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Band over time
      </h2>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full text-ink"
        role="img"
        aria-label={`Band scores across ${levels.length} ${levels.length === 1 ? "level" : "levels"}`}
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
        {levels.map((level) => {
          const points = byLevel.get(level) as BandPoint[];
          const dots = chartDots(points, WIDTH, HEIGHT, scale);
          const color = LEVEL_COLOR[level];
          return (
            <g key={level} className={color}>
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

      <ul className="mt-3 flex flex-wrap gap-4" aria-label="Level legend">
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
