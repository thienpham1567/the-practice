import { describe, expect, it } from "vitest";
import { TASK_CATALOG, tasksForLevel } from "./task-catalog";
import type { Level } from "./types";

const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

describe("task catalog", () => {
  it("lists eight task types from the spec", () => {
    expect(TASK_CATALOG.map((task) => task.type)).toEqual([
      "email",
      "describe-experience",
      "letter",
      "review",
      "opinion-essay",
      "discussion-essay",
      "problem-solution",
      "report",
    ]);
  });

  it("gives every level at least two task types", () => {
    for (const level of LEVELS) {
      expect(tasksForLevel(level).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not give A2 any 250-word tasks", () => {
    for (const task of tasksForLevel("A2")) {
      expect(task.minWords).toBeLessThan(250);
      expect(task.maxWords).toBeLessThan(250);
    }
  });

  it("gives every task a non-empty instruction", () => {
    for (const task of TASK_CATALOG) {
      expect(task.instruction.trim().length).toBeGreaterThan(0);
    }
  });

  it("matches the spec word counts, times, and levels", () => {
    const byType = Object.fromEntries(TASK_CATALOG.map((task) => [task.type, task]));

    expect(byType.email).toMatchObject({
      levels: ["A2", "B1"],
      minWords: 80,
      maxWords: 120,
      timeMinutes: 20,
    });
    expect(byType["describe-experience"]).toMatchObject({
      levels: ["A2", "B1"],
      minWords: 80,
      maxWords: 120,
      timeMinutes: 20,
    });
    expect(byType.letter).toMatchObject({
      levels: ["B1", "B2"],
      minWords: 150,
      maxWords: 200,
      timeMinutes: 20,
    });
    expect(byType.review).toMatchObject({
      levels: ["B1", "B2"],
      minWords: 150,
      maxWords: 200,
      timeMinutes: 30,
    });
    expect(byType["opinion-essay"]).toMatchObject({
      levels: ["B1", "B2", "C1"],
      minWords: 180,
      maxWords: 250,
      timeMinutes: 30,
    });
    expect(byType["discussion-essay"]).toMatchObject({
      levels: ["B2", "C1"],
      minWords: 250,
      maxWords: 300,
      timeMinutes: 40,
    });
    expect(byType["problem-solution"]).toMatchObject({
      levels: ["B2", "C1"],
      minWords: 250,
      maxWords: 300,
      timeMinutes: 40,
    });
    expect(byType.report).toMatchObject({
      levels: ["C1"],
      minWords: 250,
      maxWords: 300,
      timeMinutes: 40,
    });
  });
});
