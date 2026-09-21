import { pickSpeakingSpec } from "@writing-helper/practice";
import type { SpeakingSeed } from "@writing-helper/practice";
import { buildSpeakingGeneratePrompt, SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";

const opinionSeed: SpeakingSeed = {
  type: "express-opinion",
  key: "wfh-two-days",
  question:
    "Do you think companies should allow employees to work from home two days a week? Give reasons for your opinion.",
};

const opinionSpec = pickSpeakingSpec("express-opinion");

describe("buildSpeakingGeneratePrompt", () => {
  it("embeds the seed type and question without IELTS, Part 2, or a CEFR level", () => {
    const prompt = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec);

    expect(prompt).toContain(opinionSeed.type);
    expect(prompt).toContain(opinionSeed.question);
    expect(prompt.toLowerCase()).toMatch(/toeic/);
    expect(prompt.toLowerCase()).toMatch(/invent|original|different/);
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/Part 2/i);
    expect(prompt).not.toMatch(/CEFR/i);
    expect(prompt).not.toMatch(/\bA2\b|\bB1\b|\bB2\b|\bC1\b/);
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
    const prompt = buildSpeakingGeneratePrompt(mixed, pickSpeakingSpec(mixed.type));

    expect(prompt).toContain(mixed.passage);
    expect(prompt).toContain(mixed.info);
    expect(prompt).toContain(mixed.question);
    expect(prompt).toContain(mixed.sceneId);
  });

  it("asks read-aloud to invent a 40–60 word passage", () => {
    const seed: SpeakingSeed = {
      type: "read-aloud",
      key: "cafeteria-hours",
      passage: "Good morning. The staff cafeteria on the second floor will open at seven thirty.",
    };
    const prompt = buildSpeakingGeneratePrompt(seed, pickSpeakingSpec(seed.type)).toLowerCase();

    expect(prompt).toMatch(/40\s*[–-]\s*60|40 to 60|about 40/);
    expect(prompt).toMatch(/passage/);
    expect(prompt).toMatch(/do not write a sample|not.*sample answer|not.*transcript/);
  });

  it("tells describe-picture not to invent an image", () => {
    const seed: SpeakingSeed = { type: "describe-picture", key: "scene-office-desk", sceneId: "office-desk" };
    const prompt = buildSpeakingGeneratePrompt(seed, pickSpeakingSpec(seed.type));

    expect(prompt.toLowerCase()).toMatch(/do not invent/);
    expect(prompt.toLowerCase()).toMatch(/image|picture|photograph/);
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/Part 2/i);
  });

  it("asks respond-question for a workplace or daily question", () => {
    const seed: SpeakingSeed = {
      type: "respond-question",
      key: "start-work-time",
      question: "What time do you usually start work, and why?",
    };
    const prompt = buildSpeakingGeneratePrompt(seed, pickSpeakingSpec(seed.type)).toLowerCase();

    expect(prompt).toMatch(/workplace|daily/);
    expect(prompt).toMatch(/question/);
  });

  it("asks respond-with-info for an info block and a question", () => {
    const seed: SpeakingSeed = {
      type: "respond-with-info",
      key: "conference-keynote",
      info: "9:15 Keynote",
      question: "What time does the keynote begin?",
    };
    const prompt = buildSpeakingGeneratePrompt(seed, pickSpeakingSpec(seed.type)).toLowerCase();

    expect(prompt).toMatch(/info|information|schedule|notice/);
    expect(prompt).toMatch(/question/);
  });

  it("asks express-opinion for a workplace or daily opinion question", () => {
    const prompt = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec).toLowerCase();

    expect(prompt).toMatch(/workplace|daily/);
    expect(prompt).toMatch(/opinion/);
    expect(prompt).toMatch(/question/);
  });

  it("tells the model not to write a sample answer", () => {
    const prompt = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec);
    expect(prompt.toLowerCase()).toMatch(/do not write a sample|not.*sample answer/);
  });

  it("asks for five glanceable talking beats and spoken vocabulary chunks", () => {
    const prompt = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec);
    expect(prompt.toLowerCase()).toMatch(/5|five/);
    expect(prompt.toLowerCase()).toMatch(/opening|open/);
    expect(prompt.toLowerCase()).toMatch(/close|closing/);
    expect(prompt.toLowerCase()).toMatch(/phrase|beat|glance/);
    expect(prompt.toLowerCase()).toMatch(/not a full sentence to read aloud/);
    expect(prompt).toMatch(/6–8|6-8/);
    expect(prompt.toLowerCase()).toMatch(/spoken|collocation|chunk/);
  });

  it("when reviewWords is omitted or empty, prompt is byte-identical to the base prompt", () => {
    const base = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec);
    expect(buildSpeakingGeneratePrompt(opinionSeed, opinionSpec, undefined)).toBe(base);
    expect(buildSpeakingGeneratePrompt(opinionSeed, opinionSpec, [])).toBe(base);
  });

  it("when reviewWords is non-empty, instructs topic-first then fit review words into vocabulary", () => {
    const prompt = buildSpeakingGeneratePrompt(opinionSeed, opinionSpec, [
      { word: "commute", meaning: "travel to work", example: "I commute by bus." },
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
    ]);

    expect(prompt).toContain(buildSpeakingGeneratePrompt(opinionSeed, opinionSpec));
    expect(prompt.toLowerCase()).toMatch(/topic.*first|decide.*topic|choose.*topic/i);
    expect(prompt).toContain("commute");
    expect(prompt).toContain("lively");
    expect(prompt).toContain("0–4");
    expect(prompt.toLowerCase()).toMatch(/fit|suitable|match/);
    expect(prompt.toLowerCase()).toMatch(/rest|remaining|new/);
  });
});

describe("SPEAKING_GENERATE_SCHEMA", () => {
  it("requires payload fields plus structure and vocabulary, not IELTS topic+bullets", () => {
    expect(SPEAKING_GENERATE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["passage", "question", "info", "structure", "vocabulary"]),
    );
    expect(SPEAKING_GENERATE_SCHEMA.schema.required).not.toEqual(
      expect.arrayContaining(["topic", "bullets"]),
    );
  });

  it("requires exactly five structure beats", () => {
    const properties = SPEAKING_GENERATE_SCHEMA.schema.properties as Record<
      string,
      { minItems?: number; maxItems?: number }
    >;
    expect(properties.structure?.minItems).toBe(5);
    expect(properties.structure?.maxItems).toBe(5);
  });
});
