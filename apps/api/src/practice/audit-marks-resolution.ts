import type { MarkCategory, WritingMark } from "@writing-helper/practice";

export interface MarkResolution {
  quote: string;
  category: MarkCategory;
  resolved: boolean;
}

/**
 * Whether each mistake from the parent attempt is still literally present in
 * the revised text — a string check, not an AI judgment, so it can't
 * hallucinate. Observed in production testing: the AI-narrated audit once
 * insisted a mistake ("when exactly you moving") was still unresolved a full
 * round after the writer had already fixed it. A quote either appears
 * verbatim in the new text or it doesn't; there's nothing to misremember.
 *
 * Limitation, accepted in the design doc: if the writer rewrote the whole
 * sentence rather than fixing the flagged span, the old quote also
 * disappears and this reads as "resolved" even though the new phrasing
 * might contain a different mistake — that new mistake is the job of the
 * fresh mark-extraction pass on this same submission, not this check.
 *
 * Second check needed in practice: an insertion fix ("new apartment" → "a new
 * apartment") leaves the old quote sitting inside the new text as a literal
 * substring, which would otherwise read as unresolved even though it's fixed
 * — so a mark also counts as resolved when its own suggested correction shows
 * up verbatim in the new text.
 */
export function computeMarksResolution(
  parentPlainText: string,
  parentMarks: WritingMark[],
  newPlainText: string,
): MarkResolution[] {
  return parentMarks
    .map((mark) => ({ quote: parentPlainText.slice(mark.start, mark.end), mark }))
    .map(({ quote, mark }) => ({
      quote,
      category: mark.category,
      resolved:
        quote.length === 0 ||
        !newPlainText.includes(quote) ||
        newPlainText.includes(mark.correction),
    }));
}
