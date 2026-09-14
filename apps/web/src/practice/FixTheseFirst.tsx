import { MARK_LABELS, focusCategories, type WritingMark } from "@writing-helper/practice";
import {
  MARK_HIGHLIGHT_GROUP,
  MARK_HIGHLIGHT_GROUP_LABELS,
  type MarkHighlightGroup,
} from "../editor/mark-highlight-groups";

/**
 * A starting point: a paper with 30 underlines tells the learner nothing about
 * where to begin. Each category gets its most representative instance
 * (quote → correction) so "Verb tense" is a concrete edit, not a vague label.
 *
 * The left-edge color matches the highlight color for that category in the
 * editor (same `MARK_HIGHLIGHT_GROUP` token) — the list and the underlying
 * paper read as one system instead of two disconnected views. The color key
 * below it explains what each color painted on the paper means — computed
 * from every mark, not just the top 3 listed here, since the editor paints
 * all of them.
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
      {marks.length > 0 && <ColorKey marks={marks} />}
    </section>
  );
}

/** Every color painted in the paper, once each, in a fixed order — not just
 * the 3 in "Fix these first" above. */
function ColorKey({ marks }: { marks: WritingMark[] }) {
  const present = new Set(marks.map((mark) => MARK_HIGHLIGHT_GROUP[mark.category]));
  const groups = (Object.keys(MARK_HIGHLIGHT_GROUP_LABELS) as MarkHighlightGroup[]).filter(
    (group) => present.has(group),
  );

  return (
    <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-rule pt-4">
      {groups.map((group) => (
        <li
          key={group}
          className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint"
        >
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--color-mistake-${group})` }}
          />
          {MARK_HIGHLIGHT_GROUP_LABELS[group]}
        </li>
      ))}
    </ul>
  );
}
