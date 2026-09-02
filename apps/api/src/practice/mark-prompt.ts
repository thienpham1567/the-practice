import { MARK_CATEGORIES } from "@writing-helper/practice";
import type { MarkCategory, TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

/**
 * What the model returns. No `severity`: the tier belongs to the label, and is
 * derived in `resolveWritingMarks` rather than asked for and reconciled.
 */
export interface RawWritingMark {
  quote: string;
  occurrence: number;
  category: MarkCategory;
  correction: string;
  note: string;
}

export interface ExtractMarksResult {
  marks: RawWritingMark[];
}

export const EXTRACT_MARKS_SCHEMA: JsonSchemaSpec = {
  name: "practice_marks",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["marks"],
    properties: {
      marks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "occurrence", "category", "correction", "note"],
          properties: {
            quote: { type: "string" },
            occurrence: { type: "integer", minimum: 1 },
            category: { type: "string", enum: [...MARK_CATEGORIES] },
            correction: { type: "string" },
            note: { type: "string" },
          },
        },
      },
    },
  },
};

export function buildMarkPrompt(
  task: TaskSpec,
  promptText: string,
  essay: string,
): string {
  return (
    `You mark language mistakes in English exam writing.\n\n` +
    `Task type: ${task.label}\n` +
    `Assignment given to the writer:\n${promptText}\n\n` +
    // Register only means anything against a reader. The task type alone says
    // "an email"; the assignment says whether it goes to a friend or a landlord.
    `Judge register against that assignment — who the writer is addressing, and why.\n\n` +
    `Writer's response:\n${essay}\n\n` +
    `List every mistake worth correcting. For each one:\n` +
    `- "quote": copy the exact substring from the response, character for character. ` +
    `Never paraphrase it and never fix it inside the quote. Keep it short — the ` +
    `smallest span that still contains the mistake.\n` +
    `- "occurrence": 1 if that substring appears once in the response; otherwise ` +
    `which occurrence you mean, counting from 1.\n` +
    `- "category": the closest label from the fixed list.\n` +
    `- "correction": the corrected version of the quoted span only.\n` +
    `- "note": one short sentence saying why, written for a learner.\n\n` +
    `Do not comment on style, sentence length, or word count — only language ` +
    `mistakes and unnatural word choice. Return an empty list if there are none.`
  );
}
