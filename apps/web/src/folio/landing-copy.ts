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

/**
 * Đoạn văn diễn ở hero. Ba lỗi này không bịa: chúng nằm trong nhóm năm lỗi mà
 * model tìm thấy 5/5 lần với nhãn nhất quán tuyệt đối, đo được ở
 * docs/superpowers/specs/2026-09-02-grading-variance-measurement.md mục 3.
 * Nhãn khớp MARK_LABELS trong packages/practice/src/mark-catalog.ts.
 */
export const LANDING_DEMO = {
  lead: "I am very happy that you",
  fixes: [
    { wrong: "will come", right: "are coming", label: "Verb tense" },
    { wrong: "three activity", right: "three activities", label: "Singular / plural" },
    { wrong: "in weekend", right: "at the weekend", label: "Prepositions" },
  ],
  tail: [" to my city. I want to suggest ", " we can do together ", "."],
  caption: "3 mistakes · fixed",
} as const;

/** Minh hoạ sổ lỗi. Hằng, không gọi API: landing là trang công khai. */
export const LANDING_MISTAKES = {
  kicker: "Your notebook",
  lines: ["The same mistakes", "stop hiding after a week."],
  tallies: [
    { label: "Articles", count: 7 },
    { label: "Verb tense", count: 5 },
    { label: "Prepositions", count: 4 },
  ],
} as const;

/** Minh hoạ biểu đồ band. Cũng là hằng, cùng lý do. */
export const LANDING_TREND = {
  kicker: "Eight weeks",
  lines: ["A band is one paper.", "A line is a habit."],
  bands: [5, 5.5, 5.5, 6, 6, 6.5, 6.5, 7],
} as const;
