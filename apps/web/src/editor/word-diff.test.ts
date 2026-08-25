import { describe, expect, it } from "vitest";
import { diffWords } from "./word-diff";

describe("diffWords", () => {
  it("không đánh dấu gì khi hai câu giống hệt nhau", () => {
    const result = diffWords("She ran home.", "She ran home.");

    expect(result.every((token) => !token.changed)).toBe(true);
  });

  it("đánh dấu đúng từ thay thế, giữ nguyên phần còn lại", () => {
    const result = diffWords("She quickly ran home.", "She sprinted home.");

    expect(result).toEqual([
      { text: "She", changed: false },
      { text: "sprinted", changed: true },
      { text: "home.", changed: false },
    ]);
  });

  it("không đánh dấu gì khi chỉ bớt từ, không thêm từ mới", () => {
    const result = diffWords("She quickly ran home.", "She ran home.");

    expect(result.every((token) => !token.changed)).toBe(true);
    expect(result.map((t) => t.text)).toEqual(["She", "ran", "home."]);
  });

  it("đánh dấu toàn bộ khi hai câu không còn từ nào chung", () => {
    const result = diffWords("The cat sat.", "Birds flew away.");

    expect(result.every((token) => token.changed)).toBe(true);
  });

  it("xử lý câu rỗng mà không lỗi", () => {
    expect(diffWords("", "New content here.")).toHaveLength(3);
    expect(diffWords("Old content here.", "")).toEqual([]);
  });
});
