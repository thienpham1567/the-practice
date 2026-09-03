import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WritingMark } from "@writing-helper/practice";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevisionChecklist } from "./RevisionChecklist";

const TEXT = "I have many idea for we to do together.";

const marks: WritingMark[] = [
  {
    start: 7,
    end: 16,
    category: "noun-number",
    severity: "error",
    correction: "many ideas",
    note: "Use the plural after 'many'.",
  },
  {
    start: 17,
    end: 23,
    category: "pronoun",
    severity: "error",
    correction: "for us",
    note: "'We' is a subject pronoun; after a preposition use 'us'.",
  },
];

function renderList(overrides: Partial<Parameters<typeof RevisionChecklist>[0]> = {}) {
  return render(
    <RevisionChecklist
      marks={marks}
      parentPlainText={TEXT}
      handled={[]}
      onToggle={() => undefined}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("RevisionChecklist", () => {
  it("shows the original wording cut from the paper, not the offsets", () => {
    renderList();

    expect(screen.getByText("many idea")).toBeInTheDocument();
    expect(screen.getByText("for we")).toBeInTheDocument();
  });

  it("shows the correction and the category label for each mark", () => {
    renderList();

    expect(screen.getByText("many ideas")).toBeInTheDocument();
    expect(screen.getByText("Singular / plural")).toBeInTheDocument();
    expect(screen.getByText("Pronouns")).toBeInTheDocument();
  });

  it("keeps the note hidden until the row is opened", async () => {
    renderList();

    expect(screen.queryByText("Use the plural after 'many'.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /many idea/i }));

    expect(screen.getByText("Use the plural after 'many'.")).toBeInTheDocument();
  });

  it("counts how many are done in the heading", () => {
    renderList({ handled: ["7:16"] });

    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it("marks a handled row as done and leaves the others alone", () => {
    renderList({ handled: ["7:16"] });

    expect(screen.getByRole("checkbox", { name: /many idea/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /for we/i })).not.toBeChecked();
  });

  it("reports the key of the row that was ticked", async () => {
    const onToggle = vi.fn();
    renderList({ onToggle });

    await userEvent.click(screen.getByRole("checkbox", { name: /for we/i }));

    expect(onToggle).toHaveBeenCalledWith("17:23");
  });

  it("keeps rows in paper order so they can be followed down the text", () => {
    renderList();

    const rows = screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"));
    expect(rows[0]).toMatch(/many idea/);
    expect(rows[1]).toMatch(/for we/);
  });

  it("renders nothing when the paper had no marks", () => {
    const { container } = renderList({ marks: [] });

    expect(container).toBeEmptyDOMElement();
  });
});
