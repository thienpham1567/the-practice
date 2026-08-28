import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecordingPulse } from "./RecordingPulse";

describe("RecordingPulse", () => {
  afterEach(() => {
    cleanup();
  });

  it("announces that recording is live", () => {
    render(<RecordingPulse level={0} />);
    expect(screen.getByRole("status").textContent).toMatch(/Recording — microphone live/);
    expect(screen.getByText("Rec")).toBeTruthy();
    expect(document.querySelectorAll(".recording-voice__bar")).toHaveLength(5);
  });

  it("raises the voice print as the microphone level rises", () => {
    const { rerender } = render(<RecordingPulse level={0} />);
    const print = document.querySelector(".recording-voice") as HTMLElement;
    const quiet = print.getAttribute("data-level");

    rerender(<RecordingPulse level={0.9} />);
    const loud = print.getAttribute("data-level");

    expect(Number(quiet)).toBeLessThan(0.2);
    expect(Number(loud)).toBeGreaterThan(Number(quiet));
  });
});
