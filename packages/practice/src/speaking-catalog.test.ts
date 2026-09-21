import { describe, expect, it } from "vitest";
import * as catalog from "./speaking-catalog";
import {
  SPEAKING_SEEDS,
  SPEAKING_TASKS,
  pickSpeakingSpec,
} from "./speaking-catalog";
import { TOEIC_SCENES } from "./toeic-scenes";
import type { SpeakingTaskType } from "./types";

const TYPES: SpeakingTaskType[] = [
  "read-aloud",
  "describe-picture",
  "respond-question",
  "respond-with-info",
  "express-opinion",
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("SPEAKING_TASKS", () => {
  it("lists the five TOEIC speaking types", () => {
    expect(SPEAKING_TASKS.map((task) => task.type)).toEqual(TYPES);
  });

  it("uses official timers, including 60s for express-opinion", () => {
    expect(pickSpeakingSpec("read-aloud")).toMatchObject({
      label: "Read a text aloud",
      prepSeconds: 45,
      speakSeconds: 45,
      maxRaw: 3,
    });
    expect(pickSpeakingSpec("describe-picture")).toMatchObject({
      label: "Describe a picture",
      prepSeconds: 45,
      speakSeconds: 30,
      maxRaw: 3,
    });
    expect(pickSpeakingSpec("respond-question")).toMatchObject({
      label: "Respond to questions",
      prepSeconds: 3,
      speakSeconds: 15,
      maxRaw: 3,
    });
    expect(pickSpeakingSpec("respond-with-info")).toMatchObject({
      label: "Respond using information",
      prepSeconds: 3,
      speakSeconds: 30,
      infoSeconds: 45,
      maxRaw: 3,
    });
    expect(pickSpeakingSpec("express-opinion")).toMatchObject({
      label: "Express an opinion",
      prepSeconds: 45,
      speakSeconds: 60,
      maxRaw: 5,
    });
  });

  it("returns maxRaw 5 only for express-opinion", () => {
    for (const type of TYPES) {
      expect(pickSpeakingSpec(type).maxRaw).toBe(
        type === "express-opinion" ? 5 : 3,
      );
    }
  });

  it("throws for an unknown type", () => {
    expect(() => pickSpeakingSpec("part-2" as SpeakingTaskType)).toThrow(
      /unknown/i,
    );
  });
});

describe("speaking seeds", () => {
  it("gives every type at least three seeds", () => {
    for (const type of TYPES) {
      const seeds = SPEAKING_SEEDS.filter((seed) => seed.type === type);
      expect(seeds.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives read-aloud passages of 40–60 words", () => {
    const passages = SPEAKING_SEEDS.filter((seed) => seed.type === "read-aloud");
    expect(passages.length).toBeGreaterThanOrEqual(3);
    for (const seed of passages) {
      expect(seed.passage).toBeTruthy();
      const words = wordCount(seed.passage ?? "");
      expect(words).toBeGreaterThanOrEqual(40);
      expect(words).toBeLessThanOrEqual(60);
    }
  });

  it("pairs respond-with-info seeds with an info block and a question", () => {
    const seeds = SPEAKING_SEEDS.filter((seed) => seed.type === "respond-with-info");
    for (const seed of seeds) {
      expect(seed.info?.trim().length).toBeGreaterThan(0);
      expect(seed.question?.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives express-opinion a workplace or daily question, not Part 2 bullets", () => {
    const seeds = SPEAKING_SEEDS.filter((seed) => seed.type === "express-opinion");
    for (const seed of seeds) {
      expect(seed.question?.trim().length).toBeGreaterThan(0);
      expect(seed).not.toHaveProperty("bullets");
      expect(seed.question?.toLowerCase()).not.toMatch(/describe a place/);
    }
  });

  it("points describe-picture seeds at a TOEIC scene", () => {
    const sceneIds = new Set(TOEIC_SCENES.map((scene) => scene.id));
    const seeds = SPEAKING_SEEDS.filter((seed) => seed.type === "describe-picture");
    for (const seed of seeds) {
      expect(seed.sceneId).toBeTruthy();
      expect(sceneIds.has(seed.sceneId ?? "")).toBe(true);
    }
  });
});

describe("TOEIC_SCENES", () => {
  it("has at least eight workplace scenes with /toeic/ paths and two words", () => {
    expect(TOEIC_SCENES.length).toBeGreaterThanOrEqual(8);
    for (const scene of TOEIC_SCENES) {
      expect(scene.imageUrl.startsWith("/toeic/")).toBe(true);
      expect(scene.imageUrl.endsWith(".jpg")).toBe(true);
      expect(scene.wordA.trim().length).toBeGreaterThan(0);
      expect(scene.wordB.trim().length).toBeGreaterThan(0);
      expect(scene.alt.trim().length).toBeGreaterThan(0);
      expect(scene.id.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("legacy Part 2 catalog", () => {
  it("does not export speakingTasksForLevel or a Part 2 catalog", () => {
    expect("speakingTasksForLevel" in catalog).toBe(false);
    expect("SPEAKING_CATALOG" in catalog).toBe(false);
  });
});
