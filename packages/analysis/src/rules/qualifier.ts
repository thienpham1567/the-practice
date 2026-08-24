import { createPhraseMatcher } from "./phrase-matcher.js";
import type { Rule } from "./rule.js";

/**
 * Cụm từ làm yếu câu văn — người viết tự rào trước thay vì nói thẳng.
 *
 * Danh sách này cố ý không chứa từ kết thúc bằng "-ly" (really, actually,
 * possibly...): adverbRule đã lo chúng, để cả hai cùng bắt thì một chỗ trong
 * văn bản sẽ bị highlight hai lần.
 */
const QUALIFIERS = [
  "a bit",
  "a little",
  "appears to",
  "fairly",
  "i believe",
  "i consider",
  "i don't believe",
  "i don't consider",
  "i don't feel",
  "i don't suggest",
  "i don't think",
  "i feel",
  "i hope to",
  "i might",
  "i suggest",
  "i think",
  "i was wondering",
  "i will try",
  "i wonder",
  "in my opinion",
  "is kind of",
  "is sort of",
  "just",
  "kind of",
  "maybe",
  "more or less",
  "perhaps",
  "quite",
  "rather",
  "seems to",
  "somewhat",
  "sort of",
  "tends to",
  "to some extent",
  "very",
  "we believe",
  "we consider",
  "we don't believe",
  "we don't consider",
  "we don't feel",
  "we don't suggest",
  "we don't think",
  "we feel",
  "we hope to",
  "we might",
  "we suggest",
  "we think",
  "we were wondering",
  "we will try",
  "we wonder",
];

const matchQualifiers = createPhraseMatcher(QUALIFIERS);

export const qualifierRule: Rule = (_sentences, text) =>
  matchQualifiers(text).map((match) => ({
    start: match.start,
    end: match.end,
    type: "qualifier" as const,
  }));
