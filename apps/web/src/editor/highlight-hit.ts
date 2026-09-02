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
 * Span tại một offset. Khi nhiều span lồng nhau (trạng từ nằm trong câu khó),
 * trả về cái hẹp nhất — lời khuyên cụ thể hơn.
 *
 * Generic theo hình dạng span để dùng được cho cả highlight văn phong lẫn lỗi
 * ngôn ngữ, mà caller vẫn nhận lại đúng kiểu mình truyền vào.
 */
export function findSpanAtOffset<T extends { start: number; end: number }>(
  spans: T[],
  offset: number,
): T | null {
  let best: T | null = null;

  for (const span of spans) {
    if (offset < span.start || offset >= span.end) continue;

    const width = span.end - span.start;
    if (!best || width < best.end - best.start) best = span;
  }

  return best;
}
