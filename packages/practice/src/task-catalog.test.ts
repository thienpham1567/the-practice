import { describe, expect, it } from "vitest";
import { TASK_CATALOG } from "./task-catalog";

describe("task catalog", () => {
  it("lists the three TOEIC writing types", () => {
    expect(TASK_CATALOG.map((task) => task.type)).toEqual([
      "picture-sentence",
      "email-request",
      "opinion-essay",
    ]);
  });

  it("sets maxRaw to 3, 4, and 5 respectively", () => {
    expect(TASK_CATALOG.map((task) => task.maxRaw)).toEqual([3, 4, 5]);
  });

  it("uses timeSeconds 90, 600, and 1800", () => {
    expect(TASK_CATALOG.map((task) => task.timeSeconds)).toEqual([90, 600, 1800]);
  });

  it("requires at least 300 words for the opinion essay", () => {
    const essay = TASK_CATALOG.find((task) => task.type === "opinion-essay");
    expect(essay?.minWords).toBe(300);
  });

  it("does not include a levels field", () => {
    for (const task of TASK_CATALOG) {
      expect(task).not.toHaveProperty("levels");
    }
  });

  it("gives every task a non-empty instruction", () => {
    for (const task of TASK_CATALOG) {
      expect(task.instruction.trim().length).toBeGreaterThan(0);
    }
  });
});
