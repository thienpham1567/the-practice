import type { JsonSchemaSpec } from "../ai/ai.service";

export const SPEAKING_GRADE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["transcript", "marks", "scores", "feedback"],
    properties: {
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
      scores: {
        type: "object",
        additionalProperties: false,
        required: [
          "fluencyCoherence",
          "lexicalResource",
          "grammaticalRange",
          "pronunciation",
        ],
        properties: {
          fluencyCoherence: { type: "number" },
          lexicalResource: { type: "number" },
          grammaticalRange: { type: "number" },
          pronunciation: { type: "number" },
        },
      },
      feedback: {
        type: "object",
        additionalProperties: false,
        required: [
          "fluencyCoherence",
          "lexicalResource",
          "grammaticalRange",
          "pronunciation",
          "overview",
          "nextFocus",
        ],
        properties: {
          fluencyCoherence: { type: "string" },
          lexicalResource: { type: "string" },
          grammaticalRange: { type: "string" },
          pronunciation: { type: "string" },
          overview: { type: "string" },
          nextFocus: { type: "string" },
        },
      },
    },
  },
};

export interface SpeakingGradeInput {
  topic: string;
  bullets: string[];
  level: string;
}

export interface SpeakingGradeResult {
  transcript: string;
  marks: Array<{
    quote: string;
    kind: "pronunciation" | "hesitation" | "grammar" | "filler";
    note: string;
  }>;
  scores: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRange: number;
    pronunciation: number;
  };
  feedback: {
    fluencyCoherence: string;
    lexicalResource: string;
    grammaticalRange: string;
    pronunciation: string;
    overview: string;
    nextFocus: string;
  };
}

export function buildSpeakingGradePrompt(input: SpeakingGradeInput): string {
  const bullets = input.bullets.map((b) => `- ${b}`).join("\n");
  return (
    `You are an IELTS Speaking Part 2 examiner. Listen to the candidate's recording and grade it.\n\n` +
    `CEFR level context: ${input.level}\n` +
    `Cue card topic: ${input.topic}\n` +
    `Bullets the candidate should cover:\n${bullets}\n\n` +
    `Return:\n` +
    `1) transcript — a plain verbatim transcript of what you hear (no commentary).\n` +
    `2) marks — short verbatim quotes from that transcript where something went wrong ` +
    `(pronunciation, hesitation, grammar, or filler). Each mark needs quote, kind, and a brief note. ` +
    `Quotes must be exact substrings of the transcript. Do not invent character offsets.\n` +
    `3) scores — four criteria from 0 to 9 in 0.5 steps: fluencyCoherence, lexicalResource, ` +
    `grammaticalRange, pronunciation. Do not compute an overall band — the server will.\n` +
    `4) feedback — short comments for each criterion, plus overview and one concrete nextFocus.`
  );
}
