import type { Rule } from "./rule.js";
import type { Highlight } from "../types.js";

/**
 * Từ kết thúc bằng "-ly" nhưng không phải trạng từ: danh từ, tính từ, tên riêng.
 * Thiếu danh sách này thì "family" hay "supply" sẽ bị đánh dấu oan.
 */
const NOT_ADVERBS = new Set([
  "ally",
  "anomaly",
  "apply",
  "assembly",
  "belly",
  "brotherly",
  "bully",
  "burly",
  "butterfly",
  "chilly",
  "comply",
  "costly",
  "cowardly",
  "curly",
  "daily",
  "deadly",
  "dilly",
  "disorderly",
  "dolly",
  "early",
  "elderly",
  "family",
  "filly",
  "fly",
  "folly",
  "friendly",
  "gnarly",
  "godly",
  "gully",
  "heavenly",
  "hilly",
  "holly",
  "holy",
  "homely",
  "imply",
  "italy",
  "jelly",
  "jolly",
  "july",
  "likely",
  "lonely",
  "lovely",
  "melancholy",
  "monopoly",
  "monthly",
  "motherly",
  "multiply",
  "oily",
  "only",
  "orderly",
  "panoply",
  "ply",
  "quarterly",
  "rally",
  "rely",
  "reply",
  "scholarly",
  "silly",
  "sisterly",
  "sly",
  "sully",
  "supply",
  "surly",
  "tally",
  "timely",
  "ugly",
  "unlikely",
  "unruly",
  "weekly",
  "wily",
  "worldly",
  "yearly",
]);

/** Độ dài tối thiểu để một từ "-ly" đáng xét (loại "ly", "fly"...). */
const MIN_LENGTH = 4;

export const adverbRule: Rule = (sentences) => {
  const highlights: Highlight[] = [];

  for (const sentence of sentences) {
    for (const word of sentence.words) {
      const lower = word.text.toLowerCase();
      if (lower.length < MIN_LENGTH) continue;
      if (!lower.endsWith("ly")) continue;
      if (NOT_ADVERBS.has(lower)) continue;

      highlights.push({ start: word.start, end: word.end, type: "adverb" });
    }
  }

  return highlights;
};
