import { describe, expect, it } from "vitest";
import { pickTask } from "./pick-task.js";
import { tasksForLevel } from "./task-catalog.js";

describe("pickTask", () => {
  it("does not return a recently used type when another type is available", () => {
    const available = tasksForLevel("B2");
    expect(available.length).toBeGreaterThan(1);

    const recent = available.slice(0, -1).map((task) => task.type);
    const picked = pickTask("B2", recent);

    expect(recent).not.toContain(picked.type);
    expect(picked.levels).toContain("B2");
  });

  it("still returns a task when every type for the level was used recently", () => {
    const recent = tasksForLevel("A2").map((task) => task.type);
    const picked = pickTask("A2", recent);

    expect(picked.levels).toContain("A2");
    expect(recent).toContain(picked.type);
  });

  it("only returns tasks that belong to the requested level", () => {
    const picked = pickTask("A2", []);
    expect(picked.levels).toContain("A2");
  });
});
