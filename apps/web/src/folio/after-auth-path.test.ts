import { afterEach, describe, expect, it } from "vitest";
import { afterAuthPath } from "./after-auth-path";
import { stashDraft } from "../pages/draft-stash";

describe("afterAuthPath", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("sends a writer with a stashed draft back to /write", () => {
    stashDraft({
      title: "Untitled",
      content: { root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 } },
    });
    expect(afterAuthPath()).toBe("/write");
  });

  it("sends everyone else to practice", () => {
    expect(afterAuthPath()).toBe("/practice");
  });
});
