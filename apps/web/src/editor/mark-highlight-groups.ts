import type { MarkCategory } from "@writing-helper/practice";

/**
 * 13 mistake categories painted with 8 colors, not 13 — a categorical palette
 * stops being reliably distinguishable well before 13 (validated with the
 * dataviz skill's CVD checker: 8 hues clear the separation floor in both
 * themes, 13 pastel washes do not). Categories that are hard to tell apart
 * even for a human reader share a color; the exact category still shows as
 * text everywhere (Fix these first, the mistake popover) — color is a hint,
 * never the only signal.
 */
export type MarkHighlightGroup =
  | "style"
  | "nouns"
  | "prepositions"
  | "word-form"
  | "pronouns"
  | "structure"
  | "mechanics"
  | "verbs";

export const MARK_HIGHLIGHT_GROUP: Record<MarkCategory, MarkHighlightGroup> = {
  // The only two refinement-tier categories share the calmest color —
  // suggestions, not verdicts.
  "word-choice": "style",
  register: "style",
  article: "nouns",
  "noun-number": "nouns",
  preposition: "prepositions",
  "word-form": "word-form",
  pronoun: "pronouns",
  "word-order": "structure",
  "sentence-structure": "structure",
  spelling: "mechanics",
  punctuation: "mechanics",
  "verb-tense": "verbs",
  "subject-verb-agreement": "verbs",
};
