import type { Enhancement } from "@writing-helper/practice";
import { locateQuote } from "../common/locate-quote";
import type { RawEnhancement } from "./mark-prompt";

/**
 * Same shape as `resolveWritingMarks` but for enhancements — no category/
 * severity to validate, so there's less to drop a bad item for.
 */
export function resolveEnhancements(
  plainText: string,
  raw: RawEnhancement[],
): Enhancement[] {
  const resolved: Enhancement[] = [];
  const takenSpans = new Set<string>();

  for (const item of raw) {
    const found = locateQuote(plainText, item.quote ?? "", item.occurrence ?? 1);
    if (!found) continue;

    const span = `${found.start}:${found.end}`;
    if (takenSpans.has(span)) continue;
    takenSpans.add(span);

    resolved.push({
      start: found.start,
      end: found.end,
      suggestion: item.suggestion,
      note: item.note,
    });
  }

  return resolved.sort((a, b) => a.start - b.start);
}
