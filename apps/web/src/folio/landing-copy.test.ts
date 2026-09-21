import { describe, expect, it } from "vitest";
import {
  LANDING_HEADLINE,
  LANDING_LEDE,
  LANDING_MISTAKES,
  LANDING_PAPER,
  LANDING_TALK,
  LANDING_TREND,
} from "./landing-copy";

describe("landing-copy", () => {
  it("keeps learner-facing strings free of IELTS, Part 2, and Band 5.5", () => {
    const text = [
      LANDING_HEADLINE,
      LANDING_LEDE,
      LANDING_PAPER.kicker,
      LANDING_PAPER.instruction,
      LANDING_PAPER.prompt,
      LANDING_TALK.kicker,
      LANDING_TALK.instruction,
      LANDING_TALK.prompt,
      LANDING_MISTAKES.kicker,
      ...LANDING_MISTAKES.lines,
      LANDING_TREND.kicker,
      ...LANDING_TREND.lines,
    ].join("\n");

    expect(text).not.toMatch(/IELTS/);
    expect(text).not.toMatch(/Part 1/);
    expect(text).not.toMatch(/Part 2/);
    expect(text).not.toMatch(/Band 5\.5/);
    expect(text).not.toMatch(/long turn/i);
    expect(text).not.toMatch(/A band is one paper/);
  });

  it("uses 0–200 practice scores for the trend demo", () => {
    expect(LANDING_TREND.scores).toEqual([120, 130, 140, 150, 160, 160, 170, 180]);
    expect(LANDING_TREND.scores.every((score) => score >= 0 && score <= 200)).toBe(true);
    expect("bands" in LANDING_TREND).toBe(false);
  });
});
