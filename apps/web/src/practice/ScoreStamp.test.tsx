import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreStamp } from "./ScoreStamp";

afterEach(() => {
  cleanup();
});

describe("ScoreStamp", () => {
  it("shows the practice scaled score, raw rating, and disclaimer", () => {
    render(<ScoreStamp estimatedScaled={160} rawRating={4} maxRaw={5} />);

    expect(screen.getByText("160")).toBeTruthy();
    expect(screen.getByText("Practice score")).toBeTruthy();
    expect(screen.getByText("raw 4/5")).toBeTruthy();
    expect(screen.getByText("Practice score, not an official TOEIC score")).toBeTruthy();
  });

  it("shows the CEFR estimate when present", () => {
    render(
      <ScoreStamp estimatedScaled={160} rawRating={4} maxRaw={5} cefrEstimate="B2" />,
    );

    expect(screen.getByText("B2")).toBeTruthy();
  });

  it("omits CEFR when the estimate is missing", () => {
    const { container } = render(
      <ScoreStamp estimatedScaled={160} rawRating={4} maxRaw={5} />,
    );

    expect(container.textContent).not.toMatch(/\bB2\b/);
    expect(container.textContent).not.toMatch(/\bC1\b/);
  });
});
