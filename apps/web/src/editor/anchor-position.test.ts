import { describe, expect, it } from "vitest";
import { clampAnchorX, shouldFlipBelow } from "./anchor-position";

describe("shouldFlipBelow", () => {
  it("flips a card anchored under the toolbar", () => {
    expect(shouldFlipBelow(20)).toBe(true);
  });

  it("leaves a card with room above it alone", () => {
    expect(shouldFlipBelow(400)).toBe(false);
  });
});

/**
 * Cards are centred on the anchor, so half their width hangs off each side.
 * On a 375px phone a 288px card needs 144px of clearance — most of the line
 * is closer to an edge than that, which is how mistake cards ended up
 * off-screen on mobile.
 */
describe("clampAnchorX", () => {
  const CARD = 288;
  const PHONE = 375;

  it("leaves an anchor with room on both sides where it is", () => {
    expect(clampAnchorX(500, 1000, CARD)).toBe(500);
  });

  it("pushes a left-edge anchor in so the card starts on screen", () => {
    expect(clampAnchorX(10, PHONE, CARD)).toBe(CARD / 2);
  });

  it("pushes a right-edge anchor in so the card ends on screen", () => {
    expect(clampAnchorX(370, PHONE, CARD)).toBe(PHONE - CARD / 2);
  });

  it("centres the card when the container is narrower than the card", () => {
    // Nothing can keep a 288px card inside a 200px container; centring at
    // least splits the overflow instead of hiding one whole side.
    expect(clampAnchorX(10, 200, CARD)).toBe(100);
  });

  it("keeps an anchor exactly one half-width from the edge untouched", () => {
    expect(clampAnchorX(CARD / 2, PHONE, CARD)).toBe(CARD / 2);
  });
});
