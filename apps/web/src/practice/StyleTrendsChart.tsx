import { chartDots, polyline } from "./band-chart";
import { per100Series } from "./progress-series";
import type { ProgressSeriesPoint } from "./level-up";

const WIDTH = 560;
const HEIGHT = 120;

interface StyleTrendsChartProps {
  series: ProgressSeriesPoint[];
}

export function StyleTrendsChart({ series }: StyleTrendsChartProps) {
  const points = per100Series(series);
  if (points.length === 0) return null;

  const times = points.map((point) => point.at);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const valueMax = Math.max(
    ...points.flatMap((point) => [point.passives, point.adverbs]),
    1,
  );
  const scale = { minT, maxT, valueMax };

  const passives = chartDots(
    points.map((point) => ({ at: point.at, band: point.passives })),
    WIDTH,
    HEIGHT,
    scale,
  );
  const adverbs = chartDots(
    points.map((point) => ({ at: point.at, band: point.adverbs })),
    WIDTH,
    HEIGHT,
    scale,
  );

  return (
    <section aria-label="Style trends">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Style per 100 words
      </h2>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-4 w-full text-ink"
        role="img"
        aria-label="Passives and adverbs per 100 words"
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
        <g className="text-ink">
          {passives.length > 1 && (
            <polyline
              data-series="passives"
              points={polyline(passives)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )}
          {passives.map((dot, index) => (
            <circle
              key={`passives-${index}`}
              data-series="passives"
              cx={dot.x}
              cy={dot.y}
              r="2.2"
              fill="currentColor"
            />
          ))}
        </g>
        <g className="text-vermilion">
          {adverbs.length > 1 && (
            <polyline
              data-series="adverbs"
              points={polyline(adverbs)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )}
          {adverbs.map((dot, index) => (
            <circle
              key={`adverbs-${index}`}
              data-series="adverbs"
              cx={dot.x}
              cy={dot.y}
              r="2.2"
              fill="currentColor"
            />
          ))}
        </g>
      </svg>

      <ul className="mt-3 flex flex-wrap gap-4" aria-label="Style legend">
        <li className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          Passives
        </li>
        <li className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-vermilion">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          Adverbs
        </li>
      </ul>
    </section>
  );
}
