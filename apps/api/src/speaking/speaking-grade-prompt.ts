import type { SpeakingTaskType } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

const FEEDBACK_KEYS = [
  "pronunciation",
  "intonationStress",
  "taskAppropriateness",
  "delivery",
  "languageUse",
  "overview",
  "nextFocus",
] as const;

export type SpeakingGradeFeedbackKey = (typeof FEEDBACK_KEYS)[number];

export type SpeakingGradeFeedback = Record<SpeakingGradeFeedbackKey, string>;

export const SPEAKING_GRADE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rawRating", "transcript", "marks", "feedback"],
    properties: {
      rawRating: { type: "integer" },
      transcript: { type: "string" },
      marks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "kind", "note"],
          properties: {
            quote: { type: "string" },
            kind: {
              type: "string",
              enum: ["pronunciation", "hesitation", "grammar", "filler"],
            },
            note: { type: "string" },
          },
        },
      },
      feedback: {
        type: "object",
        additionalProperties: false,
        required: [...FEEDBACK_KEYS],
        properties: Object.fromEntries(FEEDBACK_KEYS.map((key) => [key, { type: "string" }])),
      },
    },
  },
};

export interface SpeakingGradeInput {
  type: SpeakingTaskType;
  speakSeconds: number;
  maxRaw: number;
  passage?: string;
  question?: string;
  info?: string;
  imageUrl?: string;
  topic?: string;
  bullets?: string[];
}

export interface SpeakingGradeResult {
  rawRating: number;
  transcript: string;
  marks: Array<{
    quote: string;
    kind: "pronunciation" | "hesitation" | "grammar" | "filler";
    note: string;
  }>;
  feedback: SpeakingGradeFeedback;
}

function criteriaFor(input: SpeakingGradeInput): string {
  if (input.type === "read-aloud") {
    return (
      `Score a rawRating integer from 0 to 3. ` +
      `Comment on pronunciation and intonation/stress. ` +
      `Leave unused feedback keys as empty strings.`
    );
  }
  if (input.type === "express-opinion") {
    return (
      `Score a rawRating integer from 0 to 5. ` +
      `Comment on task appropriateness, delivery, and language use. ` +
      `Leave unused feedback keys as empty strings.`
    );
  }
  return (
    `Score a rawRating integer from 0 to 3. ` +
    `Comment on task appropriateness, delivery, and language use. ` +
    `Leave unused feedback keys as empty strings.`
  );
}

function cueLines(input: SpeakingGradeInput): string {
  const lines = [
    `Task type: ${input.type}`,
    `Speak time: ${input.speakSeconds} seconds`,
    `Maximum raw rating: ${input.maxRaw}`,
  ];
  if (input.passage) lines.push(`Passage:\n${input.passage}`);
  if (input.info) lines.push(`Information:\n${input.info}`);
  if (input.question) lines.push(`Question: ${input.question}`);
  if (input.imageUrl) lines.push(`Picture: ${input.imageUrl}`);
  if (input.topic) lines.push(`Topic: ${input.topic}`);
  if (input.bullets?.length) {
    lines.push(`Beats:\n${input.bullets.map((b) => `- ${b}`).join("\n")}`);
  }
  return lines.join("\n");
}

export function buildSpeakingGradePrompt(input: SpeakingGradeInput): string {
  return (
    `You are scoring a TOEIC Speaking practice recording using ETS criteria for this task type. ` +
    `Do not compute an overall rating — the server will map the rawRating.\n\n` +
    `${cueLines(input)}\n\n` +
    `Return:\n` +
    `1) transcript — a plain verbatim transcript of what you hear (no commentary).\n` +
    `2) marks — short verbatim quotes from that transcript where something went wrong ` +
    `(pronunciation, hesitation, grammar, or filler). Each mark needs quote, kind, and a brief note. ` +
    `Quotes must be exact substrings of the transcript. Do not invent character offsets.\n` +
    `3) rawRating — an integer on the scale for this task. ${criteriaFor(input)} ` +
    `For feedback, fill the criteria that apply, add a short overview, and name one concrete nextFocus.`
  );
}
