import { MARK_CATEGORIES, TASK_CATALOG } from "@writing-helper/practice";
import { EXTRACT_MARKS_SCHEMA, buildMarkPrompt } from "./mark-prompt";

const emailTask = TASK_CATALOG.find((task) => task.type === "email")!;

describe("buildMarkPrompt", () => {
  it("includes the essay", () => {
    expect(buildMarkPrompt(emailTask, "I very like it.")).toContain("I very like it.");
  });

  it("names the task type so register is judged in context", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain(emailTask.label);
  });

  it("demands a verbatim quote", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain("character for character");
  });

  it("keeps style out of scope so it does not fight the rule engine", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain("Do not comment on style");
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
