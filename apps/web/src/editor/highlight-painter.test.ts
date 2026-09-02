import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTextIndex } from "./text-index";
import { clearSpans, MISTAKE_LAYERS, paintSpans, STYLE_LAYERS } from "./highlight-painter";

/**
 * jsdom chưa cài CSS Custom Highlight API, nên tự polyfill tối thiểu để test
 * được hành vi thật của registry: `CSS.highlights` là một Map từ tên layer
 * sang instance `Highlight`.
 */
class FakeHighlight {
  ranges: Range[];
  priority = 0;
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

function root(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
}

let registry: Map<string, FakeHighlight>;

beforeEach(() => {
  registry = new Map();
  (globalThis as unknown as { CSS: { highlights: Map<string, FakeHighlight> } }).CSS = {
    highlights: registry,
  };
  (globalThis as unknown as { Highlight: typeof FakeHighlight }).Highlight = FakeHighlight;
});

afterEach(() => {
  delete (globalThis as { CSS?: unknown }).CSS;
  delete (globalThis as { Highlight?: unknown }).Highlight;
});

describe("paintSpans / clearSpans layer scoping", () => {
  it("paintSpans only touches the layers passed in, leaving other painters' layers alone", () => {
    const index = buildTextIndex(root("<p>The cat sat.</p>"));

    // A style painter (e.g. SavedHighlightsPlugin) paints its layer first.
    paintSpans(index, [{ start: 0, end: 3, layer: "passive" }], STYLE_LAYERS);
    expect(registry.has("wh-passive")).toBe(true);

    // A mistake painter (e.g. SavedMarksPlugin) paints its own layer, scoped
    // to MISTAKE_LAYERS only.
    paintSpans(index, [{ start: 4, end: 7, layer: "error" }], MISTAKE_LAYERS);

    // Both layers should be present — the mistake paint must not have wiped
    // the style layer that isn't in its own layer set.
    expect(registry.has("wh-passive")).toBe(true);
    expect(registry.has("wh-error")).toBe(true);
  });

  it("clearSpans(STYLE_LAYERS) removes only style layers, not mistake layers", () => {
    const index = buildTextIndex(root("<p>The cat sat.</p>"));

    paintSpans(index, [{ start: 0, end: 3, layer: "passive" }], STYLE_LAYERS);
    paintSpans(index, [{ start: 4, end: 7, layer: "error" }], MISTAKE_LAYERS);
    expect(registry.has("wh-passive")).toBe(true);
    expect(registry.has("wh-error")).toBe(true);

    // Unmounting the style painter (SavedHighlightsPlugin) must not wipe the
    // mistake painter's (SavedMarksPlugin) layer.
    clearSpans(STYLE_LAYERS);

    expect(registry.has("wh-passive")).toBe(false);
    expect(registry.has("wh-error")).toBe(true);
  });

  it("clearSpans(MISTAKE_LAYERS) removes only mistake layers, not style layers", () => {
    const index = buildTextIndex(root("<p>The cat sat.</p>"));

    paintSpans(index, [{ start: 0, end: 3, layer: "passive" }], STYLE_LAYERS);
    paintSpans(index, [{ start: 4, end: 7, layer: "error" }], MISTAKE_LAYERS);
    expect(registry.has("wh-passive")).toBe(true);
    expect(registry.has("wh-error")).toBe(true);

    // Unmounting the mistake painter (SavedMarksPlugin) must not wipe the
    // style painter's (SavedHighlightsPlugin) layer.
    clearSpans(MISTAKE_LAYERS);

    expect(registry.has("wh-error")).toBe(false);
    expect(registry.has("wh-passive")).toBe(true);
  });

  it("paintSpans clears a stale layer within its own scope when spans no longer include it", () => {
    const index = buildTextIndex(root("<p>The cat sat.</p>"));

    paintSpans(index, [{ start: 0, end: 3, layer: "passive" }], STYLE_LAYERS);
    expect(registry.has("wh-passive")).toBe(true);

    // Re-painting the same layer set with no "passive" span should clear the
    // stale entry, same as before this fix — scoping must not break the
    // existing "repaint on update" behaviour within one painter's own layers.
    paintSpans(index, [{ start: 0, end: 3, layer: "adverb" }], STYLE_LAYERS);

    expect(registry.has("wh-passive")).toBe(false);
    expect(registry.has("wh-adverb")).toBe(true);
  });
});
