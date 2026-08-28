import { buildSpeakingGradePrompt, SPEAKING_GRADE_SCHEMA } from "./speaking-grade-prompt";

describe("buildSpeakingGradePrompt", () => {
  it("includes cue card topic and bullets", () => {
    const prompt = buildSpeakingGradePrompt({
      topic: "Describe a memorable meal",
      bullets: ["what you ate", "who you were with", "why it was memorable"],
      level: "B1",
    });

    expect(prompt).toContain("Describe a memorable meal");
    expect(prompt).toContain("what you ate");
    expect(prompt).toContain("B1");
    expect(prompt.toLowerCase()).toMatch(/transcript/);
    expect(prompt.toLowerCase()).toMatch(/verbatim|exact/);
  });

  it("asks for quotes, not character offsets, and no overall band", () => {
    const prompt = buildSpeakingGradePrompt({
      topic: "A hobby",
      bullets: ["a", "b", "c"],
      level: "A2",
    });

    expect(prompt.toLowerCase()).toMatch(/quote/);
    expect(prompt.toLowerCase()).toMatch(/do not invent character offsets|not.*offsets/);
    expect(prompt.toLowerCase()).toMatch(/do not compute an overall band|server will/);
    expect(prompt.toLowerCase()).not.toMatch(/words per minute|filler count|wpm/);
  });
});

describe("SPEAKING_GRADE_SCHEMA", () => {
  it("requires transcript, marks, scores, and feedback without band", () => {
    expect(SPEAKING_GRADE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["transcript", "marks", "scores", "feedback"]),
    );
    const properties = SPEAKING_GRADE_SCHEMA.schema.properties as Record<string, unknown>;
    expect(properties).not.toHaveProperty("band");
    const scores = properties.scores as { required: string[] };
    expect(scores.required).toEqual(
      expect.arrayContaining([
        "fluencyCoherence",
        "lexicalResource",
        "grammaticalRange",
        "pronunciation",
      ]),
    );
  });
});
