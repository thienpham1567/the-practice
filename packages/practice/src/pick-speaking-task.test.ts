import { describe, expect, it } from "vitest";
import { pickSpeakingTask } from "./pick-speaking-task";
import { speakingTasksForLevel } from "./speaking-catalog";

describe("pickSpeakingTask", () => {
  it("returns a cue card for the requested level", () => {
    const picked = pickSpeakingTask("B1");
    expect(picked.level).toBe("B1");
    expect(picked.bullets).toHaveLength(3);
  });

  it("skips recently used topics when another card is available", () => {
    const available = speakingTasksForLevel("A2");
    expect(available.length).toBeGreaterThan(1);

    const recent = available.slice(0, -1).map((card) => card.topic);
    const picked = pickSpeakingTask("A2", recent);

    expect(recent).not.toContain(picked.topic);
    expect(picked.level).toBe("A2");
  });

  it("still returns a card when every topic for the level was used recently", () => {
    const recent = speakingTasksForLevel("C1").map((card) => card.topic);
    const picked = pickSpeakingTask("C1", recent);

    expect(picked.level).toBe("C1");
    expect(recent).toContain(picked.topic);
  });
});
