import { describe, expect, it } from "vitest";
import { overallBand } from "./overall-band";
import type { CriterionScores } from "./types";

function scores(
  taskResponse: number,
  coherenceCohesion: number,
  lexicalResource: number,
  grammaticalRange: number,
): CriterionScores {
  return { taskResponse, coherenceCohesion, lexicalResource, grammaticalRange };
}

describe("overallBand", () => {
  it("averages four criteria and rounds 5.75 up to 6.0", () => {
    expect(overallBand(scores(6, 6, 6, 5))).toBe(6);
  });

  it("keeps an exact half-band", () => {
    expect(overallBand(scores(7, 7, 6, 6))).toBe(6.5);
  });

  it("rounds a quarter-band up to the next half", () => {
    expect(overallBand(scores(6, 5, 5, 5))).toBe(5.5);
  });

  it("rounds a mean just below a quarter down", () => {
    expect(overallBand(scores(5, 5, 5, 5))).toBe(5);
  });

  it("averages any four numbers the same way (speaking criteria)", () => {
    expect(overallBand([6, 6, 6, 5])).toBe(6);
    expect(overallBand([7, 7, 6, 6])).toBe(6.5);
  });
});
