import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MistakeProfile } from "@writing-helper/practice";
import { RecurringMistakes } from "./RecurringMistakes";

const profile: MistakeProfile = {
  attemptsConsidered: 6,
  tallies: [
    { category: "article", count: 9, trend: "down" },
    { category: "verb-tense", count: 4, trend: "flat" },
    { category: "spelling", count: 2, trend: "up" },
  ],
};

describe("RecurringMistakes", () => {
  afterEach(() => {
    cleanup();
  });


  it("lists categories with their counts", () => {
    render(<RecurringMistakes profile={profile} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("shows a direction for each tally", () => {
    render(<RecurringMistakes profile={profile} />);
    expect(screen.getByLabelText("down")).toBeInTheDocument();
    expect(screen.getByLabelText("up")).toBeInTheDocument();
  });

  it("renders nothing when there is no pattern yet", () => {
    const { container } = render(
      <RecurringMistakes profile={{ tallies: [], attemptsConsidered: 1 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the profile is loading", () => {
    const { container } = render(<RecurringMistakes profile={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
