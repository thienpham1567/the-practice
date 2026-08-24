import { describe, expect, it } from "vitest";
import { automatedReadabilityIndex, countLetters, gradeLabelFor } from "./readability.js";

describe("countLetters", () => {
  it("chỉ đếm chữ cái và chữ số", () => {
    expect(countLetters("It's a well-known fact.")).toBe(17);
  });

  it("bỏ qua khoảng trắng và dấu câu", () => {
    expect(countLetters("  ... !? ")).toBe(0);
  });

  it("đếm cả chữ số", () => {
    expect(countLetters("Room 101.")).toBe(7);
  });
});

describe("automatedReadabilityIndex", () => {
  it("áp dụng đúng công thức ARI", () => {
    // 4.71 * (1000/200) + 0.5 * (200/10) - 21.43 = 12.12
    expect(automatedReadabilityIndex(1000, 200, 10)).toBe(12);
  });

  it("làm tròn về số nguyên gần nhất", () => {
    // 4.71 * (900/200) + 0.5 * (200/10) - 21.43 = 9.765
    expect(automatedReadabilityIndex(900, 200, 10)).toBe(10);
  });

  it("không trả về grade nhỏ hơn 1 khi có chữ", () => {
    expect(automatedReadabilityIndex(17, 6, 1)).toBe(1);
  });

  it("trả về 0 khi không có từ nào", () => {
    expect(automatedReadabilityIndex(0, 0, 0)).toBe(0);
  });
});

describe("gradeLabelFor", () => {
  it("grade từ 9 trở xuống là Good", () => {
    expect(gradeLabelFor(1)).toBe("Good");
    expect(gradeLabelFor(9)).toBe("Good");
  });

  it("grade 10 đến 13 là OK", () => {
    expect(gradeLabelFor(10)).toBe("OK");
    expect(gradeLabelFor(13)).toBe("OK");
  });

  it("grade từ 14 trở lên là Poor", () => {
    expect(gradeLabelFor(14)).toBe("Poor");
    expect(gradeLabelFor(30)).toBe("Poor");
  });
});
