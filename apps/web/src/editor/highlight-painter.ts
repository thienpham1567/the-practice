import { rangeFor, type TextIndex } from "./text-index";
import type { EditorSpan, SpanLayer } from "./spans";

/**
 * Tô bằng CSS Custom Highlight API: trình duyệt vẽ trực tiếp lên range, không
 * cần chèn thẻ nào vào DOM.
 *
 * Đổi lại là highlight không bắt được sự kiện chuột — việc đó do
 * `highlight-hit.ts` lo bằng cách dò con trỏ.
 */

const REGISTRY_PREFIX = "wh-";

/** Câu vẽ dưới, từ vẽ đè lên, lỗi ngôn ngữ vẽ trên cùng. */
const SENTENCE_LAYERS = new Set<SpanLayer>(["hard-sentence", "very-hard-sentence"]);
const MISTAKE_LAYERS = new Set<SpanLayer>(["error", "refinement"]);

const ALL_LAYERS: SpanLayer[] = [
  "very-hard-sentence",
  "hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
  "refinement",
  "error",
];

function priorityOf(layer: SpanLayer): number {
  if (SENTENCE_LAYERS.has(layer)) return 0;
  if (MISTAKE_LAYERS.has(layer)) return 2;
  return 1;
}

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

export function paintSpans(index: TextIndex, spans: EditorSpan[]): void {
  if (!highlightsSupported()) return;

  const byLayer = new Map<SpanLayer, Range[]>();

  for (const span of spans) {
    const range = rangeFor(index, span.start, span.end);
    if (!range) continue;

    const ranges = byLayer.get(span.layer);
    if (ranges) ranges.push(range);
    else byLayer.set(span.layer, [range]);
  }

  for (const layer of ALL_LAYERS) {
    const ranges = byLayer.get(layer);
    const name = REGISTRY_PREFIX + layer;

    if (!ranges || ranges.length === 0) {
      CSS.highlights.delete(name);
      continue;
    }

    const painted = new Highlight(...ranges);
    painted.priority = priorityOf(layer);
    CSS.highlights.set(name, painted);
  }
}

export function clearSpans(): void {
  if (!highlightsSupported()) return;

  for (const layer of ALL_LAYERS) CSS.highlights.delete(REGISTRY_PREFIX + layer);
}
