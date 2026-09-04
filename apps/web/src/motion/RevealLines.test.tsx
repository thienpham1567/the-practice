import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RevealLines } from "./RevealLines";

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe("RevealLines", () => {
  /*
    Đây là điều dễ làm sai nhất khi tách dòng để animate: máy đọc màn hình đọc
    ra từng mảnh rời rạc. Câu gốc phải còn nguyên một khối trong DOM.
  */
  it("keeps the whole sentence readable as one string", () => {
    render(<RevealLines lines={["Sit the paper.", "Take the turn."]} />);

    expect(screen.getByText("Sit the paper. Take the turn.")).toBeInTheDocument();
  });

  it("hides the split copy from assistive tech", () => {
    const { container } = render(<RevealLines lines={["one", "two"]} />);

    const split = container.querySelector(".reveal-lines");
    expect(split?.getAttribute("aria-hidden")).toBe("true");
  });

  it("numbers the lines so they can be staggered", () => {
    const { container } = render(<RevealLines lines={["one", "two", "three"]} />);

    const lines = [...container.querySelectorAll("[data-line]")];
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.getAttribute("style"))).toEqual([
      "--line-index: 0;",
      "--line-index: 1;",
      "--line-index: 2;",
    ]);
  });

  it("renders as the requested element", () => {
    render(<RevealLines as="h1" lines={["headline"]} />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
