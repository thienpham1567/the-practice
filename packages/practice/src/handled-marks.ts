import type { WritingMark } from "./types";

/**
 * Định danh một mark trong phạm vi một bài. Dùng span vì `resolveWritingMarks`
 * đã bỏ mark trùng span y hệt, nên khoá này duy nhất theo cách dựng — và mark
 * của một bài đã nộp thì không đổi nữa, nên nó ổn định.
 */
export function markKey(mark: Pick<WritingMark, "start" | "end">): string {
  return `${mark.start}:${mark.end}`;
}

/**
 * Bao nhiêu mark đã được đánh dấu xử lý, trên tổng số. Đếm theo mark hiện có
 * chứ không theo số khoá đã lưu: khoá cũ không khớp mark nào thì bỏ qua, để
 * không bao giờ đếm vượt tổng.
 */
export function countHandled(
  marks: WritingMark[],
  handled: string[],
): { handled: number; total: number } {
  const keys = new Set(handled);
  return {
    handled: marks.filter((mark) => keys.has(markKey(mark))).length,
    total: marks.length,
  };
}
