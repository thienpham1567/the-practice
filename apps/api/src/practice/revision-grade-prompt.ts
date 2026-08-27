import type { TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";
import {
  GRADE_TASK_SCHEMA,
  type GradeInput,
  type GradeResult,
} from "./grade-prompt";

export type FeedbackAuditStatus = "resolved" | "partial" | "unresolved";

export interface FeedbackAuditItem {
  point: string;
  status: FeedbackAuditStatus;
}

export interface RevisionGradeInput extends GradeInput {
  parentFeedback: GradeResult["feedback"];
  parentBand: number;
  level?: string;
}

export interface RevisionGradeResult extends GradeResult {
  feedbackAudit: FeedbackAuditItem[];
}

const gradeSchema = GRADE_TASK_SCHEMA.schema as {
  type: string;
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, unknown>;
};

export const REVISION_GRADE_SCHEMA: JsonSchemaSpec = {
  name: "practice_revision_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [...gradeSchema.required, "feedbackAudit"],
    properties: {
      ...gradeSchema.properties,
      feedbackAudit: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["point", "status"],
          properties: {
            point: { type: "string" },
            status: {
              type: "string",
              enum: ["resolved", "partial", "unresolved"],
            },
          },
        },
      },
    },
  },
};

function formatFeedbackPoints(feedback: GradeResult["feedback"]): string {
  return (
    `- Task Response: ${feedback.taskResponse}\n` +
    `- Coherence and Cohesion: ${feedback.coherenceCohesion}\n` +
    `- Lexical Resource: ${feedback.lexicalResource}\n` +
    `- Grammatical Range: ${feedback.grammaticalRange}\n` +
    `- Overview: ${feedback.overview}\n` +
    `- Next focus: ${feedback.nextFocus}`
  );
}

export function buildRevisionGradePrompt(input: RevisionGradeInput): string {
  const levelLine = input.level ? `Learner level: ${input.level}\n` : "";

  return (
    `You are an IELTS Writing examiner. Score this revised English response on the four official criteria.\n\n` +
    `Task type: ${input.task.label}\n` +
    levelLine +
    `Instruction: ${input.task.instruction}\n` +
    `Prompt given to the writer:\n${input.promptText}\n\n` +
    `Expected length: ${input.task.minWords}–${input.task.maxWords} words. ` +
    `The writer produced ${input.wordCount} words.\n` +
    `If the response is under the minimum length, lower Task Response, as IELTS does for short answers.\n\n` +
    `This is a revision of a previous attempt that scored band ${input.parentBand}. ` +
    `Do not receive or compare against the previous essay text — grade only this new response, ` +
    `and audit whether each previous feedback point was addressed.\n\n` +
    `Previous feedback points to audit:\n${formatFeedbackPoints(input.parentFeedback)}\n\n` +
    `Writer's revised response:\n${input.essay}\n\n` +
    `Give each criterion a score from 0 to 9 in 0.5 steps. ` +
    `Do not compute an overall band — the server will do that. ` +
    `For feedback, comment on each criterion, add a short overview, and name one concrete thing to do better next time. ` +
    `Also return feedbackAudit: for every previous feedback point above, copy the point text and mark it ` +
    `resolved, partial, or unresolved based on this revised response.`
  );
}
