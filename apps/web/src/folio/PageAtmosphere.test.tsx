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

  it("does not overlay exam marks on the practice desk plate", () => {
    const { container } = render(<PageAtmosphere kind="practice" />);
    expect(container.querySelector(".page-atm-spine")).toBeNull();
    expect(container.querySelector(".page-atm-glyph--box")).toBeNull();
  });

  it("does not overlay rings on the speaking desk plate", () => {
    const { container } = render(<PageAtmosphere kind="speaking" />);
    expect(container.querySelector(".page-atm-rings")).toBeNull();
    expect(container.querySelector(".page-atm-glyph--quote")).toBeNull();
  });

  it("does not overlay a pilcrow on the landing desk plate", () => {
    const { container } = render(<PageAtmosphere kind="folio" />);
    expect(container.querySelector(".page-atm-glyph--pilcrow")).toBeNull();
  });

  it("does not overlay a thumb index on the vocab desk plate", () => {
    const { container } = render(<PageAtmosphere kind="vocab" />);
    expect(container.querySelector(".page-atm-index")).toBeNull();
  });

  it("does not overlay a ledger line on the progress desk plate", () => {
    const { container } = render(<PageAtmosphere kind="progress" />);
    expect(container.querySelector(".page-atm-chart")).toBeNull();
  });
});
