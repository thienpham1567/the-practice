import type { Level, SpeakingCueCard } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";
import type { VocabSuggestItem } from "../practice/vocab.service";

export const SPEAKING_GENERATE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_cue_card",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["topic", "bullets", "structure", "vocabulary"],
    properties: {
      topic: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      structure: {
        type: "array",
        items: { type: "string" },
        minItems: 5,
        maxItems: 5,
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

export interface GeneratedCueCard {
  topic: string;
  bullets: [string, string, string] | string[];
  structure: string[];
  vocabulary: { word: string; meaning: string; example: string }[];
}

export type ReviewWord = VocabSuggestItem;

/**
 * Catalog card is a seed only. The model invents a fresh Part 2 cue card at
 * the same level — topic + three bullets + prep notes. Never a sample talk.
 */
export function buildSpeakingGeneratePrompt(
  seed: SpeakingCueCard,
  level: Level,
  reviewWords?: ReviewWord[],
): string {
  const base =
    `You write IELTS Speaking Part 2 cue cards for CEFR level ${level}.\n\n` +
    `Seed (inspiration only — invent a different original topic):\n` +
    `Topic: ${seed.topic}\n` +
    `Bullets:\n` +
    seed.bullets.map((b) => `- ${b}`).join("\n") +
    `\n\n` +
    `Invent a specific, original Part 2 topic suitable for ${level}. ` +
    `Give exactly three short bullet prompts the candidate should cover ` +
    `(who/what/where/when/why style), ending so the speaker can talk for up to 2 minutes.\n` +
    `Give exactly 5 short talking beats the candidate can glance at during prep: ` +
    `(1) a one-line opening, (2–4) one beat per cue bullet, (5) a one-line close. ` +
    `Each beat is a phrase, not a full sentence to read aloud.\n` +
    `Give 6–8 useful spoken chunks (collocations or short phrases a candidate would actually say) ` +
    `with meaning and a short example sentence they could speak.\n` +
    `Write everything in English. Do not write a sample answer.`;

  if (!reviewWords || reviewWords.length === 0) {
    return base;
  }

  const list = reviewWords
    .map((item) => `- ${item.word}: ${item.meaning} (e.g. ${item.example})`)
    .join("\n");

  return (
    base +
    `\n\nReview vocabulary (optional reuse):\n${list}\n` +
    `Decide the topic FIRST. Then include 0–4 of these review words in the vocabulary ` +
    `list only when they fit the topic; generate the rest as new words.`
  );
}
