import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolvedTheme,
  toggleTheme,
} from "./theme";

const memory = new Map<string, string>();

function stubStorage() {
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
}

function stubScheme(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") ? dark : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  );
}

describe("theme", () => {
  beforeEach(() => {
    memory.clear();
    stubStorage();
    document.documentElement.removeAttribute("data-theme");
    stubScheme(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    memory.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("reads nothing until the writer chooses a paper", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("follows the system when nothing is stored", () => {
    stubScheme(true);
    expect(resolvedTheme()).toBe("dark");
    stubScheme(false);
    expect(resolvedTheme()).toBe("light");
  });

  it("paints the root and remembers the choice", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(memory.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(resolvedTheme()).toBe("dark");
  });

  it("toggles from the resolved paper, not from a missing attribute", () => {
    stubScheme(true);
    expect(toggleTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(toggleTheme()).toBe("dark");
  });
});
