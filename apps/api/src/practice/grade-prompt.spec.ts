import { TASK_CATALOG } from "@writing-helper/practice";
import { buildGradePrompt, GRADE_TASK_SCHEMA } from "./grade-prompt";

const essay = TASK_CATALOG.find((task) => task.type === "opinion-essay")!;

describe("buildGradePrompt", () => {
  it("includes the prompt, actual word count, and minimum length", () => {
    const prompt = buildGradePrompt({
      task: essay,
      promptText: "Some people think cities should ban cars.",
      essay: "I agree because...",
      wordCount: 90,
    });

    expect(prompt).toContain("Some people think cities should ban cars.");
    expect(prompt).toContain("90");
    expect(prompt).toContain(String(essay.minWords));
    expect(prompt).toContain("I agree because...");
  });

  it("instructs a Task Response penalty when the essay is under length", () => {
    const prompt = buildGradePrompt({
      task: essay,
      promptText: "Discuss both views.",
      essay: "Too short.",
      wordCount: 12,
    });

    expect(prompt.toLowerCase()).toMatch(/under|below|short|minimum|length/);
    expect(prompt.toLowerCase()).toMatch(/task response|task achievement/);
  });
});

describe("GRADE_TASK_SCHEMA", () => {
  it("asks for four criterion scores and per-criterion feedback, not an overall band", () => {
    const properties = GRADE_TASK_SCHEMA.schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("scores");
    expect(properties).toHaveProperty("feedback");
    expect(properties).not.toHaveProperty("band");
    expect(GRADE_TASK_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["scores", "feedback"]),
    );
  });
});
