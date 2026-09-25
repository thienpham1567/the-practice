import { describe, expect, it } from "vitest";
import { homeView } from "./home-view";

describe("homeView", () => {
  it("waits on splash only when this browser had a session before", () => {
    expect(homeView("loading", null, true)).toBe("splash");
  });

  it("shows the landing at once for a first-time visitor while restoring", () => {
    expect(homeView("loading", null, false)).toBe("landing");
  });

  it("shows landing when ready and signed out", () => {
    expect(homeView("ready", null, true)).toBe("landing");
    expect(homeView("ready", null, false)).toBe("landing");
  });

  it("shows the editor whenever a token exists", () => {
    expect(homeView("ready", "token", true)).toBe("editor");
    expect(homeView("loading", "token", false)).toBe("editor");
  });
});
