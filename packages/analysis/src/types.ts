/**
 * Loại vấn đề văn phong. Mỗi loại tương ứng một màu highlight trong UI.
 * Web chỉ đọc `type` để chọn màu — không cần biết rule nào sinh ra highlight.
 */
export type HighlightType =
  | "hard-sentence"
  | "very-hard-sentence"
  | "passive"
  | "adverb"
  | "qualifier"
  | "complex-phrase";

/** Một đoạn văn bản cần chú ý, định vị bằng offset ký tự trên text gốc. */
export interface Highlight {
  /** Offset ký tự bắt đầu (inclusive). */
  start: number;
  /** Offset ký tự kết thúc (exclusive). */
  end: number;
  type: HighlightType;
  /** Gợi ý thay thế, chỉ có với complex-phrase và qualifier. */
  suggestion?: string;
}

/** Số lượng từng loại vấn đề, dùng cho sidebar. */
export interface IssueCounts {
  veryHardSentences: number;
  hardSentences: number;
  adverbs: number;
  passives: number;
  qualifiers: number;
  complexPhrases: number;
}

/** Thống kê văn bản. */
export interface TextStats {
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  /** Chỉ tính chữ cái và chữ số, bỏ khoảng trắng và dấu câu. */
  letters: number;
  readingTimeSeconds: number;
}

/** Nhãn đánh giá độ dễ đọc, theo ngưỡng của Hemingway. */
export type GradeLabel = "Good" | "OK" | "Poor";

/**
 * Ngưỡng "bao nhiêu là chấp nhận được" cho văn bản có độ dài này, dùng cho các
 * dòng kiểu "3 adverbs, meeting the goal of 3 or fewer".
 *
 * Nằm ở đây thay vì ở UI vì đây là luật văn phong, không phải chuyện hiển thị.
 */
export interface IssueGoals {
  adverbs: number;
  passives: number;
}

/** Câu, cắt gọn còn đúng những gì caller ngoài package cần: vị trí và nội dung. */
export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export interface SentenceContext {
  sentence: SentenceSpan;
  previous: SentenceSpan | null;
  next: SentenceSpan | null;
}

export interface AnalysisResult {
  highlights: Highlight[];
  counts: IssueCounts;
  goals: IssueGoals;
  stats: TextStats;
  /** Grade level theo Automated Readability Index, đã làm tròn. */
  grade: number;
  gradeLabel: GradeLabel;
}
