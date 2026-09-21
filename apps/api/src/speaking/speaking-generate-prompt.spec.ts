import { buildSpeakingGeneratePrompt, SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";
import type { SpeakingSeed } from "@writing-helper/practice";

const seed: SpeakingSeed = {
  type: "express-opinion",
  key: "wfh-two-days",
  question:
    "Do you think companies should allow employees to work from home two days a week? Give reasons for your opinion.",
};

describe("buildSpeakingGeneratePrompt", () => {
  it("embeds the seed type, question, and level", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "B1");

    expect(prompt).toContain("B1");
    expect(prompt).toContain(seed.type);
    expect(prompt).toContain(seed.question);
    expect(prompt.toLowerCase()).toMatch(/toeic/);
    expect(prompt.toLowerCase()).toMatch(/invent|original|different/);
    expect(prompt.toLowerCase()).not.toMatch(/part 2/);
  });

  it("puts passage, info, and scene into the prompt when present", () => {
    const mixed: SpeakingSeed = {
      type: "respond-with-info",
      key: "conference-keynote",
      passage: "Please arrive five minutes early.",
      info: "9:15 Keynote: Ms. Elena Park, Hall A",
      question: "What time does the keynote speech begin?",
      sceneId: "office-desk",
    };
    const prompt = buildSpeakingGeneratePrompt(mixed, "A2");

    expect(prompt).toContain(mixed.passage);
    expect(prompt).toContain(mixed.info);
    expect(prompt).toContain(mixed.question);
    expect(prompt).toContain(mixed.sceneId);
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
