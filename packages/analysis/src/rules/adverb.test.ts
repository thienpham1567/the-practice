import { describe, expect, it } from "vitest";
import { splitSentences } from "../tokenize.js";
import { adverbRule } from "./adverb.js";

function run(text: string) {
  return adverbRule(splitSentences(text), text);
}

describe("adverbRule", () => {
  it("bắt từ kết thúc bằng -ly", () => {
    const text = "She quickly ran home.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("quickly");
    expect(highlights[0]!.type).toBe("adverb");
  });

  it("bắt nhiều adverb trong một câu", () => {
    expect(run("He slowly and carefully opened it.")).toHaveLength(2);
  });

  it("bỏ qua danh từ và tính từ kết thúc bằng -ly", () => {
    expect(run("The family will reply to the supply request.")).toEqual([]);
    expect(run("It was an ugly, lonely, friendly day.")).toEqual([]);
    expect(run("He is the only one.")).toEqual([]);
  });

  it("không phân biệt hoa thường khi tra whitelist", () => {
    expect(run("Family matters.")).toEqual([]);
  });

  it("bỏ qua từ quá ngắn", () => {
    expect(run("Ly is a name.")).toEqual([]);
  });

  it("trả về mảng rỗng khi không có adverb", () => {
    expect(run("The cat sat on the mat.")).toEqual([]);
  });
});
