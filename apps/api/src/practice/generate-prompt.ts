import type { TaskSpec } from "@writing-helper/practice";
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

function topicInstructions(task: TaskSpec): string {
  if (task.type === "picture-sentence") {
    return (
      `Do not invent an image — the server already selected a photograph and two required words. ` +
      `The prompt field is unused for this task; invent 4–6 short idea beats about what a sentence ` +
      `about a workplace or daily picture might mention, plus vocabulary.`
    );
  }
  if (task.type === "email-request") {
    return (
      `Invent a specific, original workplace or daily-life email topic that includes 2–3 requests ` +
      `the writer must answer. The prompt field must contain ONLY that email and its requests — ` +
      `do not include the fixed exam frame.`
    );
  }
  return (
    `Invent one specific, original workplace or daily-life opinion issue. ` +
    `The prompt field must contain ONLY that issue — do not include the fixed exam frame.`
  );
}

/**
 * The catalog instruction is the fixed exam frame. The model invents a
 * workplace/daily topic (or idea beats for picture-sentence).
 */
export function buildGeneratePrompt(
  task: TaskSpec,
  reviewWords?: ReviewWord[],
): string {
  const base =
    `You write English exam prompts for TOEIC Writing practice in workplace and daily settings.\n\n` +
    `Task type: ${task.label} (${task.type})\n` +
    `Fixed exam frame (context only — the server appends this; do not rewrite or embed it): "${task.instruction}"\n` +
    `Target length: ${task.minWords}–${task.maxWords} words.\n` +
    `Time allowed: ${task.timeMinutes} minutes.\n\n` +
    `${topicInstructions(task)}\n` +
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
