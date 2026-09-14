import type { TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const GRADE_TASK_SCHEMA: JsonSchemaSpec = {
  name: "practice_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["scores", "feedback"],
    properties: {
      scores: {
        type: "object",
        additionalProperties: false,
        required: [
          "taskResponse",
          "coherenceCohesion",
          "lexicalResource",
          "grammaticalRange",
        ],
        properties: {
          taskResponse: { type: "number" },
          coherenceCohesion: { type: "number" },
          lexicalResource: { type: "number" },
          grammaticalRange: { type: "number" },
        },
      },
      feedback: {
        type: "object",
        additionalProperties: false,
        required: [
          "taskResponse",
          "coherenceCohesion",
          "lexicalResource",
          "grammaticalRange",
          "overview",
          "nextFocus",
          "improvements",
        ],
        properties: {
          taskResponse: { type: "string" },
          coherenceCohesion: { type: "string" },
          lexicalResource: { type: "string" },
          grammaticalRange: { type: "string" },
          overview: { type: "string" },
          nextFocus: { type: "string" },
          improvements: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export interface GradeInput {
  task: TaskSpec;
  promptText: string;
  essay: string;
  wordCount: number;
}

export interface GradeResult {
  scores: {
    taskResponse: number;
    coherenceCohesion: number;
    lexicalResource: number;
    grammaticalRange: number;
  };
  feedback: {
    taskResponse: string;
    coherenceCohesion: string;
    lexicalResource: string;
    grammaticalRange: string;
    overview: string;
    nextFocus: string;
    /** 2-3 whole-essay suggestions — ideas, structure, vocabulary to reach for. */
    improvements: string[];
  };
}

export function buildGradePrompt(input: GradeInput): string {
  return (
    `You are an IELTS Writing examiner. Score this English response on the four official criteria.\n\n` +
    `Task type: ${input.task.label}\n` +
    `Instruction: ${input.task.instruction}\n` +
    `Prompt given to the writer:\n${input.promptText}\n\n` +
    `Expected length: ${input.task.minWords}–${input.task.maxWords} words. ` +
    `The writer produced ${input.wordCount} words.\n` +
    `If the response is under the minimum length, lower Task Response, as IELTS does for short answers.\n\n` +
    `Writer's response:\n${input.essay}\n\n` +
    `Give each criterion a score from 0 to 9 in 0.5 steps. ` +
    `Do not compute an overall band — the server will do that. ` +
    `For feedback, comment on each criterion, add a short overview, and name one concrete thing to do better next time. ` +
    `Also return "improvements": 2-3 short, concrete suggestions for making this specific response ` +
    `better beyond fixing mistakes — a stronger idea to develop, a way to organize it, a more precise ` +
    `word or phrase to reach for. Ground each one in this response, not generic advice.`
  );
}
