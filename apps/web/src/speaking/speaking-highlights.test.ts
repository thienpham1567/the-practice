import { describe, expect, it, vi } from "vitest";
import type { SpeakingMark } from "../api/speaking";
import {
  clearSpeakingHighlights,
  paintSpeakingHighlights,
  speakingHighlightsSupported,
} from "./speaking-highlights";

describe("speaking-highlights", () => {
  it("reports support from CSS.highlights", () => {
    expect(typeof speakingHighlightsSupported()).toBe("boolean");
  });

  it("paints marks when CSS.highlights is available", () => {
    const store = new Map<string, Highlight>();
    vi.stubGlobal("CSS", {
      highlights: {
        set: (name: string, value: Highlight) => {
          store.set(name, value);
        },
        delete: (name: string) => {
          store.delete(name);
        },
      },
    });
    vi.stubGlobal(
      "Highlight",
      class {
        ranges: Range[];
        constructor(...ranges: Range[]) {
          this.ranges = ranges;
        }
      },
    );

    const root = document.createElement("p");
    root.textContent = "I went to Paris um yesterday";
    document.body.appendChild(root);

    const marks: SpeakingMark[] = [
      { start: 15, end: 17, kind: "filler", note: "filler" },
      { start: 0, end: 1, kind: "pronunciation", note: "weak" },
    ];

    paintSpeakingHighlights(root, marks);

    expect(store.has("wh-speaking-filler")).toBe(true);
    expect(store.has("wh-speaking-pronunciation")).toBe(true);

    clearSpeakingHighlights();
    expect(store.size).toBe(0);

    root.remove();
    vi.unstubAllGlobals();
  });

  it("still leaves the transcript node intact when marks are empty", () => {
    const root = document.createElement("p");
    root.textContent = "Hello there";
    paintSpeakingHighlights(root, []);
    expect(root.textContent).toBe("Hello there");
  });
});
