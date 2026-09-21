import type { Level } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const SPEAKING_SAMPLE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_sample_talks",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["talks"],
    properties: {
      talks: {
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

export interface SpeakingSampleResult {
  talks: { text: string }[];
}

export function buildSpeakingSamplePrompt(
  cue: { topic: string; bullets: string[] },
  level: Level,
): string {
  return (
    `Write two complete spoken model answers as transcripts for this IELTS Speaking Part 2 cue card, ` +
    `for a learner to study as reference.\n\n` +
    `CEFR level: ${level}\n` +
    `Topic: ${cue.topic}\n` +
    `You should say:\n` +
    cue.bullets.map((b) => `- ${b}`).join("\n") +
    `\n\n` +
    `Target length: 150–250 words each (about 90–120 seconds of speech).\n\n` +
    `Write exactly two talks that both fully cover the three bullets but take genuinely ` +
    `different approaches — different structure, angle, or tone — so the learner sees ` +
    `there is more than one way to do this well. Both must sit clearly within level ` +
    `${level}: natural and correct for a strong ${level} speaker, not one level above.\n` +
    `Write as speech, not an essay: contractions and discourse markers are fine. ` +
    `No stage directions and no commentary.`
  );
}
