import { locateQuote } from "./locate-quote";

describe("locateQuote", () => {
  const text = "the cat and the dog and the bird";

  it("finds the first occurrence by default", () => {
    expect(locateQuote(text, "the")).toEqual({ start: 0, end: 3 });
  });

  it("finds the nth occurrence when asked", () => {
    expect(locateQuote(text, "the", 2)).toEqual({ start: 12, end: 15 });
    expect(locateQuote(text, "the", 3)).toEqual({ start: 24, end: 27 });
  });

  it("returns null when the occurrence overshoots", () => {
    expect(locateQuote(text, "the", 4)).toBeNull();
  });

  it("returns null when the quote is absent", () => {
    expect(locateQuote(text, "elephant")).toBeNull();
  });

  it("returns null for an empty quote", () => {
    expect(locateQuote(text, "")).toBeNull();
  });

  it("returns null for a whitespace-only quote", () => {
    expect(locateQuote(text, "   ")).toBeNull();
  });

  it("returns null for a non-positive or non-integer occurrence", () => {
    expect(locateQuote(text, "the", 0)).toBeNull();
    expect(locateQuote(text, "the", -1)).toBeNull();
    expect(locateQuote(text, "the", 1.5)).toBeNull();
  });

  it("matches the quote verbatim, without trimming it first", () => {
    expect(locateQuote("a  b", " b")).toEqual({ start: 2, end: 4 });
  });
});
