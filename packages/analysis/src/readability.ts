import type { GradeLabel } from "./types.js";

/**
 * Độ dễ đọc theo Automated Readability Index — công thức dựa trên ký tự thay vì
 * âm tiết, cùng họ với thang Hemingway dùng.
 * Internal — không nằm trong interface công khai của package.
 */

/** Đếm chữ cái và chữ số, bỏ khoảng trắng và dấu câu. */
export function countLetters(text: string): number {
  return text.replace(/[^A-Za-z0-9]/g, "").length;
}

/**
 * Grade level ARI, đã làm tròn. Trả về 0 khi không có từ; ngược lại không bao
 * giờ nhỏ hơn 1 (văn bản đơn giản nhất vẫn là lớp 1).
 */
export function automatedReadabilityIndex(
  letters: number,
  words: number,
  sentences: number,
): number {
  if (words === 0 || sentences === 0) return 0;

  const raw = 4.71 * (letters / words) + 0.5 * (words / sentences) - 21.43;
  return Math.max(1, Math.round(raw));
}

/** Ngưỡng đánh giá của Hemingway, dùng chung cho cả văn bản lẫn từng câu. */
export function gradeLabelFor(grade: number): GradeLabel {
  if (grade >= 14) return "Poor";
  if (grade >= 10) return "OK";
  return "Good";
}
