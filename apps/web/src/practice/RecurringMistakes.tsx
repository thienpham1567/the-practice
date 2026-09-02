import { MARK_LABELS, type MarkTally, type MistakeProfile } from "@writing-helper/practice";

const ARROW: Record<NonNullable<MarkTally["trend"]>, string> = {
  down: "↓",
  flat: "→",
  up: "↑",
};

/**
 * Hidden until a pattern exists — a box saying "not enough data" only adds
 * noise to a page the learner opened to see how they are doing.
 */
export function RecurringMistakes({ profile }: { profile: MistakeProfile | undefined }) {
  if (!profile || profile.tallies.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Recurring
      </h2>
      <ul className="mt-3 space-y-2">
        {profile.tallies.slice(0, 5).map((tally) => (
          <li key={tally.category} className="flex items-baseline gap-3">
            <span className="font-display text-lg">{MARK_LABELS[tally.category]}</span>
            <span className="font-mono text-[0.7rem] text-ink-faint">{tally.count}</span>
            {tally.trend && (
              <span
                aria-label={tally.trend}
                className={tally.trend === "down" ? "text-ink-soft" : "text-vermilion"}
              >
                {ARROW[tally.trend]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
