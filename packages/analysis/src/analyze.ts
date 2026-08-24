import type { AnalysisResult } from "./types.js";

/**
 * Phân tích một đoạn văn bản tiếng Anh: tìm các vấn đề văn phong, đếm thống kê
 * và tính grade level.
 *
 * Pure function — không side effect, không dependency ngoài. Offset trong
 * `highlights` tính trên chính chuỗi `text` truyền vào.
 *
 * TODO(milestone-2): implement. Hiện trả về kết quả rỗng để scaffold chạy được.
 */
export function analyze(_text: string): AnalysisResult {
  return {
    highlights: [],
    counts: {
      veryHardSentences: 0,
      hardSentences: 0,
      adverbs: 0,
      passives: 0,
      qualifiers: 0,
      complexPhrases: 0,
    },
    stats: {
      words: 0,
      sentences: 0,
      paragraphs: 0,
      characters: 0,
      letters: 0,
      readingTimeSeconds: 0,
    },
    grade: 0,
    gradeLabel: "Good",
  };
}
