import { describe, expect, it } from "vitest";
import { chartDots, firstDraftChartPoints, polyline } from "./band-chart";

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

  it("places a point by shared time domain instead of the right edge", () => {
    const dots = chartDots([{ at: 10, band: 6 }], 200, 80, { minT: 0, maxT: 20 });
    expect(dots).toHaveLength(1);
    expect(dots[0]!.x).toBe(100);
  });
});

describe("polyline", () => {
  it("joins dots into an SVG polyline string", () => {
    expect(polyline([{ x: 8, y: 10 }, { x: 20, y: 12 }])).toBe("8,10 20,12");
  });
});

describe("firstDraftChartPoints", () => {
  it("uses root first-draft band, not latestBand from the revision chain", () => {
    const roots = [
      {
        band: 5.5,
        latestBand: 6.5,
        submittedAt: "2026-08-26T10:00:00.000Z",
      },
      {
        band: 6.0,
        latestBand: 7.0,
        submittedAt: "2026-08-25T10:00:00.000Z",
      },
    ];

    const points = firstDraftChartPoints(roots);

    expect(points.map((point) => point.band)).toEqual([6.0, 5.5]);
    expect(points.every((point) => point.band !== 6.5 && point.band !== 7.0)).toBe(true);
  });

  it("skips unsubmitted or ungraded roots", () => {
    expect(
      firstDraftChartPoints([
        { band: null, latestBand: null, submittedAt: "2026-08-25T10:00:00.000Z" },
        { band: 5.5, latestBand: null, submittedAt: null },
      ]),
    ).toEqual([]);
  });
});
