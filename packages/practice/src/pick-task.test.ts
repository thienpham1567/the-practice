import { describe, expect, it } from "vitest";
import { pickTask } from "./pick-task";
import { TASK_CATALOG } from "./task-catalog";
import type { WritingTaskType } from "./types";

describe("pickTask", () => {
  it("skips a recent type when another type remains", () => {
    const recent: WritingTaskType[] = ["picture-sentence"];
    const picked = pickTask(recent);

    expect(picked.type).not.toBe("picture-sentence");
  });

  it("still returns a task when all three types are recent", () => {
    const recent = TASK_CATALOG.map((task) => task.type);
    const picked = pickTask(recent);

    expect(TASK_CATALOG.map((task) => task.type)).toContain(picked.type);
  });

  it("never requires a level", () => {
    expect(pickTask.length).toBe(1);
    expect(pickTask([]).type).toBeDefined();
  });
});
