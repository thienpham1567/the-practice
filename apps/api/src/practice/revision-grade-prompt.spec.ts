import { TASK_CATALOG } from "@writing-helper/practice";
import type { GradeResult } from "./grade-prompt";
import {
  buildRevisionGradePrompt,
  parseFeedbackAudit,
  REVISION_GRADE_SCHEMA,
} from "./revision-grade-prompt";

const essay = TASK_CATALOG.find((task) => task.type === "opinion-essay")!;

const parentFeedback: GradeResult["feedback"] = {
  grammar: "Fix article errors in the opening.",
  relevance: "",
  sentenceVariety: "",
  vocabulary: "Replace repeated words with precise vocabulary.",
  organization: "Use clearer paragraph transitions.",
  opinionSupport: "Address both sides of the argument more clearly.",
  overview: "Solid structure but limited development.",
  nextFocus: "Expand each body paragraph with one concrete example.",
  improvements: "Add a concrete example to the second body paragraph.",
};

describe("buildRevisionGradePrompt", () => {
  it("includes each old feedback point verbatim and the old raw rating, without IELTS", () => {
    const prompt = buildRevisionGradePrompt({
      task: essay,
      promptText: "Some people think cities should ban cars.",
      essay: "Cities should ban cars because...",
      wordCount: 180,
      parentFeedback,
      parentRawRating: 3,
      parentMarks: [],
    });

    expect(prompt).not.toMatch(/IELTS/i);
    expect(prompt).not.toMatch(/overall band/i);
    expect(prompt).toContain(parentFeedback.grammar);
    expect(prompt).toContain(parentFeedback.vocabulary);
    expect(prompt).toContain(parentFeedback.organization);
    expect(prompt).toContain(parentFeedback.opinionSupport);
    expect(prompt).toContain(parentFeedback.overview);
    expect(prompt).toContain(parentFeedback.nextFocus);
    expect(prompt).toContain("3");
    expect(prompt).toMatch(/0\s*[–-]\s*5|0 to 5/);
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
      parentRawRating: 3,
      parentMarks: [],
    });

    expect(prompt).not.toContain(parentEssay);
    expect(prompt).not.toContain("PARENT_OLD_ESSAY_MARKER");
    expect(prompt).toContain("Revised essay about urban transport policy.");
    expect(prompt).not.toMatch(/IELTS/i);
  });

  it("includes specific prior corrections and warns against reversing them", () => {
    const prompt = buildRevisionGradePrompt({
      task: essay,
      promptText: "Some people think cities should ban cars.",
      essay: "Cities should ban cars because...",
      wordCount: 180,
      parentFeedback,
      parentRawRating: 3,
      parentMarks: [
        { quote: "Best,", category: "register", correction: "Best regards," },
      ],
    });

    expect(prompt).toContain("Best,");
    expect(prompt).toContain("Best regards,");
    expect(prompt).toMatch(/reverse a recommendation/i);
    expect(prompt).not.toMatch(/IELTS/i);
  });
});

describe("REVISION_GRADE_SCHEMA", () => {
  it("extends the grade schema with a required feedbackAudit array and status enum", () => {
    const schema = REVISION_GRADE_SCHEMA.schema;
    const properties = schema.properties as Record<string, unknown>;
    const required = schema.required as string[];

    expect(properties).toHaveProperty("rawRating");
    expect(properties).not.toHaveProperty("scores");
    expect(properties).toHaveProperty("feedback");
    expect(properties).toHaveProperty("feedbackAudit");
    expect(required).toEqual(
      expect.arrayContaining(["rawRating", "feedback", "feedbackAudit"]),
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

describe("parseFeedbackAudit", () => {
  it("returns a valid audit array unchanged", () => {
    const audit = [
      { point: "Use clearer transitions.", status: "resolved" },
      { point: "Add an example.", status: "partial" },
      { point: "Fix article errors.", status: "unresolved" },
    ];

    expect(parseFeedbackAudit(audit)).toEqual(audit);
  });

  it("returns null when audit is missing", () => {
    expect(parseFeedbackAudit(undefined)).toBeNull();
    expect(parseFeedbackAudit(null)).toBeNull();
  });

  it("returns null when audit is the wrong type", () => {
    expect(parseFeedbackAudit("resolved")).toBeNull();
    expect(parseFeedbackAudit({ point: "x", status: "resolved" })).toBeNull();
  });

  it("returns null when any item is malformed", () => {
    expect(
      parseFeedbackAudit([{ point: "ok", status: "resolved" }, { point: 1, status: "partial" }]),
    ).toBeNull();
    expect(
      parseFeedbackAudit([{ point: "ok", status: "done" }]),
    ).toBeNull();
    expect(parseFeedbackAudit([{ status: "resolved" }])).toBeNull();
    expect(parseFeedbackAudit([{ point: "ok" }])).toBeNull();
  });
});
