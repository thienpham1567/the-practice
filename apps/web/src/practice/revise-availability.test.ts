import { describe, expect, it } from "vitest";
import {
  canRevise,
  formatBandDelta,
  formatChainSummary,
  reviseAction,
} from "./revise-availability";

describe("reviseAction", () => {
  const graded = {
    band: 6.0,
    submittedAt: "2026-08-27T10:00:00Z",
    revisionRound: 0,
    hasRevision: false,
    pendingRevisionId: null as string | null,
  };

  it("returns revise when graded with no revision yet", () => {
    expect(reviseAction(graded)).toEqual({ kind: "revise" });
  });

  it("returns resume with the pending child id when an unsubmitted revision exists", () => {
    expect(
      reviseAction({
        ...graded,
        hasRevision: true,
        pendingRevisionId: "rev-pending",
      }),
    ).toEqual({ kind: "resume", attemptId: "rev-pending" });
  });

  it("returns none when a submitted child already exists", () => {
    expect(
      reviseAction({
        ...graded,
        hasRevision: true,
        pendingRevisionId: null,
      }),
    ).toEqual({ kind: "none" });
  });

  it("returns none when revisionRound is already 2", () => {
    expect(reviseAction({ ...graded, revisionRound: 2 })).toEqual({ kind: "none" });
  });

  it("returns none when band is null", () => {
    expect(reviseAction({ ...graded, band: null })).toEqual({ kind: "none" });
  });

  it("returns none when not yet submitted", () => {
    expect(reviseAction({ ...graded, submittedAt: null })).toEqual({ kind: "none" });
  });

  it("returns revise at revisionRound 1 with no child", () => {
    expect(reviseAction({ ...graded, revisionRound: 1 })).toEqual({ kind: "revise" });
  });

  it("prefers resume over revise when pendingRevisionId is set", () => {
    expect(
      reviseAction({
        ...graded,
        revisionRound: 1,
        hasRevision: true,
        pendingRevisionId: "rev-2-draft",
      }),
    ).toEqual({ kind: "resume", attemptId: "rev-2-draft" });
  });
});

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

  it("rejects when a pending revision exists (resume instead)", () => {
    expect(
      canRevise({ ...graded, hasRevision: true, pendingRevisionId: "rev-1" }),
    ).toBe(false);
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

describe("formatChainSummary", () => {
  it("formats root → latest with English revision count", () => {
    expect(formatChainSummary(5.5, 6.5, 2)).toBe("5.5 → 6.5 · 2 revisions");
  });

  it("uses singular revision for a count of one", () => {
    expect(formatChainSummary(5.5, 6.0, 1)).toBe("5.5 → 6.0 · 1 revision");
  });

  it("returns null when there are no revisions", () => {
    expect(formatChainSummary(5.5, null, 0)).toBeNull();
  });

  it("returns null when latestBand is missing", () => {
    expect(formatChainSummary(5.5, null, 1)).toBeNull();
  });

  it("returns null when root band is missing", () => {
    expect(formatChainSummary(null, 6.5, 1)).toBeNull();
  });
});
