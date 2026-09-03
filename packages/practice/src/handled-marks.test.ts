import { describe, expect, it } from "vitest";
import { countHandled, markKey } from "./handled-marks";
import type { WritingMark } from "./types";

function mark(start: number, end: number): WritingMark {
  return { start, end, category: "article", severity: "error", correction: "x", note: "y" };
}

describe("markKey", () => {
  it("identifies a mark by its span", () => {
    expect(markKey(mark(2, 11))).toBe("2:11");
  });

  it("gives two marks on different spans different keys", () => {
    expect(markKey(mark(2, 11))).not.toBe(markKey(mark(2, 12)));
  });
});

describe("countHandled", () => {
  it("counts nothing handled on a fresh revision", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], [])).toEqual({ handled: 0, total: 2 });
  });

  it("counts the marks whose keys are listed", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], ["0:3"])).toEqual({ handled: 1, total: 2 });
  });

  it("counts every mark when all are handled", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], ["0:3", "5:9"])).toEqual({
      handled: 2,
      total: 2,
    });
  });

  /**
   * A stored key can outlive the mark it referred to if a paper is ever
   * re-marked. It must not inflate the count past the marks that exist.
   */
  it("ignores a stored key that matches no current mark", () => {
    expect(countHandled([mark(0, 3)], ["0:3", "99:105"])).toEqual({ handled: 1, total: 1 });
  });

  it("reports zero of zero for a paper with no marks", () => {
    expect(countHandled([], ["0:3"])).toEqual({ handled: 0, total: 0 });
  });
});
