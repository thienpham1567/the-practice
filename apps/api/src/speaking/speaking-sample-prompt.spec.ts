import { SPEAKING_SAMPLE_SCHEMA, buildSpeakingSamplePrompt } from "./speaking-sample-prompt";

const cue = {
  topic: "Describe a festival you enjoyed",
  bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
};

describe("buildSpeakingSamplePrompt", () => {
  it("includes level, topic, and all cue bullets", () => {
    const prompt = buildSpeakingSamplePrompt(cue, "B1");
    expect(prompt).toContain("B1");
    expect(prompt).toContain(cue.topic);
    expect(prompt).toContain(cue.bullets[0]);
    expect(prompt).toContain(cue.bullets[2]);
  });

  it("asks for two spoken transcripts at the learner's level, not essays", () => {
    const prompt = buildSpeakingSamplePrompt(cue, "A2");
    expect(prompt).toMatch(/two|2/);
    expect(prompt).toMatch(/150-250|150–250/);
    expect(prompt.toLowerCase()).toMatch(/transcript|spoken|speak/);
    expect(prompt.toLowerCase()).toMatch(/not .+ essay|not an essay|not essay/);
    expect(prompt).toContain("within level A2");
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
