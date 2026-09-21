import type { TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

const FEEDBACK_KEYS = [
  "grammar",
  "relevance",
  "sentenceVariety",
  "vocabulary",
  "organization",
  "opinionSupport",
  "overview",
  "nextFocus",
  "improvements",
] as const;

export type GradeFeedbackKey = (typeof FEEDBACK_KEYS)[number];

export type GradeFeedback = Record<GradeFeedbackKey, string>;

export const GRADE_TASK_SCHEMA: JsonSchemaSpec = {
  name: "practice_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rawRating", "feedback"],
    properties: {
      rawRating: { type: "integer" },
      feedback: {
        type: "object",
        additionalProperties: false,
        required: [...FEEDBACK_KEYS],
        properties: Object.fromEntries(
          FEEDBACK_KEYS.map((key) => [key, { type: "string" }]),
        ),
      },
    },
  },
};

export interface GradeInput {
  task: TaskSpec;
  promptText: string;
  essay: string;
  wordCount: number;
}

export interface GradeResult {
  rawRating: number;
  feedback: GradeFeedback;
}

function criteriaFor(task: TaskSpec): string {
  if (task.type === "picture-sentence") {
    return (
      `Score a rawRating integer from 0 to 3. ` +
      `Comment on grammar and relevance to the picture. ` +
      `Leave unused feedback keys as empty strings.`
    );
  }
  if (task.type === "email-request") {
    return (
      `Score a rawRating integer from 0 to 4. ` +
      `Comment on sentence variety, vocabulary, and organization. ` +
      `Leave unused feedback keys as empty strings.`
    );
  }
  return (
    `Score a rawRating integer from 0 to 5. ` +
    `Comment on opinion support, grammar, vocabulary, and organization. ` +
    `If the response is under 300 words, lower the rawRating, as ETS does for short essays. ` +
    `Leave unused feedback keys as empty strings.`
  );
}

export function buildGradePrompt(input: GradeInput): string {
  return (
    `You are scoring a TOEIC Writing practice response using ETS criteria for this task type. ` +
    `Do not compute an overall band — the server will map the raw rating.\n\n` +
    `Task type: ${input.task.label}\n` +
    `Instruction: ${input.task.instruction}\n` +
    `Prompt given to the writer:\n${input.promptText}\n\n` +
    `Expected length: ${input.task.minWords}–${input.task.maxWords} words. ` +
    `The writer produced ${input.wordCount} words.\n\n` +
    `Writer's response:\n${input.essay}\n\n` +
    `${criteriaFor(input.task)} ` +
    `For feedback, fill the criteria that apply, add a short overview, and name one concrete thing to do better next time. ` +
    `Also return "improvements": 2-3 short, concrete suggestions for making this specific response ` +
    `better beyond fixing mistakes — a stronger idea to develop, a way to organize it, a more precise ` +
    `word or phrase to reach for. Ground each one in this response, not generic advice.`
  );
}
