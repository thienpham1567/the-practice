/**
 * Where a verbatim quote sits in a text.
 *
 * Models count characters badly, so every feature that marks spans has the
 * model quote the text and locates the quote here instead of trusting offsets
 * it produced. Speaking marks and writing marks both go through this.
 *
 * Returns null rather than throwing: a mark that cannot be placed is dropped,
 * never fatal.
 */
export function locateQuote(
  text: string,
  quote: string,
  occurrence = 1,
): { start: number; end: number } | null {
  if (quote.trim() === "") return null;
  if (!Number.isInteger(occurrence) || occurrence < 1) return null;

  let start = -1;
  for (let seen = 0; seen < occurrence; seen++) {
    start = text.indexOf(quote, start + 1);
    if (start === -1) return null;
  }

  return { start, end: start + quote.length };
}
