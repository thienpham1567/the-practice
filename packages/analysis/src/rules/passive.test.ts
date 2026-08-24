import { describe, expect, it } from "vitest";
import { splitSentences } from "../tokenize.js";
import { passiveRule } from "./passive.js";

function run(text: string) {
  return passiveRule(splitSentences(text), text);
}

function spans(text: string) {
  return run(text).map((h) => text.slice(h.start, h.end));
}

describe("passiveRule", () => {
  it("bắt to-be + phân từ quá khứ bất quy tắc", () => {
    const text = "The book was written by her.";
    const highlights = run(text);

    expect(highlights).toHaveLength(1);
    expect(text.slice(highlights[0]!.start, highlights[0]!.end)).toBe("was written");
    expect(highlights[0]!.type).toBe("passive");
  });

  it("bắt phân từ quy tắc kết thúc bằng -ed", () => {
    expect(spans("The room was cleaned yesterday.")).toEqual(["was cleaned"]);
  });

  it("bắt thể tiếp diễn bị động và chỉ tính một lần", () => {
    expect(spans("The work is being done now.")).toEqual(["is being done"]);
  });

  it("bắt thể hoàn thành bị động", () => {
    expect(spans("He has been given a chance.")).toEqual(["been given"]);
  });

  it("cho phép trạng từ chen giữa", () => {
    expect(spans("They are quickly forgotten.")).toEqual(["are quickly forgotten"]);
  });

  it("cho phép phủ định chen giữa", () => {
    expect(spans("It was not finished.")).toEqual(["was not finished"]);
  });

  it("bỏ qua tính từ thường sau to-be", () => {
    expect(run("She was happy.")).toEqual([]);
    expect(run("The sky is blue.")).toEqual([]);
  });

  it("bỏ qua tính từ dạng phân từ chỉ trạng thái", () => {
    expect(run("He is interested in art.")).toEqual([]);
    expect(run("They were tired and worried.")).toEqual([]);
  });

  it("bỏ qua câu chủ động", () => {
    expect(run("She wrote the book.")).toEqual([]);
    expect(run("The cat sat on the mat.")).toEqual([]);
  });

  it("bắt nhiều câu bị động trong một đoạn", () => {
    expect(spans("The door was locked. The key was lost.")).toEqual([
      "was locked",
      "was lost",
    ]);
  });

  it("không phân biệt hoa thường", () => {
    expect(spans("Was written by hand, it says.")).toEqual(["Was written"]);
  });
});
