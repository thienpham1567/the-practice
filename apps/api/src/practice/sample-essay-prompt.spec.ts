import { TASK_CATALOG } from "@writing-helper/practice";
import { SAMPLE_ESSAY_SCHEMA, buildSampleEssayPrompt } from "./sample-essay-prompt";

const emailTask = TASK_CATALOG.find((task) => task.type === "email")!;
const promptText = "Your friend Alex is visiting. Write to Alex about what you can do together.";

describe("buildSampleEssayPrompt", () => {
  it("includes the task label, level, instruction, and prompt", () => {
    const prompt = buildSampleEssayPrompt(emailTask, promptText, "B1");

    expect(prompt).toContain(emailTask.label);
    expect(prompt).toContain("B1");
    expect(prompt).toContain(emailTask.instruction);
    expect(prompt).toContain(promptText);
  });

  it("states the task's word count range", () => {
    const prompt = buildSampleEssayPrompt(emailTask, promptText, "B1");

    expect(prompt).toContain(`${emailTask.minWords}-${emailTask.maxWords}`);
  });

  it("asks for exactly two essays with different approaches", () => {
    const prompt = buildSampleEssayPrompt(emailTask, promptText, "B1");

    expect(prompt).toContain("two");
    expect(prompt).toMatch(/different approaches/i);
  });

  it("pins the target level so samples don't overshoot a beginner's reach", () => {
    const prompt = buildSampleEssayPrompt(emailTask, promptText, "A2");

    expect(prompt).toContain("within level A2");
    expect(prompt).not.toContain("within level B1");
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
