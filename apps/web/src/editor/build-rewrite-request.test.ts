import type { Highlight } from "@writing-helper/analysis";
import { describe, expect, it } from "vitest";
import { buildRewriteRequest, buildSelectionRewriteRequest } from "./build-rewrite-request";

describe("buildRewriteRequest", () => {
  const text = "First one. She quickly ran home. Third one.";
  // "quickly" nằm trong câu thứ hai.
  const adverb: Highlight = { start: 16, end: 23, type: "adverb" };

  it("gửi nguyên câu chứa highlight, không phải chỉ đoạn bị đánh dấu", () => {
    const request = buildRewriteRequest(text, adverb);

    expect(request?.input.text).toBe("She quickly ran home.");
    expect(request?.input.issueType).toBe("adverb");
  });

  it("trả về đúng offset của câu, để Apply biết thay vùng nào", () => {
    const request = buildRewriteRequest(text, adverb);

    expect(text.slice(request!.start, request!.end)).toBe("She quickly ran home.");
  });

  it("gộp câu liền trước và liền sau làm context", () => {
    const request = buildRewriteRequest(text, adverb);

    expect(request?.input.context).toBe("First one. Third one.");
  });

  it("bỏ trường context khi không có câu liền kề nào", () => {
    const onlySentence = "She quickly ran home.";
    const request = buildRewriteRequest(onlySentence, { start: 4, end: 11, type: "adverb" });

    expect(request?.input.context).toBeUndefined();
  });

  it("trả về null khi offset không khớp câu nào", () => {
    const request = buildRewriteRequest(text, { start: 9999, end: 10000, type: "adverb" });

    expect(request).toBeNull();
  });
});

describe("buildSelectionRewriteRequest", () => {
  const text = "First one. She quickly ran home. Third one.";
  // "She quickly ran home." nằm đúng ở offset 11..32 (index 31 là dấu chấm).

  it("gửi đúng đoạn đã chọn với issueType selection", () => {
    const request = buildSelectionRewriteRequest(text, 11, 32);

    expect(request?.input.text).toBe("She quickly ran home.");
    expect(request?.input.issueType).toBe("selection");
  });

  it("lấy context từ câu trước điểm bắt đầu và câu sau điểm kết thúc", () => {
    const request = buildSelectionRewriteRequest(text, 11, 32);

    expect(request?.input.context).toBe("First one. Third one.");
  });

  it("cắt khoảng trắng thừa ở đầu/cuối vùng chọn, và trả offset đã cắt", () => {
    // Vùng chọn lấn thêm khoảng trắng trước "She" và sau dấu chấm.
    const request = buildSelectionRewriteRequest(text, 10, 33);

    expect(request?.input.text).toBe("She quickly ran home.");
    expect(text.slice(request!.start, request!.end)).toBe("She quickly ran home.");
  });

  it("trả về null khi vùng chọn rỗng hoặc chỉ toàn khoảng trắng", () => {
    expect(buildSelectionRewriteRequest(text, 5, 5)).toBeNull();
    expect(buildSelectionRewriteRequest(text, 0, 1)).not.toBeNull();
    expect(buildSelectionRewriteRequest("   ", 0, 3)).toBeNull();
  });
});
