import type { SpeakingMark, SpeakingMarkKind } from "../api/speaking";

const REGISTRY_PREFIX = "wh-speaking-";

const ALL_KINDS: SpeakingMarkKind[] = ["pronunciation", "hesitation", "grammar", "filler"];

export function speakingHighlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

/**
 * Paint speaking marks onto a plain-text transcript node via CSS Custom Highlight API.
 * Reuses the existing mark color tokens (peach / yellow / green / blue).
 */
export function paintSpeakingHighlights(root: HTMLElement, marks: SpeakingMark[]): void {
  if (!speakingHighlightsSupported()) return;

  const textNode = firstTextNode(root);
  if (!textNode) {
    clearSpeakingHighlights();
    return;
  }

  const byKind = new Map<SpeakingMarkKind, Range[]>();
  const length = textNode.data.length;

  for (const mark of marks) {
    if (mark.start < 0 || mark.end <= mark.start || mark.start >= length) continue;
    const end = Math.min(mark.end, length);
    const range = document.createRange();
    range.setStart(textNode, mark.start);
    range.setEnd(textNode, end);
    const list = byKind.get(mark.kind);
    if (list) list.push(range);
    else byKind.set(mark.kind, [range]);
  }

  for (const kind of ALL_KINDS) {
    const name = REGISTRY_PREFIX + kind;
    const ranges = byKind.get(kind);
    if (!ranges || ranges.length === 0) {
      CSS.highlights.delete(name);
      continue;
    }
    CSS.highlights.set(name, new Highlight(...ranges));
  }
}

export function clearSpeakingHighlights(): void {
  if (!speakingHighlightsSupported()) return;
  for (const kind of ALL_KINDS) CSS.highlights.delete(REGISTRY_PREFIX + kind);
}

function firstTextNode(root: HTMLElement): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}
