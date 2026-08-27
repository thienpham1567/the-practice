import type { ProgressScores, ProgressSeriesPoint } from "./level-up";
import { chartDots, polyline } from "./band-chart";
import { criteriaAverage30d } from "./progress-series";

const WIDTH = 120;
const HEIGHT = 36;

const CRITERIA: { key: keyof ProgressScores; label: string }[] = [
  { key: "task", label: "Task" },
  { key: "coherence", label: "Coherence" },
  { key: "lexical", label: "Lexical" },
  { key: "grammar", label: "Grammar" },
];

interface CriteriaSparklinesProps {
  series: ProgressSeriesPoint[];
  now?: Date;
}

export function CriteriaSparklines({ series, now }: CriteriaSparklinesProps) {
  const summary = criteriaAverage30d(series, now);
  const weakestLabel =
    CRITERIA.find((item) => item.key === summary?.weakest)?.label ?? summary?.weakest;

  return (
    <section aria-label="Criteria trends">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Criteria
      </h2>
      {summary && weakestLabel && (
        <p className="mt-2 text-sm text-ink-soft">
          yếu nhất 30 ngày: {weakestLabel}
        </p>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {CRITERIA.map((criterion) => {
          const points = series
            .slice()
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            .map((point) => ({
              at: new Date(point.at).getTime(),
              band: point.scores[criterion.key],
            }));
          const dots = chartDots(points, WIDTH, HEIGHT);

          return (
            <li key={criterion.key}>
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                {criterion.label}
              </h3>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="mt-1 w-full text-ink"
                role="img"
                aria-label={`${criterion.label} sparkline`}
              >
                {dots.length > 1 && (
                  <polyline
                    points={polyline(dots)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    className="text-ink-soft"
                  />
                )}
                {dots.map((dot, index) => (
                  <circle
                    key={`${criterion.key}-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r="1.8"
                    fill="currentColor"
                    className="text-vermilion"
                  />
                ))}
              </svg>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
