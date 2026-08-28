import { buildSpeakingGeneratePrompt, SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";
import type { SpeakingCueCard } from "@writing-helper/practice";

const seed: SpeakingCueCard = {
  level: "B1",
  topic: "Describe a trip you took",
  bullets: ["where you went", "who you went with", "what you did and how you felt"],
};

describe("buildSpeakingGeneratePrompt", () => {
  it("embeds the seed topic and level, asks for an original Part 2 card", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "B1");

    expect(prompt).toContain("B1");
    expect(prompt).toContain(seed.topic);
    expect(prompt).toContain(seed.bullets[0]);
    expect(prompt.toLowerCase()).toMatch(/part 2|cue card/);
    expect(prompt.toLowerCase()).toMatch(/invent|original|different/);
    expect(prompt.toLowerCase()).toMatch(/three|3/);
  });

  it("tells the model not to write a sample answer", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "A2");
    expect(prompt.toLowerCase()).toMatch(/do not write a sample|not.*sample answer/);
  });
});

describe("SPEAKING_GENERATE_SCHEMA", () => {
  it("requires topic and exactly three bullets", () => {
    expect(SPEAKING_GENERATE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["topic", "bullets"]),
    );
    const bullets = (SPEAKING_GENERATE_SCHEMA.schema.properties as Record<string, { minItems?: number; maxItems?: number }>)
      .bullets;
    expect(bullets?.minItems).toBe(3);
    expect(bullets?.maxItems).toBe(3);
  });
});
