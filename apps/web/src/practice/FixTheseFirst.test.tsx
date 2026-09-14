import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MarkCategory, WritingMark } from "@writing-helper/practice";
import { FixTheseFirst } from "./FixTheseFirst";

const plainText = "I saw a apple. I saw a apple twice. She writted it down.";

function mark(
  category: MarkCategory,
  start: number,
  end: number,
  correction: string,
): WritingMark {
  return { start, end, category, severity: "error", correction, note: "y" };
}

const articleOne = mark("article", 6, 13, "an apple"); // "a apple"
const articleTwo = mark("article", 21, 28, "an apple"); // "a apple"
const spelling = mark("spelling", 40, 47, "wrote"); // "writted"

describe("FixTheseFirst", () => {
  afterEach(() => {
    cleanup();
  });

  it("names the most common error-tier categories", () => {
    render(
      <FixTheseFirst marks={[articleOne, articleTwo, spelling]} plainText={plainText} />,
    );
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("Spelling")).toBeInTheDocument();
  });

  it("shows the first instance as a concrete example, quote to correction", () => {
    render(
      <FixTheseFirst marks={[articleOne, articleTwo, spelling]} plainText={plainText} />,
    );
    expect(screen.getByText("a apple")).toBeInTheDocument();
    expect(screen.getByText("an apple")).toBeInTheDocument();
    expect(screen.getByText("writted")).toBeInTheDocument();
    expect(screen.getByText("wrote")).toBeInTheDocument();
  });

  it("badges the count when a category has more than one instance", () => {
    render(
      <FixTheseFirst marks={[articleOne, articleTwo, spelling]} plainText={plainText} />,
    );
    expect(screen.getByText("×2")).toBeInTheDocument();
    expect(screen.queryByText("×1")).not.toBeInTheDocument();
  });

  it("says so when the paper has no mistakes", () => {
    render(<FixTheseFirst marks={[]} plainText={plainText} />);
    expect(screen.getByText(/nothing to fix/i)).toBeInTheDocument();
  });

  it("renders nothing when extraction failed", () => {
    const { container } = render(<FixTheseFirst marks={null} plainText={plainText} />);
    expect(container).toBeEmptyDOMElement();
  });
});
