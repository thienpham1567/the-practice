import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, applyTheme } from "./theme";
import { ThemeToggle } from "./ThemeToggle";

const memory = new Map<string, string>();

describe("ThemeToggle", () => {
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    });
    document.documentElement.dataset.theme = "light";
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    memory.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("offers Night on light paper and Day on dark paper", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(memory.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Day" })).toBeTruthy();
    expect(document.querySelector("svg")).toBeTruthy();
  });

  it("marks the pressed state when the paper is already dark", () => {
    applyTheme("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Day" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});
