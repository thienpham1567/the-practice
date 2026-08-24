import { describe, expect, it } from "vitest";
import { analyze } from "./index.js";

describe("analyze", () => {
  it("trả về kết quả rỗng an toàn với văn bản trống", () => {
    const result = analyze("");

    expect(result.highlights).toEqual([]);
    expect(result.stats).toEqual({
      words: 0,
      sentences: 0,
      paragraphs: 0,
      characters: 0,
      letters: 0,
      readingTimeSeconds: 0,
    });
    expect(result.grade).toBe(0);
    expect(result.gradeLabel).toBe("Good");
  });

  it("đếm thống kê văn bản", () => {
    const text = "The cat sat on the mat.\n\nShe quickly utilized the tool.";
    const { stats } = analyze(text);

    expect(stats.words).toBe(11);
    expect(stats.sentences).toBe(2);
    expect(stats.paragraphs).toBe(2);
    expect(stats.characters).toBe(text.length);
  });

  it("ước tính thời gian đọc theo 250 từ mỗi phút", () => {
    const text = `${"word ".repeat(250)}.`;

    expect(analyze(text).stats.readingTimeSeconds).toBe(60);
  });

  it("gộp highlight từ mọi rule và đếm theo loại", () => {
    const result = analyze("She quickly utilized the tool. I think it was written by hand.");

    expect(result.counts.adverbs).toBe(1);
    expect(result.counts.complexPhrases).toBe(1);
    expect(result.counts.qualifiers).toBe(1);
    expect(result.counts.passives).toBe(1);
  });

  it("sắp xếp highlight theo vị trí, câu bao ngoài đứng trước từ bên trong", () => {
    const text =
      "The organization will immediately deliver the comprehensive analysis to every participating member before the final quarterly meeting.";
    const result = analyze(text);

    expect(result.highlights[0]).toMatchObject({ start: 0, type: "very-hard-sentence" });
    expect(result.highlights[1]!.start).toBeGreaterThan(0);

    const starts = result.highlights.map((h) => h.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("tính grade và nhãn tương ứng", () => {
    const easy = analyze("The cat sat on the mat. The dog ran fast.");
    expect(easy.gradeLabel).toBe("Good");

    const hard = analyze(
      "The organization will immediately deliver the comprehensive analysis to every participating member before the final quarterly meeting.",
    );
    expect(hard.grade).toBeGreaterThanOrEqual(14);
    expect(hard.gradeLabel).toBe("Poor");
  });

  it("đặt ngưỡng adverb theo số từ và ngưỡng passive theo số câu", () => {
    const text = `${"word ".repeat(300)}. Another sentence here. And a third one.`;
    const { goals } = analyze(text);

    expect(goals.adverbs).toBe(3);
    expect(goals.passives).toBe(1);
  });

  it("giữ ngưỡng tối thiểu là 1 với văn bản ngắn", () => {
    const { goals } = analyze("Short text.");

    expect(goals).toEqual({ adverbs: 1, passives: 1 });
  });

  it("giữ nguyên kết quả cho một đoạn văn chuẩn", () => {
    const text =
      "The report was written by the committee. It utilized numerous complex terms that were " +
      "carefully selected. I think the readers will find it very difficult to understand.";

    expect(analyze(text)).toMatchSnapshot();
  });
});
