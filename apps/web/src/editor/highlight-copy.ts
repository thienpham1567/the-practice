import type { Highlight, HighlightType } from "@writing-helper/analysis";

/** Nhãn ngắn và lời khuyên cho từng loại highlight. */
const COPY: Record<HighlightType, { label: string; advice: string }> = {
  "very-hard-sentence": {
    label: "Very hard to read",
    advice: "Split this sentence in two, or cut what it does not need.",
  },
  "hard-sentence": {
    label: "Hard to read",
    advice: "Shorten this sentence, or break it where the thought turns.",
  },
  passive: {
    label: "Passive voice",
    advice: "Name who does the action and put them in front of the verb.",
  },
  adverb: {
    label: "Adverb",
    advice: "A stronger verb usually does this work on its own.",
  },
  qualifier: {
    label: "Weakening phrase",
    advice: "Say it plainly. The hedge only softens your point.",
  },
  "complex-phrase": {
    label: "Simpler alternative",
    advice: "",
  },
};

export interface HighlightCopy {
  label: string;
  advice: string;
}

export function describeHighlight(highlight: Highlight): HighlightCopy {
  const base = COPY[highlight.type];
  if (highlight.type !== "complex-phrase") return base;

  // Gợi ý rỗng nghĩa là cụm này bỏ đi được, không phải thay bằng gì.
  const advice =
    highlight.suggestion === undefined || highlight.suggestion === ""
      ? "This phrase adds nothing. Cut it."
      : `Try: ${highlight.suggestion}`;

  return { label: base.label, advice };
}
