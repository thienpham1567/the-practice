import { TASK_CATALOG } from "@writing-helper/practice";
import { buildGeneratePrompt, GENERATE_TASK_SCHEMA } from "./generate-prompt";

const email = TASK_CATALOG.find((task) => task.type === "email")!;

describe("buildGeneratePrompt", () => {
  it("embeds the task instruction and word-count range", () => {
    const prompt = buildGeneratePrompt(email, "A2");

    expect(prompt).toContain(email.instruction);
    expect(prompt).toContain("80");
    expect(prompt).toContain("120");
    expect(prompt).toContain("A2");
  });

  it("tells the model to invent the topic, not the task frame", () => {
    const prompt = buildGeneratePrompt(email, "B1");

    expect(prompt.toLowerCase()).toContain("topic");
    expect(prompt).toContain(email.instruction);
  });
});

describe("GENERATE_TASK_SCHEMA", () => {
  it("requires prompt, ideas, and vocabulary", () => {
    const required = GENERATE_TASK_SCHEMA.schema.required as string[];
    expect(required).toEqual(expect.arrayContaining(["prompt", "ideas", "vocabulary"]));
  });
});
