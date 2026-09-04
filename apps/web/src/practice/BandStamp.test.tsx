import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BandStamp } from "./BandStamp";

afterEach(() => {
  cleanup();
});

describe("BandStamp", () => {
  it("shows the band and the level of the task it was earned on", () => {
    render(<BandStamp band={6.5} level="B1" />);
    expect(screen.getByText("Band 6.5")).toBeTruthy();
    expect(screen.getByText("B1 task")).toBeTruthy();
  });

  /*
    Đây là regression cần chốt: band 7 trên một đề B1 từng hiện "≈ C1" — một
    tuyên bố về trình độ người viết mà một bài đơn lẻ không chứng minh được.
  */
  it("never converts the band into a CEFR claim about the writer", () => {
    const { container } = render(<BandStamp band={7} level="B1" />);
    expect(screen.getByText("B1 task")).toBeTruthy();
    expect(container.textContent).not.toMatch(/≈/);
    expect(container.textContent).not.toMatch(/C1/);
  });

  it("shrinks the stamp for size sm compared to the default lg", () => {
    render(<BandStamp band={5} level="A2" />);
    expect(screen.getByText("Band 5").className).toContain("text-3xl");
    cleanup();

    render(<BandStamp band={5} level="A2" size="sm" />);
    expect(screen.getByText("Band 5").className).toContain("text-base");
    expect(screen.getByText("Band 5").className).not.toContain("text-3xl");
  });
});
