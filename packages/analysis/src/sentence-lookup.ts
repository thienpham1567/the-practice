import { splitSentences } from "./tokenize.js";
import type { SentenceContext } from "./types.js";

/**
 * Tìm câu chứa offset ký tự cho trước, kèm câu liền trước/liền sau.
 *
 * Lý do tồn tại: tính năng AI rewrite cần sửa nguyên câu, kể cả khi offset chỉ
 * trỏ vào một trạng từ hay cụm từ — thay một từ mà tách rời khỏi câu chứa nó
 * thì vô nghĩa. Đây không phải rò rỉ cơ chế `Rule` nội bộ, mà là một khả năng
 * hẹp, độc lập, có caller thật thứ hai (ngoài `analyze()`) cần đến.
 */
export function locateSentence(text: string, offset: number): SentenceContext | null {
  const sentences = splitSentences(text);
  const index = sentences.findIndex((sentence) => offset >= sentence.start && offset < sentence.end);
  if (index === -1) return null;

  const toSpan = (sentence: (typeof sentences)[number]) => ({
    text: sentence.text,
    start: sentence.start,
    end: sentence.end,
  });

  return {
    sentence: toSpan(sentences[index]!),
    previous: index > 0 ? toSpan(sentences[index - 1]!) : null,
    next: index < sentences.length - 1 ? toSpan(sentences[index + 1]!) : null,
  };
}
