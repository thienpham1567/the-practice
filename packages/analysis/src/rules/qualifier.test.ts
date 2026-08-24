import { describe, expect, it } from "vitest";
import { splitSentences } from "../tokenize.js";
import { qualifierRule } from "./qualifier.js";

function run(text: string) {
  return qualifierRule(splitSentences(text), text);
}

describe("qualifierRule", () => {
  it("bắt cụm làm yếu câu văn", () => {
    const text = "I think this is right.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("I think");
    expect(highlights[0]!.type).toBe("qualifier");
  });

  it("ưu tiên cụm dài hơn", () => {
    const text = "I don't think that works.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("I don't think");
  });

  it("bắt qualifier một từ", () => {
    expect(run("It was very good.")).toHaveLength(1);
    expect(run("Maybe we should go.")).toHaveLength(1);
  });

  it("không khớp bên trong từ khác", () => {
    expect(run("The jury was justly praised.")).toEqual([]);
  });

  it("không trùng lặp với rule adverb", () => {
    // Từ kết thúc bằng -ly do adverbRule lo, qualifier không đụng vào.
    expect(run("It was really good.")).toEqual([]);
  });

  it("trả về mảng rỗng khi câu đã dứt khoát", () => {
    expect(run("The cat sat on the mat.")).toEqual([]);
  });
});
