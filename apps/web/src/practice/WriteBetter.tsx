import type { Enhancement } from "@writing-helper/practice";

/**
 * Style upgrades on already-correct text — never mistakes, so no checkbox and
 * no count toward "to fix". `null` means extraction failed (goes with
 * `marks: null`); `[]` means the response was already strong throughout.
 */
export function WriteBetter({
  enhancements,
  plainText,
}: {
  enhancements: Enhancement[] | null;
  plainText: string;
}) {
  if (!enhancements || enhancements.length === 0) return null;

  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Could read better
      </h2>
      <ul className="mt-4 space-y-4">
        {enhancements.map((item) => {
          const quote = plainText.slice(item.start, item.end);
          return (
            <li
              key={`${item.start}:${item.end}`}
              className="border-l-2 border-rule pl-3 text-sm leading-snug"
            >
              <span className="text-ink-soft">{quote}</span>
              <span className="text-ink-faint"> → </span>
              <span className="font-display">{item.suggestion}</span>
              <span className="mt-1 block text-ink-faint">{item.note}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
