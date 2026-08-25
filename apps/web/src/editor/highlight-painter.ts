import type { Highlight as TextHighlight, HighlightType } from "@writing-helper/analysis";
import { rangeFor, type TextIndex } from "./text-index";

/**
 * Tô highlight bằng CSS Custom Highlight API: trình duyệt vẽ trực tiếp lên
 * range, không cần chèn thẻ nào vào DOM.
 *
 * Đổi lại là highlight không bắt được sự kiện chuột — việc đó do
 * `highlight-hit.ts` lo bằng cách dò con trỏ.
 */

const REGISTRY_PREFIX = "wh-";

/**
 * Highlight cấp câu vẽ dưới, highlight cấp từ vẽ đè lên: lời khuyên cụ thể
 * (bỏ trạng từ này) hữu ích hơn lời khuyên chung (câu này dài).
 */
const SENTENCE_TYPES = new Set<HighlightType>(["hard-sentence", "very-hard-sentence"]);

const ALL_TYPES: HighlightType[] = [
  "very-hard-sentence",
  "hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
];

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

export function paintHighlights(index: TextIndex, highlights: TextHighlight[]): void {
  if (!highlightsSupported()) return;

  const byType = new Map<HighlightType, Range[]>();

  for (const highlight of highlights) {
    const range = rangeFor(index, highlight.start, highlight.end);
    if (!range) continue;

    const ranges = byType.get(highlight.type);
    if (ranges) ranges.push(range);
    else byType.set(highlight.type, [range]);
  }

  for (const type of ALL_TYPES) {
    const ranges = byType.get(type);
    const name = REGISTRY_PREFIX + type;

    if (!ranges || ranges.length === 0) {
      CSS.highlights.delete(name);
      continue;
    }

    const painted = new Highlight(...ranges);
    painted.priority = SENTENCE_TYPES.has(type) ? 0 : 1;
    CSS.highlights.set(name, painted);
  }
}

export function clearHighlights(): void {
  if (!highlightsSupported()) return;

  for (const type of ALL_TYPES) CSS.highlights.delete(REGISTRY_PREFIX + type);
}
