import { lastFourteenDays } from "./exam-math";

interface StreakStripProps {
  submittedDates: Date[];
  current: number;
}

/**
 * Fourteen tally boxes, oldest on the left — a manuscript mark, not a flame icon.
 */
export function StreakStrip({ submittedDates, current }: StreakStripProps) {
  const days = lastFourteenDays(submittedDates);

  return (
    <section aria-label="Fourteen-day writing streak">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
          Streak
        </h2>
        <p className="font-display text-lg leading-none">
          {current}
          <span className="ml-1 font-body text-sm text-ink-faint">
            {current === 1 ? "day" : "days"}
          </span>
        </p>
      </div>

      <ol className="mt-3 flex gap-1">
        {days.map((filled, index) => (
          <li
            key={index}
            className={`h-6 flex-1 border ${
              filled ? "border-vermilion bg-vermilion/80" : "border-rule bg-paper"
            }`}
            title={filled ? "Written" : "Missed"}
          >
            <span className="sr-only">{filled ? "Written" : "Missed"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
