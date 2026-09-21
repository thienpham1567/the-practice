import { describe, expect, it } from "vitest";
import { pickSpeakingTask } from "./pick-speaking-task";
import { SPEAKING_SEEDS } from "./speaking-catalog";

describe("pickSpeakingTask", () => {
  it("returns a seed of the requested type", () => {
    const picked = pickSpeakingTask("express-opinion");
    expect(picked.type).toBe("express-opinion");
    expect(picked.key.trim().length).toBeGreaterThan(0);
    expect(picked.question?.trim().length).toBeGreaterThan(0);
  });

  it("skips recently used keys when another seed is available", () => {
    const available = SPEAKING_SEEDS.filter((seed) => seed.type === "read-aloud");
    expect(available.length).toBeGreaterThan(1);

    const recent = available.slice(0, -1).map((seed) => seed.key);
    const picked = pickSpeakingTask("read-aloud", recent);

    expect(picked.type).toBe("read-aloud");
    expect(recent).not.toContain(picked.key);
  });

  it("still returns a seed when every key for the type was used recently", () => {
    const recent = SPEAKING_SEEDS.filter((seed) => seed.type === "respond-question").map(
      (seed) => seed.key,
    );
    const picked = pickSpeakingTask("respond-question", recent);

    expect(picked.type).toBe("respond-question");
    expect(recent).toContain(picked.key);
  });
});
