import { locateSentence, type Highlight } from "@writing-helper/analysis";
import type { RewriteInput } from "../api/ai";

export interface RewriteRequestSpan {
  input: RewriteInput;
  /** Vùng trên text gốc mà `input.text` phủ đúng — dùng để thay thế khi Apply. */
  start: number;
  end: number;
}

/**
 * Dựng request cho `/ai/rewrite` từ một highlight bị click.
 *
 * Luôn gửi nguyên câu chứa highlight, không phải chỉ đúng đoạn bị đánh dấu:
 * bảo AI "viết lại" một mình từ "quickly" là vô nghĩa — phải thấy cả câu mới
 * biết sửa thế nào. `context` là câu liền trước và liền sau, giúp mô hình giữ
 * đúng mạch văn.
 */
export function buildRewriteRequest(fullText: string, highlight: Highlight): RewriteRequestSpan | null {
  const located = locateSentence(fullText, highlight.start);
  if (!located) return null;

  const context = [located.previous?.text, located.next?.text].filter(Boolean).join(" ");

  return {
    input: {
      text: located.sentence.text,
      issueType: highlight.type,
      ...(context ? { context } : {}),
    },
    start: located.sentence.start,
    end: located.sentence.end,
  };
}

/**
 * Dựng request cho vùng người dùng tự bôi đen — "Fix selection". Context lấy
 * từ câu liền trước điểm bắt đầu và câu liền sau điểm kết thúc, vì lựa chọn có
 * thể trải dài qua nhiều câu.
 */
export function buildSelectionRewriteRequest(
  fullText: string,
  start: number,
  end: number,
): RewriteRequestSpan | null {
  const raw = fullText.slice(start, end);
  const leading = raw.length - raw.trimStart().length;
  const trailing = raw.length - raw.trimEnd().length;
  const text = raw.trim();
  if (!text) return null;

  const trimmedStart = start + leading;
  const trimmedEnd = end - trailing;

  const before = locateSentence(fullText, trimmedStart);
  const after = locateSentence(fullText, Math.max(trimmedEnd - 1, trimmedStart));
  const context = [before?.previous?.text, after?.next?.text].filter(Boolean).join(" ");

  return {
    input: {
      text,
      issueType: "selection",
      ...(context ? { context } : {}),
    },
    start: trimmedStart,
    end: trimmedEnd,
  };
}
