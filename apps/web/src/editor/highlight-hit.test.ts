import type { Highlight } from "@writing-helper/analysis";
import { describe, expect, it } from "vitest";
import { findHighlightAtOffset } from "./highlight-hit";

const sentence: Highlight = { start: 0, end: 40, type: "hard-sentence" };
const adverb: Highlight = { start: 4, end: 11, type: "adverb" };
const complex: Highlight = { start: 20, end: 27, type: "complex-phrase", suggestion: "use" };

describe("findHighlightAtOffset", () => {
  it("tìm highlight chứa offset", () => {
    expect(findHighlightAtOffset([complex], 22)).toBe(complex);
  });

  it("ưu tiên highlight hẹp nhất khi lồng nhau", () => {
    expect(findHighlightAtOffset([sentence, adverb], 6)).toBe(adverb);
  });

  it("trả về highlight câu khi offset nằm ngoài các highlight từ", () => {
    expect(findHighlightAtOffset([sentence, adverb], 15)).toBe(sentence);
  });

  it("coi điểm cuối là nằm ngoài", () => {
    expect(findHighlightAtOffset([adverb], 11)).toBeNull();
  });

  it("nhận điểm đầu là nằm trong", () => {
    expect(findHighlightAtOffset([adverb], 4)).toBe(adverb);
  });

  it("trả về null khi không có highlight nào", () => {
    expect(findHighlightAtOffset([], 5)).toBeNull();
  });
});
