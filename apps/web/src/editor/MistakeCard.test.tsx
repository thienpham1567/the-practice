import { cleanup, render, screen } from "@testing-library/react";
import type { WritingMark } from "@writing-helper/practice";
import { afterEach, describe, expect, it } from "vitest";
import { FLIP_THRESHOLD_PX } from "./anchor-position";
import { MistakeCard } from "./MistakeCard";

const mark: WritingMark = {
  start: 2,
  end: 11,
  category: "word-order",
  severity: "error",
  correction: "like it very much",
  note: "The adverb goes after the object in this pattern.",
};

function renderCard(overrides: Partial<{ mark: WritingMark; x: number; y: number }> = {}) {
  return render(<MistakeCard pick={{ mark, x: 120, y: 300, ...overrides }} />);
}

afterEach(() => {
  cleanup();
});

describe("MistakeCard", () => {
  it("names the category with its human label, not the raw taxonomy key", () => {
    renderCard();

    expect(screen.getByText("Word order")).toBeInTheDocument();
    expect(screen.queryByText("word-order")).not.toBeInTheDocument();
  });

  it("shows the correction and the note for the clicked mark", () => {
    renderCard();

    const card = screen.getByRole("dialog", { name: "Mistake" });
    expect(card).toHaveTextContent("like it very much");
    expect(card).toHaveTextContent("The adverb goes after the object in this pattern.");
  });

  it("shows the content of the mark it was given, not of another one", () => {
    renderCard({
      mark: {
        ...mark,
        category: "article",
        correction: "an umbrella",
        note: "Use an before a vowel sound.",
      },
    });

    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("an umbrella")).toBeInTheDocument();
    expect(screen.queryByText("Word order")).not.toBeInTheDocument();
    expect(screen.queryByText("like it very much")).not.toBeInTheDocument();
  });

  it("puts the correction above the note", () => {
    renderCard();

    const lines = Array.from(
      screen.getByRole("dialog", { name: "Mistake" }).querySelectorAll("p"),
    ).map((line) => line.textContent);

    expect(lines).toEqual([
      "Word order",
      "like it very much",
      "The adverb goes after the object in this pattern.",
    ]);
  });

  it("flips below the anchor when the mark sits near the top of the frame", () => {
    const { container } = renderCard({ y: FLIP_THRESHOLD_PX - 1 });
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).not.toMatch(/-translate-y-full/);
    expect(card.style.top).toBe(`${FLIP_THRESHOLD_PX - 1 + 14}px`);
  });

  it("opens above the anchor further down the paper", () => {
    const { container } = renderCard({ y: 300 });
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).toMatch(/-translate-y-full/);
    expect(card.style.top).toBe("290px");
  });
});
