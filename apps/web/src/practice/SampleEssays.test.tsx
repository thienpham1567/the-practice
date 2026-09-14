import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SampleEssays } from "./SampleEssays";

describe("SampleEssays", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the generate button when no samples exist yet", () => {
    render(<SampleEssays sampleEssays={null} onGenerate={vi.fn()} isPending={false} />);

    expect(screen.getByRole("button", { name: "See model answers" })).toBeInTheDocument();
  });

  it("calls onGenerate when the button is clicked", () => {
    const onGenerate = vi.fn();
    render(<SampleEssays sampleEssays={null} onGenerate={onGenerate} isPending={false} />);

    fireEvent.click(screen.getByRole("button", { name: "See model answers" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows a loading label while pending", () => {
    render(<SampleEssays sampleEssays={null} onGenerate={vi.fn()} isPending={true} />);

    const button = screen.getByRole("button", { name: "Generating…" });
    expect(button).toBeDisabled();
  });

  it("renders both essays and hides the button once samples exist", () => {
    render(
      <SampleEssays
        sampleEssays={["First essay text.", "Second essay text."]}
        onGenerate={vi.fn()}
        isPending={false}
      />,
    );

    expect(screen.getByText("First essay text.")).toBeInTheDocument();
    expect(screen.getByText("Second essay text.")).toBeInTheDocument();
    expect(screen.getByText("Model answer 1")).toBeInTheDocument();
    expect(screen.getByText("Model answer 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See model answers" })).not.toBeInTheDocument();
  });
});
