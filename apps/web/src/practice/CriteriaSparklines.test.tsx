import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Level } from "@writing-helper/practice";
import { CriteriaSparklines } from "./CriteriaSparklines";
import type { ProgressScores } from "./level-up";

afterEach(() => {
  cleanup();
});

function point(overrides: {
  at: string;
  level?: Level;
  scores?: Partial<ProgressScores>;
}) {
  return {
    at: overrides.at,
    level: overrides.level ?? ("B1" as Level),
    band: 6,
    scores: {
      task: 6,
      coherence: 6,
      lexical: 6,
      grammar: 6,
      ...overrides.scores,
    },
    per100: null,
  };
}

const now = new Date("2026-08-27T12:00:00.000Z");

describe("CriteriaSparklines", () => {
  it("marks only the weakest criterion sparkline in vermilion", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        scores: { task: 7, coherence: 6, lexical: 5, grammar: 6 },
      }),
      point({
        at: "2026-08-25T10:00:00.000Z",
        scores: { task: 7, coherence: 6, lexical: 5, grammar: 8 },
      }),
    ];

    render(<CriteriaSparklines series={series} now={now} />);

    const sparklines = screen.getAllByRole("img");
    expect(sparklines).toHaveLength(4);

    const classOf = (el: Element) => String(el.getAttribute("class") ?? "");

    const vermilion = sparklines.filter((svg) => classOf(svg).includes("text-vermilion"));
    expect(vermilion).toHaveLength(1);
    expect(vermilion[0]!.getAttribute("data-criterion")).toBe("lexical");
    expect(vermilion[0]!.getAttribute("data-weakest")).toBe("true");

    const ink = sparklines.filter((svg) => {
      const cls = classOf(svg);
      return cls.includes("text-ink") && !cls.includes("text-vermilion");
    });
    expect(ink).toHaveLength(3);
  });
});
