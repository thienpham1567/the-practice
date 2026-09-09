import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthWakeOverlay } from "./AuthWakeOverlay";

describe("AuthWakeOverlay", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("says One moment… while checking", () => {
    render(<AuthWakeOverlay status="checking" onRetry={() => undefined} />);
    expect(screen.getByRole("status").textContent).toBe("One moment…");
    expect(document.querySelector(".auth-wake-rule")).toBeTruthy();
    expect(screen.getByTestId("auth-wake-overlay").className).toMatch(/\bfixed\b/);
  });

  it("shifts copy after 8 seconds of checking", () => {
    vi.useFakeTimers();
    render(<AuthWakeOverlay status="checking" onRetry={() => undefined} />);
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(screen.getByRole("status").textContent).toBe(
      "The desk is waking. This can take a minute.",
    );
  });

  it("shows Try again when failed and focuses it", () => {
    render(<AuthWakeOverlay status="failed" onRetry={() => undefined} />);
    const button = screen.getByRole("button", { name: "Try again" });
    expect(screen.getByRole("status").textContent).toBe("The desk isn't answering.");
    expect(document.activeElement).toBe(button);
  });

  it("calls onRetry from Try again", () => {
    const onRetry = vi.fn();
    render(<AuthWakeOverlay status="failed" onRetry={onRetry} />);
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
