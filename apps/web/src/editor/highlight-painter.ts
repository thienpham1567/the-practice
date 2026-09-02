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

/** Câu vẽ dưới, từ vẽ đè lên. */
export const STYLE_LAYERS: SpanLayer[] = [
  "very-hard-sentence",
  "hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
];

/** Lỗi ngôn ngữ vẽ trên cùng. */
export const MISTAKE_LAYERS: SpanLayer[] = ["refinement", "error"];

const SENTENCE_LAYERS = new Set<SpanLayer>(["hard-sentence", "very-hard-sentence"]);
const MISTAKE_LAYER_SET = new Set<SpanLayer>(MISTAKE_LAYERS);

function priorityOf(layer: SpanLayer): number {
  if (SENTENCE_LAYERS.has(layer)) return 0;
  if (MISTAKE_LAYER_SET.has(layer)) return 2;
  return 1;
}

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

/**
 * Vẽ spans lên registry, giới hạn trong `layers`.
 *
 * `layers` là tập layer mà caller này sở hữu (`STYLE_LAYERS` hoặc
 * `MISTAKE_LAYERS`) — bắt buộc truyền vào, không có mặc định, để hai painter
 * độc lập (style highlight và lỗi ngôn ngữ) không bao giờ dẫm lên registry
 * của nhau: xoá/tô layer ngoài tập này không phải việc của lệnh gọi này.
 */
export function paintSpans(index: TextIndex, spans: EditorSpan[], layers: SpanLayer[]): void {
  if (!highlightsSupported()) return;

  const byLayer = new Map<SpanLayer, Range[]>();

  for (const span of spans) {
    const range = rangeFor(index, span.start, span.end);
    if (!range) continue;

    const ranges = byLayer.get(span.layer);
    if (ranges) ranges.push(range);
    else byLayer.set(span.layer, [range]);
  }

  for (const layer of layers) {
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

/** Xoá đúng tập `layers` caller sở hữu — không đụng tới layer của painter khác. */
export function clearSpans(layers: SpanLayer[]): void {
  if (!highlightsSupported()) return;

  for (const layer of layers) CSS.highlights.delete(REGISTRY_PREFIX + layer);
}
