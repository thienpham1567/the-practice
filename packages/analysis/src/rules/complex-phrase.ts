import { COMPLEX_PHRASES } from "./data/complex-phrases.js";
import { createPhraseMatcher } from "./phrase-matcher.js";
import type { Rule } from "./rule.js";

const matchComplexPhrases = createPhraseMatcher(Object.keys(COMPLEX_PHRASES));

export const complexPhraseRule: Rule = (_sentences, text) =>
  matchComplexPhrases(text).map((match) => ({
    start: match.start,
    end: match.end,
    type: "complex-phrase" as const,
    suggestion: COMPLEX_PHRASES[match.phrase],
  }));
