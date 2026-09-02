import { MARK_CATEGORIES, MARK_SEVERITY } from "@writing-helper/practice";
import type { WritingMark } from "@writing-helper/practice";
import { locateQuote } from "../common/locate-quote";
import type { RawWritingMark } from "./mark-prompt";

const KNOWN_CATEGORIES = new Set<string>(MARK_CATEGORIES);

/**
 * Turn the model's verbatim quotes into offsets on the submitted text.
 *
 * Every failure mode drops the one mark and keeps the rest: losing a single
 * underline beats failing the whole results screen over one bad item.
 */
export function resolveWritingMarks(
  plainText: string,
  raw: RawWritingMark[],
): WritingMark[] {
  const resolved: WritingMark[] = [];
  const takenSpans = new Set<string>();

  for (const item of raw) {
    if (!KNOWN_CATEGORIES.has(item.category)) continue;

    const found = locateQuote(plainText, item.quote ?? "", item.occurrence ?? 1);
    if (!found) continue;

    const span = `${found.start}:${found.end}`;
    if (takenSpans.has(span)) continue;
    takenSpans.add(span);

    resolved.push({
      start: found.start,
      end: found.end,
      category: item.category,
      severity: MARK_SEVERITY[item.category],
      correction: item.correction,
      note: item.note,
    });
  }

  return resolved.sort((a, b) => a.start - b.start);
}
