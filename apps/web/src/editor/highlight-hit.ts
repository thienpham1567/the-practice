import type { Highlight as TextHighlight } from "@writing-helper/analysis";
import { offsetOf, type TextIndex } from "./text-index";

/**
 * Highlight vẽ bằng CSS Custom Highlight API không nhận sự kiện chuột, nên để
 * biết con trỏ đang ở highlight nào ta dò ngược: toạ độ → vị trí con trỏ văn bản
 * → offset ký tự → tra trong danh sách highlight.
 */

/** Bản của WebKit/Blink, chưa nằm trong lib DOM chuẩn. */
type LegacyCaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** Offset ký tự dưới con trỏ, hoặc null nếu con trỏ không ở trên chữ nào. */
export function offsetAtPoint(index: TextIndex, x: number, y: number): number | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) return offsetOf(index, position.offsetNode, position.offset);

  const range = (document as LegacyCaretDocument).caretRangeFromPoint?.(x, y);
  if (range) return offsetOf(index, range.startContainer, range.startOffset);

  return null;
}

/**
 * Highlight tại một offset. Khi nhiều highlight lồng nhau (trạng từ nằm trong
 * câu khó), trả về cái hẹp nhất — lời khuyên cụ thể hơn.
 */
export function findHighlightAtOffset(
  highlights: TextHighlight[],
  offset: number,
): TextHighlight | null {
  let best: TextHighlight | null = null;

  for (const highlight of highlights) {
    if (offset < highlight.start || offset >= highlight.end) continue;

    const width = highlight.end - highlight.start;
    if (!best || width < best.end - best.start) best = highlight;
  }

  return best;
}
