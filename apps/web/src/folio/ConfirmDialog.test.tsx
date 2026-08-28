import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function Harness({ pending = false, error = false }: { pending?: boolean; error?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open ? <p>still open</p> : <p>closed</p>}
      <ConfirmDialog
        open={open}
        title="Delete this paper?"
        body="This will permanently delete this paper and any revisions. This cannot be undone."
        pending={pending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() => undefined}
      />
    </>
  );
}

describe("ConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders as a modal dialog with cancel focused", () => {
    render(<Harness />);

    expect(screen.getByRole("dialog", { name: "Delete this paper?" })).toBeTruthy();
    expect(screen.getByText(/permanently delete this paper and any revisions/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("closes on Cancel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("closes on backdrop dismiss", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("shows a delete error without leaving the dialog", () => {
    render(<Harness error />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Could not delete. Try again.")).toBeTruthy();
  });
});
