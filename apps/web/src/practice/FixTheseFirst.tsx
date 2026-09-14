import { MARK_LABELS, focusCategories, type WritingMark } from "@writing-helper/practice";
import { MARK_HIGHLIGHT_GROUP } from "../editor/mark-highlight-groups";

/**
 * A starting point: a paper with 30 underlines tells the learner nothing about
 * where to begin. Each category gets its most representative instance
 * (quote → correction) so "Verb tense" is a concrete edit, not a vague label.
 *
 * The left-edge color matches the highlight color for that category in the
 * editor (same `MARK_HIGHLIGHT_GROUP` token) — the list and the underlying
 * paper read as one system instead of two disconnected views.
 *
 * `null` means extraction failed — stay silent, which is a different thing
 * from a paper that came back clean.
 */
export function FixTheseFirst({
  marks,
  plainText,
}: {
  marks: WritingMark[] | null;
  plainText: string;
}) {
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
        <ol className="mt-4 space-y-4">
          {focus.map((category, position) => {
            const inCategory = marks.filter((mark) => mark.category === category);
            const example = inCategory[0]!;
            const dotColor = `var(--color-mistake-${MARK_HIGHLIGHT_GROUP[category]})`;
            return (
              <li key={category} className="border-l-2 pl-3" style={{ borderColor: dotColor }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.65rem] text-ink-faint">{position + 1}</span>
                  <h3 className="font-display text-lg leading-snug">{MARK_LABELS[category]}</h3>
                  {inCategory.length > 1 && (
                    <span className="font-mono text-[0.6rem] text-ink-faint">
                      ×{inCategory.length}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed">
                  <span
                    className="text-ink-soft line-through"
                    style={{ textDecorationColor: dotColor }}
                  >
                    {plainText.slice(example.start, example.end)}
                  </span>
                  <span className="text-ink-faint"> → </span>
                  <span className="font-display">{example.correction}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
