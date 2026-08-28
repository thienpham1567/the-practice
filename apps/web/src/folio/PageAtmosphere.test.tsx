import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageAtmosphere, type AtmosphereKind } from "./PageAtmosphere";

const KINDS: AtmosphereKind[] = [
  "folio",
  "manuscript",
  "drafts",
  "practice",
  "exam",
  "result",
  "speaking",
  "talk",
  "progress",
  "vocab",
];

describe("PageAtmosphere", () => {
  it("is aria-hidden and does not capture pointer events", () => {
    const { container } = render(<PageAtmosphere kind="practice" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.className).toMatch(/pointer-events-none/);
  });

  it.each(KINDS)("renders a distinct layer for %s", (kind) => {
    const { container } = render(<PageAtmosphere kind={kind} />);
    expect(container.querySelector(`[data-atmosphere='${kind}']`)).toBeTruthy();
    expect(container.querySelector(`.page-atm--${kind}`)).toBeTruthy();
  });
});
