import { chartDots, polyline, type BandPoint } from "./band-chart";

const WIDTH = 560;
const HEIGHT = 140;

interface BandChartProps {
  points: BandPoint[];
}

export function BandChart({ points }: BandChartProps) {
  const dots = chartDots(points, WIDTH, HEIGHT);

  return (
    <section aria-label="Band scores over time">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Band over time
      </h2>

      {dots.length === 0 ? (
        <p className="mt-4 text-sm italic text-ink-faint">No scores yet. Sit the first paper.</p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-4 w-full text-ink"
          role="img"
          aria-label={`${dots.length} scored ${dots.length === 1 ? "attempt" : "attempts"}`}
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
          {dots.length > 1 && (
            <polyline
              points={polyline(dots)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
              className="text-ink"
            />
          )}
          {dots.map((dot, index) => (
            <circle key={`${dot.x}-${index}`} cx={dot.x} cy={dot.y} r="2.4" fill="currentColor" />
          ))}
        </svg>
      )}
    </section>
  );
}
