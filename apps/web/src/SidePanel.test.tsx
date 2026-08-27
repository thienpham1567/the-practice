import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidePanel } from "./SidePanel";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

function mockMatchMedia(matchesLg: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchesLg && query.includes("1024"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Harness({
  initialOpen = false,
  side = "right" as const,
  triggerRef,
}: {
  initialOpen?: boolean;
  side?: "left" | "right";
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(initialOpen);
  const localRef = useRef<HTMLButtonElement>(null);
  const ref = triggerRef ?? localRef;

  return (
    <div>
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => setOpen(true)}
      >
        Open panel
      </button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Analysis"
        triggerLabel="Analysis"
        triggerRef={ref}
        side={side}
      >
        <p>Panel body</p>
      </SidePanel>
    </div>
  );
}

describe("SidePanel at lg and up", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("keeps the panel visible in flow even when closed", () => {
    render(<Harness initialOpen={false} />);

    expect(screen.getByRole("complementary", { name: "Analysis" })).toBeTruthy();
    expect(screen.getByText("Panel body")).toBeTruthy();
    expect(screen.queryByTestId("side-panel-backdrop")).toBeNull();
  });

  it("does not lock body scroll when open", () => {
    render(<Harness initialOpen={true} />);

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("SidePanel below lg", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it("hides the panel when closed", () => {
    render(<Harness initialOpen={false} />);

    expect(screen.queryByRole("complementary", { name: "Analysis" })).toBeNull();
    expect(screen.queryByText("Panel body")).toBeNull();
  });

  it("shows overlay panel and backdrop when open", () => {
    render(<Harness initialOpen={true} />);

    expect(screen.getByRole("complementary", { name: "Analysis" })).toBeTruthy();
    expect(screen.getByTestId("side-panel-backdrop")).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape and restores focus to the trigger", () => {
    render(<Harness initialOpen={true} />);

    const trigger = screen.getByRole("button", { name: "Open panel" });
    screen.getByRole("complementary", { name: "Analysis" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("complementary", { name: "Analysis" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the backdrop is clicked", () => {
    render(<Harness initialOpen={true} />);

    fireEvent.click(screen.getByTestId("side-panel-backdrop"));

    expect(screen.queryByRole("complementary", { name: "Analysis" })).toBeNull();
  });

  it("unlocks body scroll after close", () => {
    function Toggle() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
          <SidePanel open={open} onOpenChange={setOpen} triggerLabel="Analysis">
            <p>Panel body</p>
          </SidePanel>
        </div>
      );
    }

    render(<Toggle />);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
