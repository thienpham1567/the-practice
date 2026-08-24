import { describe, expect, it } from "vitest";
import { countParagraphs, splitSentences, splitWords } from "./tokenize.js";

describe("splitWords", () => {
  it("tách từ và giữ offset trên text gốc", () => {
    const words = splitWords("The cat sat.");

    expect(words.map((w) => w.text)).toEqual(["The", "cat", "sat"]);
    expect(words[0]).toMatchObject({ start: 0, end: 3 });
    expect(words[2]).toMatchObject({ start: 8, end: 11 });
  });

  it("giữ nguyên từ có dấu nháy và gạch nối", () => {
    const words = splitWords("It's a well-known fact.");

    expect(words.map((w) => w.text)).toEqual(["It's", "a", "well-known", "fact"]);
  });

  it("cộng offset gốc khi tách từ trong một câu con", () => {
    const words = splitWords("cat sat", 10);

    expect(words[0]).toMatchObject({ text: "cat", start: 10, end: 13 });
  });

  it("trả về mảng rỗng với chuỗi không có từ nào", () => {
    expect(splitWords("   ... !? ")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("tách câu theo dấu kết thúc và giữ offset", () => {
    const text = "The cat sat. The dog ran! Did it?";
    const sentences = splitSentences(text);

    expect(sentences.map((s) => s.text)).toEqual(["The cat sat.", "The dog ran!", "Did it?"]);
    expect(text.slice(sentences[1]!.start, sentences[1]!.end)).toBe("The dog ran!");
  });

  it("không tách ở các từ viết tắt phổ biến", () => {
    const sentences = splitSentences("Mr. Smith met Dr. Jones. They talked.");

    expect(sentences.map((s) => s.text)).toEqual([
      "Mr. Smith met Dr. Jones.",
      "They talked.",
    ]);
  });

  it("không tách ở e.g. và i.e.", () => {
    const sentences = splitSentences("Use fruit, e.g. Apples and pears. That works.");

    expect(sentences).toHaveLength(2);
    expect(sentences[0]!.text).toBe("Use fruit, e.g. Apples and pears.");
  });

  it("không tách ở số thập phân", () => {
    const sentences = splitSentences("It costs 3.14 dollars today. Cheap.");

    expect(sentences.map((s) => s.text)).toEqual(["It costs 3.14 dollars today.", "Cheap."]);
  });

  it("không tách ở tên viết tắt một chữ cái", () => {
    const sentences = splitSentences("The book by J. R. R. Tolkien is long.");

    expect(sentences).toHaveLength(1);
  });

  it("gom nhiều dấu kết thúc liền nhau vào một câu", () => {
    const sentences = splitSentences("Really?! Yes... Fine.");

    expect(sentences.map((s) => s.text)).toEqual(["Really?!", "Yes...", "Fine."]);
  });

  it("tách câu qua nhiều đoạn", () => {
    const sentences = splitSentences("First one.\n\nSecond one.");

    expect(sentences.map((s) => s.text)).toEqual(["First one.", "Second one."]);
  });

  it("nhận câu cuối không có dấu kết thúc", () => {
    const sentences = splitSentences("The cat sat. The dog ran");

    expect(sentences.map((s) => s.text)).toEqual(["The cat sat.", "The dog ran"]);
  });

  it("gắn danh sách từ vào từng câu với offset gốc", () => {
    const text = "The cat sat. The dog ran.";
    const sentences = splitSentences(text);

    expect(sentences[1]!.words.map((w) => w.text)).toEqual(["The", "dog", "ran"]);
    expect(text.slice(sentences[1]!.words[1]!.start, sentences[1]!.words[1]!.end)).toBe("dog");
  });

  it("bỏ qua khoảng trắng thuần", () => {
    expect(splitSentences("   \n  ")).toEqual([]);
  });
});

describe("countParagraphs", () => {
  it("đếm khối văn bản ngăn bởi dòng trống", () => {
    expect(countParagraphs("One line.\n\nTwo line.\n\nThree.")).toBe(3);
  });

  it("coi mỗi dòng là một đoạn", () => {
    expect(countParagraphs("One line.\nTwo line.")).toBe(2);
  });

  it("trả về 0 với văn bản rỗng", () => {
    expect(countParagraphs("   ")).toBe(0);
  });
});
