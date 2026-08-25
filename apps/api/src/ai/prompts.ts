import type { RewriteIssueType } from "./dto/rewrite.dto";

/** Chỉ dẫn riêng cho từng loại vấn đề — cùng lý do highlight đó tồn tại. */
const INSTRUCTIONS: Record<RewriteIssueType, string> = {
  passive: "Rewrite it in active voice: name who does the action and put them before the verb.",
  "very-hard-sentence": "Split it into shorter sentences, or cut what it does not need.",
  "hard-sentence": "Shorten it, or break it where the thought turns.",
  adverb: "Replace the weak adverb with a single stronger verb.",
  qualifier: "Remove the hedging phrase and state the point directly.",
  "complex-phrase": "Replace complex words with simpler, everyday ones.",
  selection: "Make it clearer and more concise, in the style of the Hemingway app.",
};

export function buildRewritePrompt(
  text: string,
  issueType: RewriteIssueType,
  context?: string,
): string {
  const instruction = INSTRUCTIONS[issueType];
  const surrounding = context ? `\n\nSurrounding context (for meaning only, do not rewrite it): "${context}"` : "";

  return (
    `You are editing a sentence for clarity, in the style of the Hemingway app.\n\n` +
    `Sentence: "${text}"\n\n` +
    `Task: ${instruction}\n\n` +
    `Keep the same meaning and tone. Reply with exactly two alternative rewrites, ` +
    `one per line, no numbering, no quotation marks, no explanation.${surrounding}`
  );
}

/** Mô hình đôi khi vẫn đánh số hoặc bọc dấu ngoặc kép dù đã dặn — dọn sạch trước khi trả về client. */
export function parseSuggestions(content: string): string[] {
  return content
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/^["']|["']$/g, "")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .slice(0, 2);
}
