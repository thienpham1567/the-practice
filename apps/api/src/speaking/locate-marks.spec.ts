import { locateMarks, type MarkQuote } from "./locate-marks";

describe("locateMarks", () => {
  const transcript = "I went to the park yesterday and I saw a bird.";

  it("maps quotes to start/end offsets in the transcript", () => {
    const quotes: MarkQuote[] = [
      { quote: "park", kind: "pronunciation", note: "p vs b" },
      { quote: "yesterday", kind: "grammar", note: "tense" },
    ];

    expect(locateMarks(quotes, transcript)).toEqual([
      { start: 14, end: 18, kind: "pronunciation", note: "p vs b" },
      { start: 19, end: 28, kind: "grammar", note: "tense" },
    ]);
  });

  it("drops quotes that are not found", () => {
    const quotes: MarkQuote[] = [
      { quote: "park", kind: "filler", note: "ok" },
      { quote: "missing phrase", kind: "hesitation", note: "gone" },
    ];

    expect(locateMarks(quotes, transcript)).toEqual([
      { start: 14, end: 18, kind: "filler", note: "ok" },
    ]);
  });

  it("drops empty quotes", () => {
    const quotes: MarkQuote[] = [
      { quote: "", kind: "grammar", note: "empty" },
      { quote: "   ", kind: "grammar", note: "blank" },
      { quote: "bird", kind: "pronunciation", note: "ok" },
    ];

    expect(locateMarks(quotes, transcript)).toEqual([
      { start: 41, end: 45, kind: "pronunciation", note: "ok" },
    ]);
  });

  it("uses the first match when the quote appears twice", () => {
    const dup = "I saw a bird and I saw a cat.";
    const quotes: MarkQuote[] = [{ quote: "I saw", kind: "hesitation", note: "pause" }];

    expect(locateMarks(quotes, dup)).toEqual([
      { start: 0, end: 5, kind: "hesitation", note: "pause" },
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(locateMarks([{ quote: "nowhere", kind: "filler", note: "x" }], transcript)).toEqual(
      [],
    );
  });
});
