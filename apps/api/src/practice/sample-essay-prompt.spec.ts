import { TASK_CATALOG } from "@writing-helper/practice";
import { SAMPLE_ESSAY_SCHEMA, buildSampleEssayPrompt } from "./sample-essay-prompt";

const pictureTask = TASK_CATALOG.find((task) => task.type === "picture-sentence")!;
const emailTask = TASK_CATALOG.find((task) => task.type === "email-request")!;
const essayTask = TASK_CATALOG.find((task) => task.type === "opinion-essay")!;
const emailPrompt = "Please reply with your availability and the documents you need.";
const picturePrompt = 'Use "notebook" and "glass" in one sentence about the picture.';
const essayPrompt = "Should offices require employees to work on site?";

describe("buildSampleEssayPrompt", () => {
  it("includes the task label, instruction, and prompt without a CEFR level", () => {
    const prompt = buildSampleEssayPrompt(emailTask, emailPrompt);

    expect(prompt).toContain(emailTask.label);
    expect(prompt).toContain(emailTask.instruction);
    expect(prompt).toContain(emailPrompt);
    expect(prompt).not.toMatch(/CEFR/i);
    expect(prompt).not.toMatch(/\bA2\b|\bB1\b|\bB2\b|\bC1\b/);
  });

  it("asks for one picture sentence that uses both given words", () => {
    const prompt = buildSampleEssayPrompt(pictureTask, picturePrompt).toLowerCase();

    expect(prompt).toMatch(/one sentence/);
    expect(prompt).toMatch(/both/);
    expect(prompt).toContain("notebook");
    expect(prompt).toContain("glass");
    expect(prompt.toLowerCase()).toMatch(/toeic/);
    expect(prompt).not.toMatch(/two IELTS essays/i);
  });

  it("asks for one email that answers the requests", () => {
    const prompt = buildSampleEssayPrompt(emailTask, emailPrompt).toLowerCase();

    expect(prompt).toMatch(/email/);
    expect(prompt).toMatch(/request/);
    expect(prompt).toMatch(/toeic/);
    expect(prompt).not.toMatch(/two IELTS essays/i);
  });

  it("asks for opinion essays of at least 300 words", () => {
    const prompt = buildSampleEssayPrompt(essayTask, essayPrompt).toLowerCase();

    expect(prompt).toMatch(/300/);
    expect(prompt).toMatch(/essay/);
    expect(prompt).toMatch(/toeic/);
    expect(prompt).not.toMatch(/two IELTS essays/i);
  });

  it("asks for exactly two TOEIC model answers with different approaches", () => {
    const prompt = buildSampleEssayPrompt(emailTask, emailPrompt);

    expect(prompt).toContain("two");
    expect(prompt.toLowerCase()).toMatch(/toeic/);
    expect(prompt).toMatch(/different approaches/i);
    expect(prompt).not.toMatch(/two IELTS essays/i);
  });
});

describe("SAMPLE_ESSAY_SCHEMA", () => {
  it("requires exactly two essay items", () => {
    const schema = SAMPLE_ESSAY_SCHEMA.schema as {
      properties: { essays: { minItems: number; maxItems: number } };
    };

    expect(schema.properties.essays.minItems).toBe(2);
    expect(schema.properties.essays.maxItems).toBe(2);
  });

  it("requires each essay to have text and nothing else", () => {
    const schema = SAMPLE_ESSAY_SCHEMA.schema as {
      properties: {
        essays: { items: { required: string[]; additionalProperties: boolean } };
      };
    };

    expect(schema.properties.essays.items.required).toEqual(["text"]);
    expect(schema.properties.essays.items.additionalProperties).toBe(false);
  });
});
