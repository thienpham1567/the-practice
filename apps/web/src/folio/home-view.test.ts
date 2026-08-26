import { describe, expect, it } from "vitest";
import { homeView } from "./home-view";

describe("homeView", () => {
  it("stays on splash while the session is restoring", () => {
    expect(homeView("loading", null)).toBe("splash");
    expect(homeView("loading", "token")).toBe("splash");
  });

  it("shows landing only when ready and signed out", () => {
    expect(homeView("ready", null)).toBe("landing");
  });

  it("shows the editor when ready and signed in", () => {
    expect(homeView("ready", "token")).toBe("editor");
  });
});
