import { describe, expect, it } from "vitest";
import { createPhraseMatcher } from "./phrase-matcher.js";

describe("createPhraseMatcher", () => {
  it("tìm cụm từ và trả về offset", () => {
    const match = createPhraseMatcher(["in order to"]);
    const text = "We did it in order to win.";

    const found = match(text);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]!.start, found[0]!.end)).toBe("in order to");
    expect(found[0]!.phrase).toBe("in order to");
  });

  it("không phân biệt hoa thường nhưng trả về dạng chuẩn trong `phrase`", () => {
    const match = createPhraseMatcher(["utilize"]);

    const found = match("Utilize this.");
    expect(found).toHaveLength(1);
    expect(found[0]!.phrase).toBe("utilize");
  });

  it("chỉ khớp trọn từ, không khớp bên trong từ khác", () => {
    const match = createPhraseMatcher(["use"]);

    expect(match("The user is here.")).toEqual([]);
    expect(match("We use it.")).toHaveLength(1);
  });

  it("ưu tiên cụm dài nhất khi có nhiều lựa chọn", () => {
    const match = createPhraseMatcher(["a number of", "a number"]);
    const text = "He has a number of hats.";

    const found = match(text);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]!.start, found[0]!.end)).toBe("a number of");
  });

  it("tìm nhiều lần xuất hiện", () => {
    const match = createPhraseMatcher(["maybe"]);

    expect(match("Maybe yes, maybe no.")).toHaveLength(2);
  });

  it("xử lý cụm có ký tự đặc biệt của regex", () => {
    const match = createPhraseMatcher(["don't think"]);

    expect(match("I don't think so.")).toHaveLength(1);
  });

  it("trả về mảng rỗng khi từ điển rỗng", () => {
    expect(createPhraseMatcher([])("Anything at all.")).toEqual([]);
  });
});
