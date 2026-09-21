import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CriteriaBars } from "./CriteriaBars";

afterEach(() => {
  cleanup();
});

describe("CriteriaBars", () => {
  it("renders comment entries without /9 bars", () => {
    const { container } = render(
      <CriteriaBars
        entries={[
          { label: "Grammar", comment: "Mostly accurate." },
          { label: "Relevance", comment: "Fits the picture." },
        ]}
      />,
    );

    expect(screen.getByText("Grammar")).toBeTruthy();
    expect(screen.getByText("Mostly accurate.")).toBeTruthy();
    expect(screen.getByText("Relevance")).toBeTruthy();
    expect(screen.getByText("Fits the picture.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/\/9/);
    expect(container.querySelector("[style*='width']")).toBeNull();
  });
});
