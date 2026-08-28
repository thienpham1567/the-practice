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
    const quote = item.quote.trim();
    if (!quote) continue;

    const start = transcript.indexOf(quote);
    if (start < 0) continue;

    located.push({
      start,
      end: start + quote.length,
      kind: item.kind,
      note: item.note,
    });
  }

  return located;
}
