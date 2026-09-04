import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInView } from "./use-in-view";

/** jsdom không có IntersectionObserver; dựng một cái điều khiển được bằng tay. */
let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();

beforeEach(() => {
  trigger = null;
  disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        trigger = callback;
      }
      observe() {}
      disconnect = disconnect;
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Probe() {
  const ref = useInView<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" />;
}

describe("useInView", () => {
  it("leaves the element alone until it enters the viewport", () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId("probe").className).not.toContain("in-view");
  });

  it("adds in-view once the element intersects", () => {
    const { getByTestId } = render(<Probe />);

    trigger!([{ isIntersecting: true }]);

    expect(getByTestId("probe").className).toContain("in-view");
  });

  /** Vào lại mỗi lần cuộn qua lại gây chóng mặt; hiệu ứng chỉ chạy một lần. */
  it("stops observing after the first entry", () => {
    render(<Probe />);

    trigger!([{ isIntersecting: true }]);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores entries that are not intersecting", () => {
    const { getByTestId } = render(<Probe />);

    trigger!([{ isIntersecting: false }]);

    expect(getByTestId("probe").className).not.toContain("in-view");
    expect(disconnect).not.toHaveBeenCalled();
  });
});
