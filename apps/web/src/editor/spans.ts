import type { Highlight, HighlightType } from "@writing-helper/analysis";
import type { WritingMark } from "@writing-helper/practice";
import { MARK_HIGHLIGHT_GROUP, type MarkHighlightGroup } from "./mark-highlight-groups";

/**
 * One paint layer. The two sources are very different — a rule engine running
 * in the browser, and mistakes a model quoted — but to the painter they are
 * only spans carrying a layer name.
 */
export type SpanLayer = HighlightType | MarkHighlightGroup;

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
  marks.map((mark) => ({
    start: mark.start,
    end: mark.end,
    layer: MARK_HIGHLIGHT_GROUP[mark.category],
  }));
