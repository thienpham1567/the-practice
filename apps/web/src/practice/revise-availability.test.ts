import { describe, expect, it } from "vitest";
import { canRevise, formatBandDelta } from "./revise-availability";

describe("canRevise", () => {
  const graded = {
    band: 6.0,
    submittedAt: "2026-08-27T10:00:00Z",
    revisionRound: 0,
    hasRevision: false,
  };

  it("allows revise for a graded root with no revision yet", () => {
    expect(canRevise(graded)).toBe(true);
  });

  it("rejects when band is null", () => {
    expect(canRevise({ ...graded, band: null })).toBe(false);
  });

  it("rejects when not yet submitted", () => {
    expect(canRevise({ ...graded, submittedAt: null })).toBe(false);
  });

  it("allows revise at revisionRound 1", () => {
    expect(canRevise({ ...graded, revisionRound: 1 })).toBe(true);
  });

  it("rejects when revisionRound is already 2", () => {
    expect(canRevise({ ...graded, revisionRound: 2 })).toBe(false);
  });

  it("rejects when a revision already exists", () => {
    expect(canRevise({ ...graded, hasRevision: true })).toBe(false);
  });

  it("defaults hasRevision to false when omitted", () => {
    const { hasRevision: _, ...withoutFlag } = graded;
    expect(canRevise(withoutFlag)).toBe(true);
  });
});

describe("formatBandDelta", () => {
  it("formats from → to with an arrow", () => {
    expect(formatBandDelta(5.5, 6.5)).toBe("5.5 → 6.5");
  });

  it("keeps whole bands as one decimal", () => {
    expect(formatBandDelta(6, 7)).toBe("6.0 → 7.0");
  });
});
