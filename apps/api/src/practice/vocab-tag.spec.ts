import { tagReviewVocabulary } from "./vocab-tag";

describe("tagReviewVocabulary", () => {
  it("returns the list unchanged when there are no candidates", () => {
    const vocabulary = [
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
    ];
    expect(tagReviewVocabulary(vocabulary, [])).toEqual(vocabulary);
  });

  it("flags items whose normalized word matches a candidate", () => {
    const vocabulary = [
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
      { word: "memorable", meaning: "worth remembering", example: "A memorable day." },
    ];
    const tagged = tagReviewVocabulary(vocabulary, [
      { word: "Lively", meaning: "full of energy", example: "The crowd was lively." },
    ]);
    expect(tagged).toEqual([
      { ...vocabulary[0], review: true },
      vocabulary[1],
    ]);
  });
});
