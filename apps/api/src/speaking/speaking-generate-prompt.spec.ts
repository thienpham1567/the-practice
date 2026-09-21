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

  it("asks for five glanceable talking beats and spoken vocabulary chunks", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "B1");
    expect(prompt.toLowerCase()).toMatch(/5|five/);
    expect(prompt.toLowerCase()).toMatch(/opening|open/);
    expect(prompt.toLowerCase()).toMatch(/close|closing/);
    expect(prompt.toLowerCase()).toMatch(/phrase|beat|glance/);
    expect(prompt.toLowerCase()).toMatch(/not a full sentence to read aloud/);
    expect(prompt).toMatch(/6–8|6-8/);
    expect(prompt.toLowerCase()).toMatch(/spoken|collocation|chunk/);
  });

  it("when reviewWords is omitted or empty, prompt is byte-identical to the base prompt", () => {
    const base = buildSpeakingGeneratePrompt(seed, "A2");
    expect(buildSpeakingGeneratePrompt(seed, "A2", undefined)).toBe(base);
    expect(buildSpeakingGeneratePrompt(seed, "A2", [])).toBe(base);
  });

  it("when reviewWords is non-empty, instructs topic-first then fit review words into vocabulary", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "A2", [
      { word: "commute", meaning: "travel to work", example: "I commute by bus." },
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
    ]);

    expect(prompt).toContain(buildSpeakingGeneratePrompt(seed, "A2"));
    expect(prompt.toLowerCase()).toMatch(/topic.*first|decide.*topic|choose.*topic/i);
    expect(prompt).toContain("commute");
    expect(prompt).toContain("lively");
    expect(prompt).toContain("0–4");
    expect(prompt.toLowerCase()).toMatch(/fit|suitable|match/);
    expect(prompt.toLowerCase()).toMatch(/rest|remaining|new/);
  });
});

describe("SPEAKING_GENERATE_SCHEMA", () => {
  it("requires topic, bullets, structure, and vocabulary", () => {
    expect(SPEAKING_GENERATE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["topic", "bullets", "structure", "vocabulary"]),
    );
  });

  it("requires exactly three bullets and five structure beats", () => {
    const properties = SPEAKING_GENERATE_SCHEMA.schema.properties as Record<
      string,
      { minItems?: number; maxItems?: number }
    >;
    expect(properties.bullets?.minItems).toBe(3);
    expect(properties.bullets?.maxItems).toBe(3);
    expect(properties.structure?.minItems).toBe(5);
    expect(properties.structure?.maxItems).toBe(5);
  });
});
