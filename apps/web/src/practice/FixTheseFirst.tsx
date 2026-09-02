import { MARK_LABELS, focusCategories, type WritingMark } from "@writing-helper/practice";

/**
 * A starting point: a paper with 30 underlines tells the learner nothing about
 * where to begin.
 *
 * `null` means extraction failed — stay silent, which is a different thing
 * from a paper that came back clean.
 */
export function FixTheseFirst({ marks }: { marks: WritingMark[] | null }) {
  if (!marks) return null;

  const focus = focusCategories(marks);

  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
        Fix these first
      </h2>
      {focus.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Nothing to fix in this paper. Well done.
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {focus.map((category, position) => (
            <li key={category} className="font-display text-lg leading-snug">
              <span className="mr-2 font-mono text-[0.7rem] text-ink-faint">{position + 1}</span>
              {MARK_LABELS[category]}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
