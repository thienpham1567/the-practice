import { automatedReadabilityIndex, countLetters } from "../readability.js";
import type { Rule } from "./rule.js";
import type { Highlight } from "../types.js";

/**
 * Câu ngắn không bao giờ bị đánh dấu, kể cả khi dùng từ khó — cắt câu ngắn đã
 * là cách sửa mà Hemingway muốn khuyến khích.
 */
const MIN_WORDS = 14;

/** Từ ngưỡng này trở lên là rất khó (đỏ); dưới nó nhưng từ 10 trở lên là khó (vàng). */
const VERY_HARD_GRADE = 14;
const HARD_GRADE = 10;

export const sentenceDifficultyRule: Rule = (sentences) => {
  const highlights: Highlight[] = [];

  for (const sentence of sentences) {
    const wordCount = sentence.words.length;
    if (wordCount < MIN_WORDS) continue;

    const grade = automatedReadabilityIndex(countLetters(sentence.text), wordCount, 1);
    if (grade < HARD_GRADE) continue;

    highlights.push({
      start: sentence.start,
      end: sentence.end,
      type: grade >= VERY_HARD_GRADE ? "very-hard-sentence" : "hard-sentence",
    });
  }

  return highlights;
};
