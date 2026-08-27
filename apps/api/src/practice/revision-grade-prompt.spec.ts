import { TASK_CATALOG } from "@writing-helper/practice";
import type { GradeResult } from "./grade-prompt";
import {
  buildRevisionGradePrompt,
  REVISION_GRADE_SCHEMA,
} from "./revision-grade-prompt";

const essay = TASK_CATALOG.find((task) => task.type === "opinion-essay")!;

const parentFeedback: GradeResult["feedback"] = {
  taskResponse: "Address both sides of the argument more clearly.",
  coherenceCohesion: "Use clearer paragraph transitions.",
  lexicalResource: "Replace repeated words with precise vocabulary.",
  grammaticalRange: "Use a wider range of complex sentences.",
  overview: "Solid structure but limited development.",
  nextFocus: "Expand each body paragraph with one concrete example.",
};

describe("buildRevisionGradePrompt", () => {
  it("includes each old feedback point verbatim and the old band", () => {
    const prompt = buildRevisionGradePrompt({
      task: essay,
      promptText: "Some people think cities should ban cars.",
      essay: "Cities should ban cars because...",
      wordCount: 180,
      parentFeedback,
      parentBand: 5.5,
    });

    expect(prompt).toContain(parentFeedback.taskResponse);
    expect(prompt).toContain(parentFeedback.coherenceCohesion);
    expect(prompt).toContain(parentFeedback.lexicalResource);
    expect(prompt).toContain(parentFeedback.grammaticalRange);
    expect(prompt).toContain(parentFeedback.overview);
    expect(prompt).toContain(parentFeedback.nextFocus);
    expect(prompt).toContain("5.5");
  });

  it("does not include the parent's old essay text", () => {
    const parentEssay =
      "PARENT_OLD_ESSAY_MARKER: In conclusion cars are bad for the city air.";
    const prompt = buildRevisionGradePrompt({
      task: essay,
      promptText: "Some people think cities should ban cars.",
      essay: "Revised essay about urban transport policy.",
      wordCount: 200,
      parentFeedback,
      parentBand: 6.0,
    });

    expect(prompt).not.toContain(parentEssay);
    expect(prompt).not.toContain("PARENT_OLD_ESSAY_MARKER");
    expect(prompt).toContain("Revised essay about urban transport policy.");
  });
});

describe("REVISION_GRADE_SCHEMA", () => {
  it("extends the grade schema with a required feedbackAudit array and status enum", () => {
    const schema = REVISION_GRADE_SCHEMA.schema;
    const properties = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];

    expect(properties).toHaveProperty("scores");
    expect(properties).toHaveProperty("feedback");
    expect(properties).toHaveProperty("feedbackAudit");
    expect(required).toEqual(
      expect.arrayContaining(["scores", "feedback", "feedbackAudit"]),
    );

    const feedbackAudit = properties.feedbackAudit as {
      type: string;
      items: {
        type: string;
        required: string[];
        properties: {
          point: { type: string };
          status: { type: string; enum: string[] };
        };
      };
    };

    expect(feedbackAudit.type).toBe("array");
    expect(feedbackAudit.items.required).toEqual(
      expect.arrayContaining(["point", "status"]),
    );
    expect(feedbackAudit.items.properties.point.type).toBe("string");
    expect(feedbackAudit.items.properties.status.enum).toEqual(
      expect.arrayContaining(["resolved", "partial", "unresolved"]),
    );
  });
});
