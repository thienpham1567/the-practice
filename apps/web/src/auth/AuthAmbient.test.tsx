import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthAmbient } from "./AuthAmbient";

describe("AuthAmbient", () => {
  it("is aria-hidden and does not capture pointer events", () => {
    const { container } = render(<AuthAmbient />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.className).toMatch(/pointer-events-none/);
  });

  it("renders ink, rules, and marks layers", () => {
    const { container } = render(<AuthAmbient />);
    expect(container.querySelector("[data-ambient='ink']")).toBeTruthy();
    expect(container.querySelector("[data-ambient='rules']")).toBeTruthy();
    expect(container.querySelector("[data-ambient='marks']")).toBeTruthy();
  });
});
