import { buildRewritePrompt, parseSuggestions } from "./prompts";

describe("buildRewritePrompt", () => {
  it("nhúng câu và chỉ dẫn đúng theo issueType", () => {
    const prompt = buildRewritePrompt("The report was written by them.", "passive");

    expect(prompt).toContain('"The report was written by them."');
    expect(prompt).toContain("active voice");
  });

  it("thêm ngữ cảnh khi có, và dặn không viết lại phần đó", () => {
    const prompt = buildRewritePrompt("It was done.", "passive", "The team finished early.");

    expect(prompt).toContain("The team finished early.");
    expect(prompt).toContain("do not rewrite it");
  });

  it("không thêm phần ngữ cảnh khi không có", () => {
    const prompt = buildRewritePrompt("It was done.", "passive");

    expect(prompt).not.toContain("Surrounding context");
  });

  it("có chỉ dẫn riêng cho từng issueType", () => {
    const veryHard = buildRewritePrompt("x", "very-hard-sentence");
    const adverb = buildRewritePrompt("x", "adverb");

    expect(veryHard).toContain("Split it into shorter sentences");
    expect(adverb).toContain("stronger verb");
    expect(veryHard).not.toBe(adverb);
  });

  it("có chỉ dẫn chung cho selection thủ công, không gắn với highlight nào", () => {
    const prompt = buildRewritePrompt("Some selected text.", "selection");

    expect(prompt).toContain("clearer and more concise");
  });
});

describe("parseSuggestions", () => {
  it("tách hai dòng thành hai gợi ý", () => {
    expect(parseSuggestions("They wrote the report.\nThe committee wrote it.")).toEqual([
      "They wrote the report.",
      "The committee wrote it.",
    ]);
  });

  it("bỏ số thứ tự và gạch đầu dòng dù đã dặn không thêm", () => {
    expect(parseSuggestions("1. They wrote the report.\n- The committee wrote it.")).toEqual([
      "They wrote the report.",
      "The committee wrote it.",
    ]);
  });

  it("bỏ dấu ngoặc kép bao quanh", () => {
    expect(parseSuggestions('"They wrote it."')).toEqual(["They wrote it."]);
  });

  it("bỏ dòng trống", () => {
    expect(parseSuggestions("First line.\n\nSecond line.\n")).toEqual([
      "First line.",
      "Second line.",
    ]);
  });

  it("chỉ giữ tối đa hai gợi ý dù mô hình trả nhiều hơn", () => {
    expect(parseSuggestions("One.\nTwo.\nThree.")).toEqual(["One.", "Two."]);
  });

  it("trả về mảng rỗng khi không có nội dung", () => {
    expect(parseSuggestions("")).toEqual([]);
  });
});
