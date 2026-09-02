import { describe, expect, it } from "vitest";
import { MARK_CATEGORIES, MARK_LABELS, MARK_SEVERITY } from "./mark-catalog";

describe("mark catalog", () => {
  it("holds exactly 13 categories with no duplicates", () => {
    expect(MARK_CATEGORIES).toHaveLength(13);
    expect(new Set(MARK_CATEGORIES).size).toBe(13);
  });

  it("gives every category a severity", () => {
    for (const category of MARK_CATEGORIES) {
      expect(MARK_SEVERITY[category]).toMatch(/^(error|refinement)$/);
    }
  });

  it("marks only word-choice and register as refinement", () => {
    const refinements = MARK_CATEGORIES.filter((c) => MARK_SEVERITY[c] === "refinement");
    expect(refinements).toEqual(["word-choice", "register"]);
  });

  it("gives every category a non-empty label", () => {
    for (const category of MARK_CATEGORIES) {
      expect(MARK_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("puts article first so it wins ties in taxonomy order", () => {
    expect(MARK_CATEGORIES[0]).toBe("article");
  });
});
