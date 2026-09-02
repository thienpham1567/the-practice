import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarkCategory, WritingMark } from "@writing-helper/practice";
import { FixTheseFirst } from "./FixTheseFirst";

function mark(category: MarkCategory): WritingMark {
  return { start: 0, end: 1, category, severity: "error", correction: "x", note: "y" };
}

describe("FixTheseFirst", () => {
  it("names the most common error-tier categories", () => {
    render(<FixTheseFirst marks={[mark("article"), mark("article"), mark("spelling")]} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("Spelling")).toBeInTheDocument();
  });

  it("says so when the paper has no mistakes", () => {
    render(<FixTheseFirst marks={[]} />);
    expect(screen.getByText(/nothing to fix/i)).toBeInTheDocument();
  });

  it("renders nothing when extraction failed", () => {
    const { container } = render(<FixTheseFirst marks={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
