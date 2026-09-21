import { describe, expect, it } from "vitest";
import { SCORE_MAX, chartDots, firstDraftChartPoints, polyline } from "./band-chart";

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

  it("maps TOEIC scaled scores onto a 0–200 domain", () => {
    expect(SCORE_MAX).toBe(200);
    const top = chartDots([{ at: 1, band: 200 }], 200, 80, { valueMax: SCORE_MAX });
    const mid = chartDots([{ at: 1, band: 100 }], 200, 80, { valueMax: SCORE_MAX });
    const bottom = chartDots([{ at: 1, band: 0 }], 200, 80, { valueMax: SCORE_MAX });
    expect(top[0]!.y).toBe(10);
    expect(mid[0]!.y).toBe(40);
    expect(bottom[0]!.y).toBe(70);
  });
});

describe("polyline", () => {
  it("joins dots into an SVG polyline string", () => {
    expect(polyline([{ x: 8, y: 10 }, { x: 20, y: 12 }])).toBe("8,10 20,12");
  });
});

describe("firstDraftChartPoints", () => {
  it("plots estimatedScaled for toeic roots and ignores ielts rows", () => {
    const roots = [
      {
        band: null,
        estimatedScaled: 180,
        scale: "toeic" as const,
        latestBand: 200,
        submittedAt: "2026-08-26T10:00:00.000Z",
      },
      {
        band: 5.5,
        estimatedScaled: null,
        scale: "ielts" as const,
        latestBand: 6.5,
        submittedAt: "2026-08-25T12:00:00.000Z",
      },
      {
        band: null,
        estimatedScaled: 160,
        scale: "toeic" as const,
        latestBand: null,
        submittedAt: "2026-08-25T10:00:00.000Z",
      },
    ];

    const points = firstDraftChartPoints(roots);

    expect(points.map((point) => point.band)).toEqual([160, 180]);
    expect(points.every((point) => point.band !== 5.5 && point.band !== 6.5)).toBe(true);
  });

  it("skips unsubmitted or ungraded toeic roots", () => {
    expect(
      firstDraftChartPoints([
        {
          band: null,
          estimatedScaled: null,
          scale: "toeic",
          latestBand: null,
          submittedAt: "2026-08-25T10:00:00.000Z",
        },
        {
          band: null,
          estimatedScaled: 160,
          scale: "toeic",
          latestBand: null,
          submittedAt: null,
        },
      ]),
    ).toEqual([]);
  });
});
