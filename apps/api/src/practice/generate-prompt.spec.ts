import { TASK_CATALOG } from "@writing-helper/practice";
import { buildGeneratePrompt, GENERATE_TASK_SCHEMA } from "./generate-prompt";

const email = TASK_CATALOG.find((task) => task.type === "email")!;

describe("buildGeneratePrompt", () => {
  it("embeds the task instruction and word-count range as context", () => {
    const prompt = buildGeneratePrompt(email, "A2");

    expect(prompt).toContain(email.instruction);
    expect(prompt).toContain("80");
    expect(prompt).toContain("120");
    expect(prompt).toContain("A2");
  });

  it("tells the model to invent the topic only, not to copy the fixed instruction", () => {
    const prompt = buildGeneratePrompt(email, "B1");

    expect(prompt.toLowerCase()).toContain("topic");
    expect(prompt).toContain(email.instruction);
    expect(prompt.toLowerCase()).not.toMatch(
      /must include[\s\S]*fixed instruction|copy this into the prompt|copy[\s\S]*instruction into/,
    );
    expect(prompt.toLowerCase()).not.toContain(
      "the prompt field must include the situation/topic and the fixed instruction",
    );
  });

  it("when reviewWords is omitted or empty, prompt is byte-identical to the base prompt", () => {
    const base = buildGeneratePrompt(email, "A2");

    expect(buildGeneratePrompt(email, "A2", undefined)).toBe(base);
    expect(buildGeneratePrompt(email, "A2", [])).toBe(base);
  });

  it("when reviewWords is non-empty, instructs topic-first then fit review words into vocabulary", () => {
    const prompt = buildGeneratePrompt(email, "A2", [
      {
        word: "commute",
        meaning: "travel to work",
        example: "I commute by bus.",
      },
      {
        word: "lively",
        meaning: "full of energy",
        example: "The crowd was lively.",
      },
    ]);

    expect(prompt).toContain(buildGeneratePrompt(email, "A2"));
    expect(prompt.toLowerCase()).toMatch(/topic.*first|decide.*topic|choose.*topic/i);
    expect(prompt).toContain("commute");
    expect(prompt).toContain("lively");
    expect(prompt).toContain("0–4");
    expect(prompt.toLowerCase()).toMatch(/fit|suitable|match/);
    expect(prompt.toLowerCase()).toMatch(/rest|remaining|new/);
  });
});

describe("GENERATE_TASK_SCHEMA", () => {
  it("requires prompt, ideas, and vocabulary", () => {
    const required = GENERATE_TASK_SCHEMA.schema.required as string[];
    expect(required).toEqual(expect.arrayContaining(["prompt", "ideas", "vocabulary"]));
  });
});
