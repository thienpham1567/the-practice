import { IRREGULAR_PARTICIPLES, STATE_ADJECTIVES } from "./data/participles.js";
import type { Rule } from "./rule.js";
import type { Highlight } from "../types.js";

const TO_BE = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);

/** Từ được phép chen giữa to-be và phân từ mà không phá cấu trúc bị động. */
const SKIPPABLE = new Set([
  "not",
  "never",
  "also",
  "already",
  "still",
  "just",
  "often",
  "always",
  "then",
  "now",
  "being",
  "been",
]);

/** Số từ tối đa được phép chen giữa. Xa hơn thì hai từ khó còn liên quan. */
const MAX_GAP = 3;

function isSkippable(word: string): boolean {
  return SKIPPABLE.has(word) || word.endsWith("ly");
}

function isParticiple(word: string): boolean {
  if (STATE_ADJECTIVES.has(word)) return false;
  if (IRREGULAR_PARTICIPLES.has(word)) return true;

  // Phân từ quy tắc. Loại "ed" trần và các từ quá ngắn để là động từ.
  return word.endsWith("ed") && word.length > 3;
}

export const passiveRule: Rule = (sentences) => {
  const highlights: Highlight[] = [];

  for (const sentence of sentences) {
    const { words } = sentence;

    for (let i = 0; i < words.length; i++) {
      if (!TO_BE.has(words[i]!.text.toLowerCase())) continue;

      // Tìm phân từ trong vài từ kế tiếp, cho phép trạng từ và phủ định chen giữa.
      let j = i + 1;
      while (j < words.length && j - i <= MAX_GAP && isSkippable(words[j]!.text.toLowerCase())) {
        j++;
      }

      if (j >= words.length || j - i > MAX_GAP) continue;
      if (!isParticiple(words[j]!.text.toLowerCase())) continue;

      highlights.push({
        start: words[i]!.start,
        end: words[j]!.end,
        type: "passive",
      });

      // Nhảy qua phân từ để "is being done" không bị đếm lại từ "being".
      i = j;
    }
  }

  return highlights;
};
