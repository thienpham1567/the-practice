import type { Level, TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const GENERATE_TASK_SCHEMA: JsonSchemaSpec = {
  name: "practice_task",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "ideas", "vocabulary"],
    properties: {
      prompt: { type: "string" },
      ideas: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
        maxItems: 6,
      },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["word", "meaning", "example"],
          properties: {
            word: { type: "string" },
            meaning: { type: "string" },
            example: { type: "string" },
          },
        },
      },
    },
  },
};

export interface GeneratedTask {
  prompt: string;
  ideas: string[];
  vocabulary: { word: string; meaning: string; example: string }[];
}

export type ReviewWord = { word: string; meaning: string; example: string };

/**
 * The catalog instruction is the fixed exam frame. The model only invents a
 * concrete topic so generated prompts stay on-spec across runs.
 */
export function buildGeneratePrompt(
  task: TaskSpec,
  level: Level,
  reviewWords?: ReviewWord[],
): string {
  const base =
    `You write English exam prompts for CEFR level ${level}.\n\n` +
    `Task type: ${task.label} (${task.type})\n` +
    `Fixed instruction (copy this into the prompt; do not rewrite the frame): "${task.instruction}"\n` +
    `Target length: ${task.minWords}–${task.maxWords} words.\n` +
    `Time allowed: ${task.timeMinutes} minutes.\n\n` +
    `Invent a specific, original topic suitable for ${level}. ` +
    `The prompt field must include the situation/topic AND the fixed instruction above.\n` +
    `Give 4–6 short development ideas the writer might use, and 6–8 useful vocabulary items ` +
    `with meaning and a short example sentence.\n` +
    `Write everything in English. Do not write a sample essay.`;

  if (!reviewWords || reviewWords.length === 0) {
    return base;
  }

  const list = reviewWords
    .map(
      (item) =>
        `- ${item.word}: ${item.meaning} (e.g. ${item.example})`,
    )
    .join("\n");

  return (
    base +
    `\n\nReview vocabulary (optional reuse):\n${list}\n` +
    `Decide the topic FIRST. Then include 0–4 of these review words in the vocabulary ` +
    `list only when they fit the topic; generate the rest as new words.`
  );
}
