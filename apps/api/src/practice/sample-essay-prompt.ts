import type { Level, TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const SAMPLE_ESSAY_SCHEMA: JsonSchemaSpec = {
  name: "practice_sample_essays",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["essays"],
    properties: {
      essays: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" },
          },
        },
      },
    },
  },
};

export interface SampleEssayResult {
  essays: { text: string }[];
}

/**
 * Bám theo level của task, không phải luôn viết ở mức cao nhất — người học
 * A2 cần bài mẫu trong tầm với, không phải bài band 9 xa vời.
 */
export function buildSampleEssayPrompt(
  task: TaskSpec,
  promptText: string,
  level: Level,
): string {
  return (
    `Write two complete, high-quality model answers for this English exam task, ` +
    `for a learner to study as reference.\n\n` +
    `Task type: ${task.label}\n` +
    `CEFR level: ${level}\n` +
    `Instruction: ${task.instruction}\n` +
    `Prompt given to the writer:\n${promptText}\n\n` +
    `Target length: ${task.minWords}-${task.maxWords} words each.\n\n` +
    `Write exactly two essays that both fully answer the prompt but take genuinely ` +
    `different approaches — different structure, angle, or tone — so the learner sees ` +
    `there is more than one way to do this well. Both must sit clearly within level ` +
    `${level}: natural and correct for a strong ${level} writer, not one level above.`
  );
}
