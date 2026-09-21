import { SPEAKING_SAMPLE_SCHEMA, buildSpeakingSamplePrompt } from "./speaking-sample-prompt";

const cue = {
  type: "express-opinion" as const,
  speakSeconds: 60,
  question: "Do you think companies should allow employees to work from home two days a week?",
};

describe("buildSpeakingSamplePrompt", () => {
  it("includes the task type, speak time, and question without IELTS or Part 2", () => {
    const prompt = buildSpeakingSamplePrompt(cue);
    expect(prompt).toContain(cue.type);
    expect(prompt).toContain(cue.question);
    expect(prompt).toContain("60");
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/Part 2/i);
  });

  it("asks for two spoken transcripts, not essays", () => {
    const prompt = buildSpeakingSamplePrompt(cue);
    expect(prompt).toMatch(/two|2/);
    expect(prompt.toLowerCase()).toMatch(/transcript|spoken|speak/);
    expect(prompt.toLowerCase()).toMatch(/not .+ essay|not an essay|not essay/);
    expect(prompt.toLowerCase()).toMatch(/different approaches/);
    expect(prompt.toLowerCase()).toMatch(/no stage directions/);
  });
});

describe("SPEAKING_SAMPLE_SCHEMA", () => {
  it("requires exactly two talk items with text only", () => {
    const schema = SPEAKING_SAMPLE_SCHEMA.schema as {
      properties: {
        talks: {
          minItems: number;
          maxItems: number;
          items: { required: string[]; additionalProperties: boolean };
        };
      };
    };
    expect(schema.properties.talks.minItems).toBe(2);
    expect(schema.properties.talks.maxItems).toBe(2);
    expect(schema.properties.talks.items.required).toEqual(["text"]);
    expect(schema.properties.talks.items.additionalProperties).toBe(false);
  });
});
