import { describe, expect, it } from "vitest";
import { SPEAKING_CATALOG, speakingTasksForLevel } from "./speaking-catalog";
import type { Level } from "./types";

const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

describe("speaking catalog", () => {
  it("gives every level at least three cue cards", () => {
    for (const level of LEVELS) {
      expect(speakingTasksForLevel(level).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives every cue card a topic and exactly three bullets", () => {
    for (const card of SPEAKING_CATALOG) {
      expect(card.topic.trim().length).toBeGreaterThan(0);
      expect(card.bullets).toHaveLength(3);
      for (const bullet of card.bullets) {
        expect(bullet.trim().length).toBeGreaterThan(0);
      }
      expect(LEVELS).toContain(card.level);
    }
  });

  it("only returns cards that belong to the requested level", () => {
    for (const level of LEVELS) {
      for (const card of speakingTasksForLevel(level)) {
        expect(card.level).toBe(level);
      }
    }
  });
});
