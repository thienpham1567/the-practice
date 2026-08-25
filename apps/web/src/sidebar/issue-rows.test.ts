import { analyze } from "@writing-helper/analysis";
import { describe, expect, it } from "vitest";
import { formatReadingTime, issueRows } from "./issue-rows";

describe("issueRows", () => {
  it("trả về đủ sáu dòng theo thứ tự cố định", () => {
    const rows = issueRows(analyze("The cat sat."));

    expect(rows.map((row) => row.type)).toEqual([
      "very-hard-sentence",
      "hard-sentence",
      "adverb",
      "passive",
      "complex-phrase",
      "qualifier",
    ]);
  });

  it("báo đạt ngưỡng khi số adverb nằm trong giới hạn", () => {
    const rows = issueRows(analyze("She quickly ran."));
    const adverbs = rows.find((row) => row.type === "adverb")!;

    expect(adverbs.count).toBe(1);
    expect(adverbs.tone).toBe("met");
    expect(adverbs.note).toBe("meeting the goal of 1 or fewer");
  });

  it("báo vượt ngưỡng khi quá nhiều adverb", () => {
    const rows = issueRows(analyze("She quickly and carefully and slowly ran."));
    const adverbs = rows.find((row) => row.type === "adverb")!;

    expect(adverbs.count).toBe(3);
    expect(adverbs.tone).toBe("over");
    expect(adverbs.note).toBe("aim for 1 or fewer");
  });

  it("dùng số ít số nhiều đúng ngữ pháp", () => {
    const single = issueRows(analyze("She quickly ran."));
    expect(single.find((row) => row.type === "adverb")!.label).toBe("1 adverb");
    expect(single.find((row) => row.type === "passive")!.label).toBe("0 uses of passive voice");

    const many = issueRows(analyze("She quickly and slowly ran."));
    expect(many.find((row) => row.type === "adverb")!.label).toBe("2 adverbs");
  });

  it("nêu tổng số câu trong dòng câu khó", () => {
    const rows = issueRows(analyze("One here. Two here."));

    expect(rows[0]!.label).toBe("0 of 2 sentences very hard to read");
  });
});

describe("formatReadingTime", () => {
  it("hiện giây khi dưới một phút", () => {
    expect(formatReadingTime(45)).toBe("45 sec");
  });

  it("hiện phút chẵn", () => {
    expect(formatReadingTime(120)).toBe("2 min");
  });

  it("hiện cả phút lẫn giây", () => {
    expect(formatReadingTime(125)).toBe("2 min 5 sec");
  });

  it("xử lý văn bản rỗng", () => {
    expect(formatReadingTime(0)).toBe("0 sec");
  });
});
