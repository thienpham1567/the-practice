import type { TaskSpec } from "./types";

export const TASK_CATALOG: TaskSpec[] = [
  {
    type: "picture-sentence",
    minWords: 1,
    maxWords: 40,
    timeMinutes: 1.5,
    timeSeconds: 90,
    label: "Picture sentence",
    maxRaw: 3,
    instruction:
      "Write one sentence about the picture. You must use both given words (you may change their form).",
  },
  {
    type: "email-request",
    minWords: 40,
    maxWords: 200,
    timeMinutes: 10,
    timeSeconds: 600,
    label: "Email response",
    maxRaw: 4,
    instruction: "Read the email. Reply in 10 minutes. Answer every request.",
  },
  {
    type: "opinion-essay",
    minWords: 300,
    maxWords: 400,
    timeMinutes: 30,
    timeSeconds: 1800,
    label: "Opinion essay",
    maxRaw: 5,
    instruction:
      "State, explain, and support your opinion. An effective essay is typically at least 300 words.",
  },
];
