import { TASK_CATALOG } from "@writing-helper/practice";
import { buildGradePrompt, GRADE_TASK_SCHEMA } from "./grade-prompt";

const picture = TASK_CATALOG.find((task) => task.type === "picture-sentence")!;
const email = TASK_CATALOG.find((task) => task.type === "email-request")!;
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
    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/overall band/i);
  });

  it("uses ETS picture-sentence criteria and a 0–3 raw rating", () => {
    const prompt = buildGradePrompt({
      task: picture,
      promptText: 'Use "notebook" and "glass" in one sentence about the picture.',
      essay: "A notebook sits beside a glass of water.",
      wordCount: 9,
    });

    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt.toLowerCase()).toContain("grammar");
    expect(prompt.toLowerCase()).toContain("relevance");
    expect(prompt).toMatch(/0\s*[–-]\s*3|0 to 3/);
  });

  it("uses ETS email-request criteria and a 0–4 raw rating", () => {
    const prompt = buildGradePrompt({
      task: email,
      promptText: "Please reply with your availability and the documents you need.",
      essay: "Dear team, I can meet on Tuesday.",
      wordCount: 8,
    });

    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt.toLowerCase()).toContain("sentence variety");
    expect(prompt.toLowerCase()).toContain("vocabulary");
    expect(prompt.toLowerCase()).toContain("organization");
    expect(prompt).toMatch(/0\s*[–-]\s*4|0 to 4/);
  });

  it("uses ETS opinion-essay criteria, a 0–5 raw rating, and lowers rating under 300 words", () => {
    const prompt = buildGradePrompt({
      task: essay,
      promptText: "Should offices require employees to work on site?",
      essay: "Too short.",
      wordCount: 12,
    });

    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt.toLowerCase()).toContain("opinion");
    expect(prompt.toLowerCase()).toContain("grammar");
    expect(prompt.toLowerCase()).toContain("vocabulary");
    expect(prompt.toLowerCase()).toContain("organization");
    expect(prompt).toMatch(/0\s*[–-]\s*5|0 to 5/);
    expect(prompt.toLowerCase()).toMatch(/300/);
    expect(prompt.toLowerCase()).toMatch(/under|below|short|minimum|length|lower/);
  });
});

describe("GRADE_TASK_SCHEMA", () => {
  it("asks for a rawRating and stable feedback keys, not IELTS scores or a band", () => {
    const properties = GRADE_TASK_SCHEMA.schema.properties as Record<string, unknown>;
    const required = GRADE_TASK_SCHEMA.schema.required as string[];
    const feedback = properties.feedback as {
      required: string[];
      properties: Record<string, { type: string }>;
    };

    expect(required).toEqual(expect.arrayContaining(["rawRating", "feedback"]));
    expect(properties).toHaveProperty("rawRating");
    expect(properties).not.toHaveProperty("scores");
    expect(properties).not.toHaveProperty("band");
    expect(feedback.required).toEqual(
      expect.arrayContaining([
        "grammar",
        "relevance",
        "sentenceVariety",
        "vocabulary",
        "organization",
        "opinionSupport",
        "overview",
        "nextFocus",
        "improvements",
      ]),
    );
    for (const key of feedback.required) {
      expect(feedback.properties[key]?.type).toBe("string");
    }
  });
});
