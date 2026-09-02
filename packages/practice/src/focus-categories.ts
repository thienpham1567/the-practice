import { MARK_CATEGORIES, MARK_SEVERITY } from "./mark-catalog";
import type { MarkCategory, WritingMark } from "./types";

/**
 * The few groups worth fixing first in one paper. "error" tier only: telling a
 * learner to polish word choice while their grammar is still wrong is the
 * wrong order.
 *
 * Deliberately unrelated to the recurring profile — the results screen is
 * about the paper just written, /progress is about the long-term trend.
 */
export function focusCategories(marks: WritingMark[], limit = 3): MarkCategory[] {
  const counts = new Map<MarkCategory, number>();

  for (const mark of marks) {
    if (MARK_SEVERITY[mark.category] !== "error") continue;
    counts.set(mark.category, (counts.get(mark.category) ?? 0) + 1);
  }

  return MARK_CATEGORIES.filter((category) => counts.has(category))
    .sort((a, b) => counts.get(b)! - counts.get(a)!)
    .slice(0, limit);
}
