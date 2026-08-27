import { matchVocab, normalizeWord } from "./vocab-match";

describe("normalizeWord", () => {
  it("lowercases and trims", () => {
    expect(normalizeWord("  Commute ")).toBe("commute");
  });
});

describe("matchVocab", () => {
  it("matches a word with word boundaries (use ≠ useful)", () => {
    expect(matchVocab("This is useful advice.", ["use"])).toEqual(new Set());
    expect(matchVocab("I use this tool.", ["use"])).toEqual(new Set(["use"]));
  });

  it("is case-insensitive and returns normalized words", () => {
    expect(matchVocab("I love to COMMUTE by train.", ["Commute"])).toEqual(
      new Set(["commute"]),
    );
  });

  it("matches simple -s inflection", () => {
    expect(matchVocab("She uses the app daily.", ["use"])).toEqual(
      new Set(["use"]),
    );
  });

  it("matches simple -es inflection", () => {
    expect(matchVocab("He watches the news.", ["watch"])).toEqual(
      new Set(["watch"]),
    );
  });

  it("matches simple -ed inflection", () => {
    expect(matchVocab("They walked home.", ["walk"])).toEqual(
      new Set(["walk"]),
    );
  });

  it("matches simple -ing inflection", () => {
    expect(matchVocab("They are walking home.", ["walk"])).toEqual(
      new Set(["walk"]),
    );
  });

  it("matches simple -d inflection", () => {
    expect(matchVocab("She lived abroad.", ["live"])).toEqual(
      new Set(["live"]),
    );
  });

  it("matches drop-final-e forms (commuting, commuted)", () => {
    expect(matchVocab("I am commuting today.", ["commute"])).toEqual(
      new Set(["commute"]),
    );
    expect(matchVocab("She commuted yesterday.", ["commute"])).toEqual(
      new Set(["commute"]),
    );
  });

  it("matches multi-word phrases as consecutive word sequences", () => {
    expect(
      matchVocab("Please look forward to the trip.", ["look forward to"]),
    ).toEqual(new Set(["look forward to"]));
    expect(
      matchVocab("Please look carefully forward.", ["look forward to"]),
    ).toEqual(new Set());
  });

  it("does not match inside compound words", () => {
    expect(matchVocab("I bought a notebook.", ["note"])).toEqual(new Set());
    expect(matchVocab("The whiteboard is clean.", ["board"])).toEqual(
      new Set(),
    );
  });
});
