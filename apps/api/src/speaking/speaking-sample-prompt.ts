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

export function buildSpeakingSamplePrompt(cue: {
  type: string;
  speakSeconds: number;
  passage?: string;
  question?: string;
  info?: string;
  topic?: string;
  bullets?: string[];
}): string {
  const payload = [
    cue.passage ? `Passage:\n${cue.passage}` : "",
    cue.info ? `Information:\n${cue.info}` : "",
    cue.question ? `Question: ${cue.question}` : "",
    cue.topic ? `Topic: ${cue.topic}` : "",
    cue.bullets?.length ? `Beats:\n${cue.bullets.map((b) => `- ${b}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `Write two complete spoken model answers as transcripts for this TOEIC Speaking task, ` +
    `for a learner to study as reference.\n\n` +
    `Task type: ${cue.type}\n` +
    `Speak for about ${cue.speakSeconds} seconds.\n` +
    `${payload}\n\n` +
    `Write exactly two talks that both fully answer the prompt but take genuinely ` +
    `different approaches — different structure, angle, or tone — so the learner sees ` +
    `there is more than one way to do this well. ` +
    `Write as speech, not an essay: contractions and discourse markers are fine. ` +
    `No stage directions and no commentary.`
  );
}
