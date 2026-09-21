import type { TaskSpec } from "@writing-helper/practice";
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

function modelInstructions(task: TaskSpec): string {
  if (task.type === "picture-sentence") {
    return (
      `Write exactly two model answers. Each must be one sentence that uses both given words ` +
      `(you may change their form) and describes the picture. Take different approaches — ` +
      `different subject or detail — so the learner sees more than one way to do this well. ` +
      `These are TOEIC Writing picture-sentence models, not IELTS essays.`
    );
  }
  if (task.type === "email-request") {
    return (
      `Write exactly two complete model emails. Each email must answer every request in the prompt. ` +
      `Take genuinely different approaches — different structure, angle, or tone — so the learner sees ` +
      `there is more than one way to do this well. These are TOEIC Writing email-response models, not IELTS essays.`
    );
  }
  return (
    `Write exactly two complete model opinion essays of at least 300 words each. ` +
    `Take genuinely different approaches — different structure, angle, or tone — so the learner sees ` +
    `there is more than one way to do this well. These are TOEIC Writing opinion-essay models, not IELTS essays.`
  );
}

/**
 * Two TOEIC model answers for the same prompt. Shape is always essays[2];
 * content follows the writing task type. No CEFR level — attempts store "TOEIC".
 */
export function buildSampleEssayPrompt(task: TaskSpec, promptText: string): string {
  return (
    `Write two complete, high-quality TOEIC Writing model answers for this task, ` +
    `for a learner to study as reference.\n\n` +
    `Task type: ${task.label}\n` +
    `Instruction: ${task.instruction}\n` +
    `Prompt given to the writer:\n${promptText}\n\n` +
    `Target length: ${task.minWords}-${task.maxWords} words each.\n\n` +
    modelInstructions(task)
  );
}
