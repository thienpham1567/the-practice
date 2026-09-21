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

  it("gives every seed a unique key", () => {
    const keys = SPEAKING_SEEDS.map((seed) => seed.key);
    expect(new Set(keys).size).toBe(keys.length);
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

  it("labels each photo with objects that are actually in the frame", () => {
    expect(
      TOEIC_SCENES.map((scene) => [scene.id, scene.wordA, scene.wordB, scene.alt]),
    ).toEqual([
      [
        "office-desk",
        "notebook",
        "glass",
        "A wooden desk with a closed notebook, a glass of water, and a stack of books.",
      ],
      [
        "night-office",
        "candle",
        "lamp",
        "A desk at night with a notebook, a glass of water, a lit candle, and a lamp.",
      ],
      [
        "meeting-table",
        "note",
        "pen",
        "A desk by a window with a notebook, a handwritten note, a pen, and stacked books.",
      ],
      [
        "conference-room",
        "coffee",
        "notebook",
        "A desk with a coffee cup, an open notebook, stacked books, and a lamp.",
      ],
      [
        "reception-desk",
        "tea",
        "pens",
        "A desk with a cup of tea, an open notebook, a small vase, and a pen holder.",
      ],
      [
        "writing-station",
        "coffee",
        "vase",
        "A desk by a window with stacked books, a coffee cup, a notebook, and a vase of flowers.",
      ],
      [
        "study-corner",
        "cup",
        "scissors",
        "A windowsill with a cup of tea, a notebook, scissors, and old books overlooking a forest.",
      ],
      [
        "planning-board",
        "glass",
        "note",
        "A night desk with a notebook, a glass of water, a handwritten note, and stacked books.",
      ],
    ]);
  });
});

describe("legacy Part 2 catalog", () => {
  it("does not export speakingTasksForLevel or a Part 2 catalog", () => {
    expect("speakingTasksForLevel" in catalog).toBe(false);
    expect("SPEAKING_CATALOG" in catalog).toBe(false);
  });
});
