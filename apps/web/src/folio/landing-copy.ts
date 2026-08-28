import { TASK_CATALOG } from "@writing-helper/practice";

const email = TASK_CATALOG.find((task) => task.type === "email");
if (!email) throw new Error("TASK_CATALOG is missing email");

export const LANDING_HEADLINE = "Sit the paper. Take the turn.";
export const LANDING_LEDE =
  "Daily writing and a timed long turn, marked like an examiner.";

export const LANDING_PAPER = {
  kicker: "Paper · B1 · Email · 20 min · 80–120 words",
  instruction: email.instruction,
  prompt:
    "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
} as const;

export const LANDING_TALK = {
  kicker: "Talk · B1 · Part 2 · 1 min prep · 2 min",
  instruction: "One minute to prepare. Then speak for up to two minutes.",
  prompt:
    "Describe a place you like to go in your free time. You should say where it is, what you do there, and why you enjoy it.",
} as const;
