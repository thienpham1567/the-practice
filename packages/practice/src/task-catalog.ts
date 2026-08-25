import type { Level, TaskSpec } from "./types";

export const TASK_CATALOG: TaskSpec[] = [
  {
    type: "email",
    levels: ["A2", "B1"],
    minWords: 80,
    maxWords: 120,
    timeMinutes: 20,
    label: "Email",
    instruction: "Write an email to a specific person for a given purpose.",
  },
  {
    type: "describe-experience",
    levels: ["A2", "B1"],
    minWords: 80,
    maxWords: 120,
    timeMinutes: 20,
    label: "Describe an experience",
    instruction: "Recount an experience and say how you felt about it.",
  },
  {
    type: "letter",
    levels: ["B1", "B2"],
    minWords: 150,
    maxWords: 200,
    timeMinutes: 20,
    label: "Letter",
    instruction: "Write a formal or semi-formal letter (IELTS General Training Task 1).",
  },
  {
    type: "review",
    levels: ["B1", "B2"],
    minWords: 150,
    maxWords: 200,
    timeMinutes: 30,
    label: "Review",
    instruction: "Review something you have experienced and give a recommendation.",
  },
  {
    type: "opinion-essay",
    levels: ["B1", "B2", "C1"],
    minWords: 180,
    maxWords: 250,
    timeMinutes: 30,
    label: "Opinion essay",
    instruction: "State how far you agree and argue your position.",
  },
  {
    type: "discussion-essay",
    levels: ["B2", "C1"],
    minWords: 250,
    maxWords: 300,
    timeMinutes: 40,
    label: "Discussion essay",
    instruction: "Discuss both views and give your own opinion.",
  },
  {
    type: "problem-solution",
    levels: ["B2", "C1"],
    minWords: 250,
    maxWords: 300,
    timeMinutes: 40,
    label: "Problem-solution essay",
    instruction: "Explain the causes and propose solutions.",
  },
  {
    type: "report",
    levels: ["C1"],
    minWords: 250,
    maxWords: 300,
    timeMinutes: 40,
    label: "Report",
    instruction: "Write a report or proposal to a workplace brief.",
  },
];

export function tasksForLevel(level: Level): TaskSpec[] {
  return TASK_CATALOG.filter((task) => task.levels.includes(level));
}
