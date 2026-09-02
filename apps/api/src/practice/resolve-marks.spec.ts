import type { RawWritingMark } from "./mark-prompt";
import { resolveWritingMarks } from "./resolve-marks";

function raw(overrides: Partial<RawWritingMark> = {}): RawWritingMark {
  return {
    quote: "very like",
    occurrence: 1,
    category: "word-order",
    correction: "like ... very much",
    note: "Word order.",
    ...overrides,
  };
}

describe("resolveWritingMarks", () => {
  it("locates a quote and derives severity from the category", () => {
    expect(resolveWritingMarks("I very like it.", [raw()])).toEqual([
      {
        start: 2,
        end: 11,
        category: "word-order",
        severity: "error",
        correction: "like ... very much",
        note: "Word order.",
      },
    ]);
  });

  it("marks refinement categories as refinement", () => {
    const [resolved] = resolveWritingMarks("I made a big mistake.", [
      raw({ quote: "big", category: "word-choice" }),
    ]);
    expect(resolved!.severity).toBe("refinement");
  });

  it("honours occurrence for a repeated quote", () => {
    const [resolved] = resolveWritingMarks("the cat and the dog", [
      raw({ quote: "the", occurrence: 2, category: "article" }),
    ]);
    expect(resolved).toMatchObject({ start: 12, end: 15 });
  });

  it("drops a mark whose quote is absent", () => {
    expect(resolveWritingMarks("I like it.", [raw({ quote: "not in the essay" })])).toEqual([]);
  });

  it("drops a mark whose occurrence overshoots", () => {
    expect(
      resolveWritingMarks("the cat", [raw({ quote: "the", occurrence: 3, category: "article" })]),
    ).toEqual([]);
  });

  it("drops empty and whitespace-only quotes", () => {
    expect(resolveWritingMarks("I like it.", [raw({ quote: "" }), raw({ quote: "   " })])).toEqual(
      [],
    );
  });

  it("drops a category outside the taxonomy", () => {
    const bad = raw({ category: "vibes" as RawWritingMark["category"] });
    expect(resolveWritingMarks("I very like it.", [bad])).toEqual([]);
  });

  it("keeps the first of two marks on the same span", () => {
    const resolved = resolveWritingMarks("I very like it.", [
      raw({ note: "first" }),
      raw({ note: "second" }),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.note).toBe("first");
  });

  it("sorts the result by start offset", () => {
    const resolved = resolveWritingMarks("the cat very like fish", [
      raw({ quote: "very like" }),
      raw({ quote: "the", category: "article" }),
    ]);
    expect(resolved.map((mark) => mark.start)).toEqual([0, 8]);
  });

  it("treats a missing occurrence as the first one", () => {
    const bad = { ...raw(), occurrence: undefined as unknown as number };
    expect(resolveWritingMarks("I very like it.", [bad])[0]).toMatchObject({ start: 2 });
  });

  it("returns an empty array for no raw marks", () => {
    expect(resolveWritingMarks("I like it.", [])).toEqual([]);
  });
});
