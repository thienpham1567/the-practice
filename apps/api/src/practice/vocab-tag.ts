import { normalizeWord } from "./vocab-match";
import type { VocabSuggestItem } from "./vocab.service";

export function tagReviewVocabulary<T extends { word: string }>(
  vocabulary: T[],
  candidates: VocabSuggestItem[],
): Array<T & { review?: true }> {
  if (candidates.length === 0) return vocabulary;

  const reviewWords = new Set(
    candidates.map((item) => normalizeWord(item.word)).filter(Boolean),
  );

  return vocabulary.map((item) => {
    if (reviewWords.has(normalizeWord(item.word))) {
      return { ...item, review: true as const };
    }
    return item;
  });
}
