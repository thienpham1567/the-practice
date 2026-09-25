import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

const captureException = vi.fn();
vi.mock("../sentry", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

function Broken(): never {
  throw new Error("render failed");
}

describe("AppErrorBoundary", () => {
  afterEach(() => {
    cleanup();
    captureException.mockReset();
  });

  it("shows the crash notice and reports the error", () => {
    // React ghi lỗi ra console khi boundary bắt được; không cần thấy trong output test.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "render failed" }),
      expect.stringContaining("Broken"),
    );
  });

  it("renders children when nothing breaks", () => {
    render(
      <AppErrorBoundary>
        <p>fine</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeTruthy();
    expect(captureException).not.toHaveBeenCalled();
  });
});
