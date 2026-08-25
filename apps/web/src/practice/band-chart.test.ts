import { describe, expect, it } from "vitest";
import { chartDots, polyline } from "./band-chart";

describe("chartDots", () => {
  it("returns nothing when there are no scores", () => {
    expect(chartDots([], 200, 80)).toEqual([]);
  });

  it("places a single score at the right edge", () => {
    const dots = chartDots([{ at: 1, band: 6 }], 200, 80);
    expect(dots).toHaveLength(1);
    expect(dots[0]!.x).toBe(192);
    expect(dots[0]!.y).toBeLessThan(40);
  });

  it("spreads several scores left to right by time", () => {
    const dots = chartDots(
      [
        { at: 0, band: 5 },
        { at: 10, band: 7 },
        { at: 20, band: 6 },
      ],
      200,
      80,
    );

    expect(dots).toHaveLength(3);
    expect(dots[0]!.x).toBeLessThan(dots[1]!.x);
    expect(dots[1]!.x).toBeLessThan(dots[2]!.x);
    expect(dots[1]!.y).toBeLessThan(dots[0]!.y);
  });
});

describe("polyline", () => {
  it("joins dots into an SVG polyline string", () => {
    expect(polyline([{ x: 8, y: 10 }, { x: 20, y: 12 }])).toBe("8,10 20,12");
  });
});
