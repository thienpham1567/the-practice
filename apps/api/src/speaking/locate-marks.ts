import { locateQuote } from "../common/locate-quote";

export type SpeakingMarkKind = "pronunciation" | "hesitation" | "grammar" | "filler";

export interface MarkQuote {
  quote: string;
  kind: SpeakingMarkKind;
  note: string;
}

export interface LocatedMark {
  start: number;
  end: number;
  kind: SpeakingMarkKind;
  note: string;
}

/**
 * Map AI quote snippets onto character offsets in the transcript.
 * Missing/empty quotes are dropped (marks are best-effort).
 * Duplicate quotes resolve to the first occurrence.
 */
export function locateMarks(quotes: MarkQuote[], transcript: string): LocatedMark[] {
  const located: LocatedMark[] = [];

  for (const item of quotes) {
    // Speaking quotes the transcript loosely, so it trims before matching and
    // always takes the first occurrence.
    const found = locateQuote(transcript, item.quote.trim());
    if (!found) continue;

    located.push({
      start: found.start,
      end: found.end,
      kind: item.kind,
      note: item.note,
    });
  }

  return located;
}
