import { describe, expect, it } from "vitest";
import { splitSentences } from "../tokenize.js";
import { sentenceDifficultyRule } from "./sentence-difficulty.js";

function run(text: string) {
  return sentenceDifficultyRule(splitSentences(text), text);
}

const SIMPLE = "The cat sat on the mat and then it got up and ran away fast.";
const HARD =
  "The organization will deliver the analysis to every member before the final quarterly meeting.";
const VERY_HARD =
  "The organization will immediately deliver the comprehensive analysis to every participating member before the final quarterly meeting.";

describe("sentenceDifficultyRule", () => {
  it("đánh dấu câu khó là hard-sentence", () => {
    const highlights = run(HARD);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.type).toBe("hard-sentence");
  });

  it("đánh dấu câu rất khó là very-hard-sentence", () => {
    const highlights = run(VERY_HARD);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.type).toBe("very-hard-sentence");
  });

  it("bỏ qua câu dài nhưng dễ đọc", () => {
    expect(run(SIMPLE)).toEqual([]);
  });

  it("không bao giờ đánh dấu câu dưới 14 từ dù dùng từ khó", () => {
    expect(run("Extraordinarily sophisticated architectural considerations dominated.")).toEqual(
      [],
    );
  });

  it("highlight trải trọn câu", () => {
    const highlights = run(HARD);

    expect(HARD.slice(highlights[0]!.start, highlights[0]!.end)).toBe(HARD);
  });

  it("xét từng câu độc lập trong một đoạn", () => {
    const text = `${SIMPLE} ${VERY_HARD}`;
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]!.type).toBe("very-hard-sentence");
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe(VERY_HARD);
  });

  it("trả về mảng rỗng với văn bản rỗng", () => {
    expect(run("")).toEqual([]);
  });
});
