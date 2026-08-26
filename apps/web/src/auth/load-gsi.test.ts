import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SRC = "https://accounts.google.com/gsi/client";

describe("loadGsi", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.querySelectorAll(`script[src="${SRC}"]`).forEach((el) => el.remove());
  });

  it("inserts only one script tag when called twice", async () => {
    const { loadGsi } = await import("./load-gsi");

    const first = loadGsi();
    const second = loadGsi();

    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(1);

    document.querySelector(`script[src="${SRC}"]`)!.dispatchEvent(new Event("load"));

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it("rejects on script error without throwing synchronously", async () => {
    const { loadGsi } = await import("./load-gsi");

    expect(() => {
      void loadGsi();
    }).not.toThrow();

    const pending = loadGsi();
    document.querySelector(`script[src="${SRC}"]`)!.dispatchEvent(new Event("error"));

    await expect(pending).rejects.toThrow(/Failed to load Google Sign-In/);
  });
});
