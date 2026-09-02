import { MARK_CATEGORIES, TASK_CATALOG } from "@writing-helper/practice";
import { EXTRACT_MARKS_SCHEMA, buildMarkPrompt } from "./mark-prompt";

const emailTask = TASK_CATALOG.find((task) => task.type === "email")!;
const promptText = "Your friend Alex is visiting. Write to Alex about what you can do together.";

describe("buildMarkPrompt", () => {
  it("includes the essay", () => {
    expect(buildMarkPrompt(emailTask, promptText, "I very like it.")).toContain("I very like it.");
  });

  it("names the task type", () => {
    expect(buildMarkPrompt(emailTask, promptText, "hello")).toContain(emailTask.label);
  });

  /**
   * Without the assignment the model cannot tell a note to a friend from a
   * letter to a stranger, and marks an informal sign-off as wrong register.
   */
  it("includes the assignment so register is judged against the real reader", () => {
    expect(buildMarkPrompt(emailTask, promptText, "hello")).toContain(promptText);
  });

  it("demands a verbatim quote", () => {
    expect(buildMarkPrompt(emailTask, promptText, "hello")).toContain("character for character");
  });

  it("keeps style out of scope so it does not fight the rule engine", () => {
    expect(buildMarkPrompt(emailTask, promptText, "hello")).toContain("Do not comment on style");
  });
});

/** The slice of the JSON Schema these assertions read. */
interface MarkItemSchema {
  required: string[];
  properties: { category: { enum: string[] }; [field: string]: unknown };
}

describe("EXTRACT_MARKS_SCHEMA", () => {
  const item = (
    EXTRACT_MARKS_SCHEMA.schema as { properties: { marks: { items: MarkItemSchema } } }
  ).properties.marks.items;

  it("locks category to the closed taxonomy", () => {
    expect(item.properties.category.enum).toEqual([...MARK_CATEGORIES]);
  });

  it("requires every field the resolver reads", () => {
    expect(item.required).toEqual([
      "quote",
      "occurrence",
      "category",
      "correction",
      "note",
    ]);
  });

  it("does not ask the model for severity", () => {
    expect(item.properties).not.toHaveProperty("severity");
  });
});
