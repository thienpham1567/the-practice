import type { Level, SpeakingCueCard } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const SPEAKING_GENERATE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_cue_card",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["topic", "bullets"],
    properties: {
      topic: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
    },
  },
};

export interface GeneratedCueCard {
  topic: string;
  bullets: [string, string, string] | string[];
}

/**
 * Catalog card is a seed only. The model invents a fresh Part 2 cue card at
 * the same level — topic + exactly three bullet prompts.
 */
export function buildSpeakingGeneratePrompt(seed: SpeakingCueCard, level: Level): string {
  return (
    `You write IELTS Speaking Part 2 cue cards for CEFR level ${level}.\n\n` +
    `Seed (inspiration only — invent a different original topic):\n` +
    `Topic: ${seed.topic}\n` +
    `Bullets:\n` +
    seed.bullets.map((b) => `- ${b}`).join("\n") +
    `\n\n` +
    `Invent a specific, original Part 2 topic suitable for ${level}. ` +
    `Give exactly three short bullet prompts the candidate should cover ` +
    `(who/what/where/when/why style), ending so the speaker can talk for up to 2 minutes.\n` +
    `Write everything in English. Do not write a sample answer.`
  );
}
