import type { Highlight, HighlightType } from "@writing-helper/analysis";
import type { MarkSeverity, WritingMark } from "@writing-helper/practice";

/**
 * One paint layer. The two sources are very different — a rule engine running
 * in the browser, and mistakes a model quoted — but to the painter they are
 * only spans carrying a layer name.
 */
export type SpanLayer = HighlightType | MarkSeverity;

export interface EditorSpan {
  start: number;
  end: number;
  layer: SpanLayer;
}

export const styleSpans = (highlights: Highlight[]): EditorSpan[] =>
  highlights.map((highlight) => ({
    start: highlight.start,
    end: highlight.end,
    layer: highlight.type,
  }));

export const markSpans = (marks: WritingMark[]): EditorSpan[] =>
  marks.map((mark) => ({ start: mark.start, end: mark.end, layer: mark.severity }));
