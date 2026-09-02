import type { MarkCategory, MarkSeverity } from "./types";

/**
 * The one source of the closed label set. Declaration order is also the
 * tie-break order: two categories with the same count keep this order, so it
 * must stay stable.
 */
export const MARK_CATEGORIES: readonly MarkCategory[] = [
  "article",
  "verb-tense",
  "subject-verb-agreement",
  "noun-number",
  "preposition",
  "word-order",
  "word-form",
  "spelling",
  "punctuation",
  "sentence-structure",
  "pronoun",
  "word-choice",
  "register",
];

/**
 * Severity belongs to the label, not to one occurrence of it — so it is
 * derived here rather than asked of the model, which would only invite
 * contradictions like `article` + `refinement`.
 */
export const MARK_SEVERITY: Record<MarkCategory, MarkSeverity> = {
  article: "error",
  "verb-tense": "error",
  "subject-verb-agreement": "error",
  "noun-number": "error",
  preposition: "error",
  "word-order": "error",
  "word-form": "error",
  spelling: "error",
  punctuation: "error",
  "sentence-structure": "error",
  pronoun: "error",
  "word-choice": "refinement",
  register: "refinement",
};

export const MARK_LABELS: Record<MarkCategory, string> = {
  article: "Articles",
  "verb-tense": "Verb tense",
  "subject-verb-agreement": "Subject-verb agreement",
  "noun-number": "Singular / plural",
  preposition: "Prepositions",
  "word-order": "Word order",
  "word-form": "Word form",
  spelling: "Spelling",
  punctuation: "Punctuation",
  "sentence-structure": "Sentence structure",
  pronoun: "Pronouns",
  "word-choice": "Word choice",
  register: "Register",
};
