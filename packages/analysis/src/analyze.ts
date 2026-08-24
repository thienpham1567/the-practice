import { automatedReadabilityIndex, countLetters, gradeLabelFor } from "./readability.js";
import { adverbRule } from "./rules/adverb.js";
import { complexPhraseRule } from "./rules/complex-phrase.js";
import { passiveRule } from "./rules/passive.js";
import { qualifierRule } from "./rules/qualifier.js";
import type { Rule } from "./rules/rule.js";
import { sentenceDifficultyRule } from "./rules/sentence-difficulty.js";
import { countParagraphs, splitSentences, splitWords } from "./tokenize.js";
import type { AnalysisResult, Highlight, IssueCounts } from "./types.js";

/**
 * Thêm rule mới chỉ cần thêm một mục vào đây — orchestrator không biết rule nào
 * làm gì, chỉ biết chúng cùng nhận câu và trả highlight.
 */
const RULES: Rule[] = [
  sentenceDifficultyRule,
  passiveRule,
  adverbRule,
  qualifierRule,
  complexPhraseRule,
];

const WORDS_PER_MINUTE = 250;

/** Một adverb cho mỗi 100 từ. */
const WORDS_PER_ALLOWED_ADVERB = 100;

/** Tối đa một phần năm số câu được phép ở thể bị động. */
const PASSIVE_SENTENCE_RATIO = 0.2;

function countByType(highlights: Highlight[]): IssueCounts {
  const counts: IssueCounts = {
    veryHardSentences: 0,
    hardSentences: 0,
    adverbs: 0,
    passives: 0,
    qualifiers: 0,
    complexPhrases: 0,
  };

  for (const highlight of highlights) {
    switch (highlight.type) {
      case "very-hard-sentence":
        counts.veryHardSentences++;
        break;
      case "hard-sentence":
        counts.hardSentences++;
        break;
      case "adverb":
        counts.adverbs++;
        break;
      case "passive":
        counts.passives++;
        break;
      case "qualifier":
        counts.qualifiers++;
        break;
      case "complex-phrase":
        counts.complexPhrases++;
        break;
    }
  }

  return counts;
}

/**
 * Phân tích một đoạn văn bản tiếng Anh: tìm các vấn đề văn phong, đếm thống kê
 * và tính grade level.
 *
 * Pure function — không side effect, không dependency ngoài. Offset trong
 * `highlights` tính trên chính chuỗi `text` truyền vào.
 */
export function analyze(text: string): AnalysisResult {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const letters = countLetters(text);

  const highlights = RULES.flatMap((rule) => rule(sentences, text)).sort(
    // Cùng vị trí thì span dài hơn đứng trước, để highlight câu bao ngoài
    // highlight từ nằm trong nó.
    (a, b) => a.start - b.start || b.end - a.end,
  );

  const grade = automatedReadabilityIndex(letters, words.length, sentences.length);

  return {
    highlights,
    counts: countByType(highlights),
    goals: {
      adverbs: Math.max(1, Math.round(words.length / WORDS_PER_ALLOWED_ADVERB)),
      passives: Math.max(1, Math.round(sentences.length * PASSIVE_SENTENCE_RATIO)),
    },
    stats: {
      words: words.length,
      sentences: sentences.length,
      paragraphs: countParagraphs(text),
      characters: text.length,
      letters,
      readingTimeSeconds: Math.round((words.length / WORDS_PER_MINUTE) * 60),
    },
    grade,
    gradeLabel: gradeLabelFor(grade),
  };
}
