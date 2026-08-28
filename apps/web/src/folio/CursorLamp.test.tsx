import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CursorLamp, finePointerMotionEnabled } from "./CursorLamp";

function stubMedia(fine: boolean, reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine") ? fine : query.includes("prefers-reduced-motion") ? reduce : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("CursorLamp", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders a hidden lamp on fine pointers without reduced motion", () => {
    stubMedia(true, false);
    const { container } = render(<CursorLamp />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.getAttribute("data-cursor-lamp")).toBe("true");
    expect(root.className).toMatch(/cursor-lamp/);
    expect(container.querySelector(".cursor-lamp__bloom")).toBeTruthy();
    expect(container.querySelector(".cursor-lamp__nib")).toBeNull();
  });

  it("does not render when motion is reduced or the pointer is coarse", () => {
    stubMedia(true, true);
    expect(finePointerMotionEnabled()).toBe(false);
    const reduced = render(<CursorLamp />);
    expect(reduced.container.firstElementChild).toBeNull();
    reduced.unmount();

    stubMedia(false, false);
    expect(finePointerMotionEnabled()).toBe(false);
    const coarse = render(<CursorLamp />);
    expect(coarse.container.firstElementChild).toBeNull();
  });
});

describe("finePointerMotionEnabled", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(finePointerMotionEnabled()).toBe(false);
  });
});
