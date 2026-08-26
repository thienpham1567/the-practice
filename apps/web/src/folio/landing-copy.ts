import { TASK_CATALOG } from "@writing-helper/practice";

const email = TASK_CATALOG.find((task) => task.type === "email");
if (!email) throw new Error("TASK_CATALOG is missing email");

export const LANDING_HEADLINE = "Sit the next paper.";
export const LANDING_LEDE =
  "Daily CEFR writing, marked like an examiner.";

export const LANDING_PAPER = {
  kicker: "Paper · B1 · Email · 20 min · 80–120 words",
  instruction: email.instruction,
  prompt:
    "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
} as const;
