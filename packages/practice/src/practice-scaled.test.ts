import { describe, expect, it } from "vitest";
import { practiceScaled } from "./practice-scaled";

describe("practiceScaled", () => {
  it("maps 0 to 0", () => {
    expect(practiceScaled(0, 3)).toBe(0);
    expect(practiceScaled(-1, 5)).toBe(0);
  });

  it("maps a perfect raw score to 200", () => {
    expect(practiceScaled(3, 3)).toBe(200);
    expect(practiceScaled(4, 4)).toBe(200);
    expect(practiceScaled(5, 5)).toBe(200);
  });

  it("uses tenths of 200: 2/3 → 130, 4/5 → 160", () => {
    expect(practiceScaled(2, 3)).toBe(130);
    expect(practiceScaled(4, 5)).toBe(160);
    expect(practiceScaled(1, 3)).toBe(70);
  });

  it("clamps above max to 200", () => {
    expect(practiceScaled(9, 5)).toBe(200);
  });
});
