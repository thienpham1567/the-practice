import type { SpeakingSeed, SpeakingTaskSpec, SpeakingTaskType } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";
import type { VocabSuggestItem } from "../practice/vocab.service";

export const SPEAKING_GENERATE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_cue_card",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["passage", "question", "info", "structure", "vocabulary"],
    properties: {
      passage: { type: "string" },
      question: { type: "string" },
      info: { type: "string" },
      structure: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
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
  passage: string;
  question: string;
  info: string;
  structure: string[];
  vocabulary: { word: string; meaning: string; example: string }[];
}

export type ReviewWord = VocabSuggestItem;

function seedLines(seed: SpeakingSeed): string {
  const lines = [`Type: ${seed.type}`, `Key: ${seed.key}`];
  if (seed.passage) lines.push(`Passage: ${seed.passage}`);
  if (seed.question) lines.push(`Question: ${seed.question}`);
  if (seed.info) lines.push(`Information:\n${seed.info}`);
  if (seed.sceneId) lines.push(`Picture scene: ${seed.sceneId}`);
  return lines.join("\n");
}

function payloadInstructions(seed: SpeakingSeed): string {
  switch (seed.type) {
    case "read-aloud":
      return (
        `Invent an original workplace announcement or notice of about 40–60 words. ` +
        `Put it in the passage field. Leave question and info empty.`
      );
    case "describe-picture":
      return (
        `Do not invent an image — the server already selected a photograph. ` +
        `Leave passage, question, and info empty.`
      );
    case "respond-question":
      return (
        `Invent a specific, original workplace or daily-life question. ` +
        `Put it in the question field. Leave passage and info empty.`
      );
    case "respond-with-info":
      return (
        `Invent a short information block (a schedule, notice, or table as text) and a question ` +
        `that uses that information. Put them in the info and question fields. Leave passage empty.`
      );
    case "express-opinion":
      return (
        `Invent a specific, original workplace or daily-life opinion question. ` +
        `Put it in the question field. Leave passage and info empty.`
      );
  }
}

function structureInstructions(type: SpeakingTaskType): string {
  const glance =
    `Give short talking beats the candidate can glance at during prep. ` +
    `Each beat is a phrase, not a full sentence to read aloud.`;
  switch (type) {
    case "describe-picture":
      return `${glance} Structure them overall → people → place → close.`;
    case "express-opinion":
      return `${glance} Structure them stance → reason → example → close.`;
    case "read-aloud":
      return `${glance} Structure them opening → key fact → extra detail → close.`;
    case "respond-question":
      return `${glance} Structure them answer → reason → example → close.`;
    case "respond-with-info":
      return `${glance} Structure them find the fact → state it → extra detail from the info → close.`;
  }
}

/**
 * Catalog seed is inspiration only. The model invents a fresh TOEIC speaking
 * prompt of the same type. Never a sample talk.
 */
export function buildSpeakingGeneratePrompt(
  seed: SpeakingSeed,
  spec: SpeakingTaskSpec,
  reviewWords?: ReviewWord[],
): string {
  const base =
    `You write TOEIC Speaking prompts for workplace and daily English.\n\n` +
    `Seed (inspiration only — invent a different original prompt of the same type):\n` +
    seedLines(seed) +
    `\n\n` +
    `Task type: ${spec.label} (${spec.type})\n` +
    `Prep: ${spec.prepSeconds} seconds. Speak: ${spec.speakSeconds} seconds.\n\n` +
    `${payloadInstructions(seed)} ` +
    `${structureInstructions(seed.type)}\n` +
    `Give 6–8 useful spoken chunks (collocations or short phrases a candidate would actually say) ` +
    `with meaning and a short example sentence they could speak.\n` +
    `Write everything in English. Do not write a sample answer or transcript.`;

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
