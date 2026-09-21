import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { overallBand } from "@writing-helper/practice";
import type { AiService } from "../ai/ai.service";
import type { PrismaService } from "../prisma/prisma.service";
import { SPEAKING_GRADE_SCHEMA } from "./speaking-grade-prompt";
import { SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";
import { SPEAKING_SAMPLE_SCHEMA } from "./speaking-sample-prompt";
import { SpeakingService } from "./speaking.service";

const generatedCue = {
  topic: "Describe a festival you enjoyed",
  bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
};

const generatedStructure = [
  "Name the festival in one breath",
  "What it was and when",
  "Who you went with",
  "Why you enjoyed it",
  "Close with how you feel now",
];

const generatedVocabulary = [
  { word: "packed", meaning: "very crowded", example: "The square was packed." },
];

const generatedFull = {
  ...generatedCue,
  structure: generatedStructure,
  vocabulary: generatedVocabulary,
};

const graded = {
  transcript: "Um, I went to a festival last year with my friends.",
  marks: [
    { quote: "Um,", kind: "filler" as const, note: "Filler at the start." },
    { quote: "missing quote", kind: "grammar" as const, note: "Will be dropped." },
  ],
  scores: {
    fluencyCoherence: 6,
    lexicalResource: 6,
    grammaticalRange: 6,
    pronunciation: 5,
  },
  feedback: {
    fluencyCoherence: "Mostly steady.",
    lexicalResource: "Adequate words.",
    grammaticalRange: "Simple sentences.",
    pronunciation: "Clear enough.",
    overview: "A fair B1 talk.",
    nextFocus: "Cut fillers at the start.",
  },
};

function serviceWith(
  overrides: {
    recentTopics?: string[];
    attempt?: Record<string, unknown> | null;
    findFirstResults?: Array<Record<string, unknown> | null>;
    created?: Record<string, unknown>;
    updated?: Record<string, unknown>;
    claimCounts?: number[];
    listRows?: Array<Record<string, unknown>>;
    reviewCandidates?: Array<{ word: string; meaning: string; example: string }>;
    reviewCandidatesError?: Error;
    recordSuggestedError?: Error;
  } = {},
) {
  const claimCounts = [...(overrides.claimCounts ?? [1])];
  const findFirstResults = overrides.findFirstResults
    ? [...overrides.findFirstResults]
    : undefined;

  const speakingAttempt = {
    findMany: jest.fn().mockImplementation(async (args: { select?: { cueCard?: boolean } }) => {
      if (overrides.listRows) return overrides.listRows;
      if (args?.select?.cueCard) {
        return (overrides.recentTopics ?? []).map((topic) => ({
          cueCard: { topic, bullets: ["a", "b", "c"] },
        }));
      }
      return [];
    }),
    findFirst: findFirstResults
      ? jest.fn().mockImplementation(async () =>
          findFirstResults.length > 0 ? findFirstResults.shift()! : null,
        )
      : jest.fn().mockResolvedValue(overrides.attempt ?? null),
    create: jest.fn().mockResolvedValue(overrides.created ?? { id: "s1", ...generatedCue }),
    delete: jest.fn().mockResolvedValue({ id: "s1" }),
    update: jest.fn().mockResolvedValue(overrides.updated ?? { id: "s1" }),
    updateMany: jest.fn().mockImplementation(async () => {
      const count = claimCounts.length > 0 ? claimCounts.shift()! : 0;
      return { count };
    }),
  };

  const prisma = {
    speakingAttempt,
    $transaction: jest.fn(async (fn: (tx: { speakingAttempt: typeof speakingAttempt }) => unknown) =>
      fn({ speakingAttempt }),
    ),
  };

  const complete = jest.fn().mockResolvedValue(generatedFull);
  const ai = { complete } as unknown as AiService;

  const reviewCandidates = jest.fn().mockImplementation(async () => {
    if (overrides.reviewCandidatesError) throw overrides.reviewCandidatesError;
    return overrides.reviewCandidates ?? [];
  });
  const recordSuggested = jest.fn().mockImplementation(async () => {
    if (overrides.recordSuggestedError) throw overrides.recordSuggestedError;
  });
  const vocab = { reviewCandidates, recordSuggested, markUsed: jest.fn() };

  const service = new SpeakingService(
    prisma as unknown as PrismaService,
    ai,
    vocab as never,
  );

  return { service, prisma, complete, vocab };
}

describe("SpeakingService", () => {
  describe("create", () => {
    it("picks a seed, calls speaking.generate, and stores cue card plus prep notes", async () => {
      const { service, prisma, complete } = serviceWith({
        recentTopics: ["Describe a place you like to visit"],
        created: { id: "s1", level: "A2", cueCard: generatedCue },
      });

      await service.create("user-1", { level: "A2" });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: SPEAKING_GENERATE_SCHEMA,
          maxTokens: 1500,
          usage: { userId: "user-1", endpoint: "speaking.generate" },
          prompt: expect.stringContaining("A2"),
        }),
      );
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            level: "A2",
            scale: "toeic",
            taskType: "express-opinion",
            cueCard: {
              ...generatedCue,
              key: "wfh-two-days",
              type: "express-opinion",
            },
            structure: generatedStructure,
            vocabulary: generatedVocabulary,
          }),
        }),
      );
    });

    it("flags matching vocabulary items with review: true and records all suggested", async () => {
      const candidates = [
        { word: "Packed", meaning: "very crowded", example: "The square was packed." },
      ];
      const { service, prisma, complete, vocab } = serviceWith();
      complete.mockResolvedValueOnce({
        ...generatedFull,
        vocabulary: generatedVocabulary,
      });
      vocab.reviewCandidates.mockResolvedValueOnce(candidates);

      await service.create("user-1", { level: "A2" });

      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vocabulary: [{ ...generatedVocabulary[0], review: true }],
          }),
        }),
      );
      expect(vocab.recordSuggested).toHaveBeenCalledWith(
        "user-1",
        "A2",
        generatedVocabulary,
      );
    });

    it("still creates the attempt when recordSuggested throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma } = serviceWith({
        recordSuggestedError: new Error("upsert failed"),
      });

      await expect(service.create("user-1", { level: "A2" })).resolves.toEqual(
        expect.objectContaining({ id: "s1" }),
      );
      expect(prisma.speakingAttempt.create).toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  describe("findOne", () => {
    it("returns parentBand and pendingRevisionId", async () => {
      const { service } = serviceWith({
        attempt: {
          id: "s1",
          userId: "user-1",
          cueCard: generatedCue,
          parent: { band: 6 },
          revisions: [{ id: "rev-1", submittedAt: null }],
        },
      });

      const result = await service.findOne("user-1", "s1");

      expect(result).toMatchObject({
        id: "s1",
        parentBand: 6,
        hasRevision: true,
        pendingRevisionId: "rev-1",
      });
      expect(result).not.toHaveProperty("revisions");
      expect(result).not.toHaveProperty("parent");
    });

    it("404 when missing", async () => {
      const { service } = serviceWith({ attempt: null });
      await expect(service.findOne("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("remove", () => {
    it("404 when the attempt is missing or belongs to someone else", async () => {
      const { service, prisma } = serviceWith({ attempt: null });

      await expect(service.remove("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.speakingAttempt.delete).not.toHaveBeenCalled();
    });

    it("deletes the attempt after confirming ownership", async () => {
      const { service, prisma } = serviceWith({ attempt: { id: "s1" } });

      await service.remove("user-1", "s1");

      expect(prisma.speakingAttempt.findFirst).toHaveBeenCalledWith({
        where: { id: "s1", userId: "user-1" },
        select: { id: true },
      });
      expect(prisma.speakingAttempt.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    });
  });

  describe("submit", () => {
    const draft = {
      id: "s1",
      userId: "user-1",
      level: "B1",
      cueCard: generatedCue,
      startedAt: new Date("2026-08-28T10:00:00Z"),
      submittedAt: null,
      gradingStartedAt: null,
      parentAttemptId: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("rejects short audio before calling AI", async () => {
      const { service, complete } = serviceWith({ attempt: draft });

      await expect(
        service.submit("user-1", "s1", {
          audioBase64: "AAAA",
          format: "wav",
          durationMs: 9_999,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(complete).not.toHaveBeenCalled();
    });

    it("rejects missing audio before calling AI", async () => {
      const { service, complete } = serviceWith({ attempt: draft });

      await expect(
        service.submit("user-1", "s1", {
          audioBase64: "   ",
          format: "wav",
          durationMs: 15_000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(complete).not.toHaveBeenCalled();
    });

    it("computes band server-side, locates marks, and stores fluency", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: draft,
        updated: { id: "s1", band: 6 },
      });
      complete.mockResolvedValueOnce(graded);

      await service.submit("user-1", "s1", {
        audioBase64: "QUFB",
        format: "wav",
        durationMs: 30_000,
      });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: SPEAKING_GRADE_SCHEMA,
          audio: { base64: "QUFB", format: "wav" },
          usage: { userId: "user-1", endpoint: "speaking.grade" },
        }),
      );
      const expectedBand = overallBand([6, 6, 6, 5]);
      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: expectedBand,
            scores: graded.scores,
            feedback: graded.feedback,
            transcript: graded.transcript,
            durationMs: 30_000,
            gradingStartedAt: null,
            marks: [
              {
                start: 0,
                end: 3,
                kind: "filler",
                note: "Filler at the start.",
              },
            ],
            fluency: expect.objectContaining({
              wordsPerMinute: expect.any(Number),
              fillerCount: expect.any(Number),
            }),
          }),
        }),
      );
      expect(expectedBand).toBe(6);
    });

    it("saves scores and transcript with marks null when locateMarks throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma, complete } = serviceWith({
        attempt: draft,
        updated: { id: "s1", band: 6 },
      });
      complete.mockResolvedValueOnce({
        ...graded,
        marks: "not-an-array",
      });

      await service.submit("user-1", "s1", {
        audioBase64: "QUFB",
        format: "wav",
        durationMs: 20_000,
      });

      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transcript: graded.transcript,
            scores: graded.scores,
            marks: expect.anything(),
            band: 6,
          }),
        }),
      );
      const updateData = prisma.speakingAttempt.update.mock.calls[0]![0].data as {
        marks: unknown;
      };
      // Prisma.DbNull serializes JSON null in the DB
      expect(updateData.marks).toBeTruthy();
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("hai lần submit đồng thời chỉ gọi AI một lần", async () => {
      const { service, complete } = serviceWith({
        attempt: draft,
        claimCounts: [1, 0],
      });
      complete.mockResolvedValue(graded);

      const results = await Promise.allSettled([
        service.submit("user-1", "s1", {
          audioBase64: "QUFB",
          format: "wav",
          durationMs: 20_000,
        }),
        service.submit("user-1", "s1", {
          audioBase64: "QUFB",
          format: "wav",
          durationMs: 20_000,
        }),
      ]);

      expect(complete).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictException);
    });

    it("clears gradingStartedAt when AI fails", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete.mockRejectedValueOnce(new Error("AI down"));

      await expect(
        service.submit("user-1", "s1", {
          audioBase64: "QUFB",
          format: "wav",
          durationMs: 20_000,
        }),
      ).rejects.toThrow("AI down");

      expect(prisma.speakingAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "s1", userId: "user-1", submittedAt: null }),
          data: { gradingStartedAt: null },
        }),
      );
    });
  });

  describe("revise", () => {
    it("copies cueCard and prep notes without calling AI", async () => {
      const parent = {
        id: "s1",
        userId: "user-1",
        level: "B1",
        cueCard: generatedCue,
        structure: generatedStructure,
        vocabulary: generatedVocabulary,
        hintsOpened: true,
        submittedAt: new Date(),
        band: 6,
        revisionRound: 0,
        scale: "toeic",
        taskType: "express-opinion",
      };
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [parent, null],
        created: { id: "rev-1", parentAttemptId: "s1", revisionRound: 1 },
      });

      await service.revise("user-1", "s1");

      expect(complete).not.toHaveBeenCalled();
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scale: "toeic",
            taskType: "express-opinion",
            cueCard: generatedCue,
            structure: generatedStructure,
            vocabulary: generatedVocabulary,
            hintsOpened: true,
            parentAttemptId: "s1",
            revisionRound: 1,
          }),
        }),
      );
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            sampleTalks: expect.anything(),
          }),
        }),
      );
    });

    it("404 when parent missing", async () => {
      const { service } = serviceWith({ findFirstResults: [null] });
      await expect(service.revise("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("409 when not graded yet", async () => {
      const { service } = serviceWith({
        findFirstResults: [
          {
            id: "s1",
            userId: "user-1",
            submittedAt: null,
            band: null,
            revisionRound: 0,
            cueCard: generatedCue,
          },
        ],
      });
      await expect(service.revise("user-1", "s1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("409 when a revision already exists", async () => {
      const { service } = serviceWith({
        findFirstResults: [
          {
            id: "s1",
            userId: "user-1",
            submittedAt: new Date(),
            band: 6,
            revisionRound: 0,
            cueCard: generatedCue,
          },
          { id: "rev-1" },
        ],
      });
      await expect(service.revise("user-1", "s1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("409 when revisionRound >= 2", async () => {
      const { service } = serviceWith({
        findFirstResults: [
          {
            id: "s1",
            userId: "user-1",
            submittedAt: new Date(),
            band: 6,
            revisionRound: 2,
            cueCard: generatedCue,
          },
        ],
      });
      await expect(service.revise("user-1", "s1")).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("update", () => {
    const open = {
      id: "s1",
      userId: "user-1",
      submittedAt: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("sets hintsOpened to true", async () => {
      const { service, prisma } = serviceWith({
        attempt: open,
        updated: { id: "s1", hintsOpened: true },
      });

      await service.update("user-1", "s1", { hintsOpened: true });

      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { hintsOpened: true },
      });
    });

    it("409 when already submitted", async () => {
      const { service, prisma } = serviceWith({
        attempt: { ...open, submittedAt: new Date() },
      });
      await expect(
        service.update("user-1", "s1", { hintsOpened: true }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.speakingAttempt.update).not.toHaveBeenCalled();
    });
  });

  describe("generateSamples", () => {
    const gradedAttempt = {
      id: "s1",
      userId: "user-1",
      level: "B1",
      cueCard: generatedCue,
      submittedAt: new Date("2026-08-28T10:05:00Z"),
      band: 6,
      sampleTalks: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("returns 409 when the attempt has not been graded", async () => {
      const { service, complete } = serviceWith({
        attempt: { ...gradedAttempt, submittedAt: null, band: null },
      });

      await expect(service.generateSamples("user-1", "s1")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(complete).not.toHaveBeenCalled();
    });

    it("returns 404 when the attempt is missing or belongs to someone else", async () => {
      const { service } = serviceWith({ attempt: null });

      await expect(service.generateSamples("user-1", "missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the existing samples without calling AI when already generated", async () => {
      const existing = ["Talk one text.", "Talk two text."];
      const { service, complete } = serviceWith({
        attempt: { ...gradedAttempt, sampleTalks: existing },
      });

      const result = await service.generateSamples("user-1", "s1");

      expect(result.sampleTalks).toEqual(existing);
      expect(complete).not.toHaveBeenCalled();
    });

    it("generates and saves two talks when none exist yet", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: gradedAttempt,
        updated: { id: "s1", sampleTalks: ["Talk one.", "Talk two."] },
      });
      complete.mockResolvedValueOnce({
        talks: [{ text: "Talk one." }, { text: "Talk two." }],
      });

      const result = await service.generateSamples("user-1", "s1");

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining(generatedCue.topic),
          schema: SPEAKING_SAMPLE_SCHEMA,
          usage: { userId: "user-1", endpoint: "speaking.samples" },
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).toContain("B1");
      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { sampleTalks: ["Talk one.", "Talk two."] },
      });
      expect(result.sampleTalks).toEqual(["Talk one.", "Talk two."]);
    });
  });

  describe("list", () => {
    it("returns only roots with revisionCount and latestBand", async () => {
      const { service, prisma } = serviceWith({
        listRows: [
          {
            id: "root-1",
            level: "B1",
            band: 5.5,
            durationMs: 90_000,
            startedAt: new Date(),
            submittedAt: new Date(),
            revisions: [
              {
                band: 6,
                revisionRound: 1,
                revisions: [{ band: null, revisionRound: 2 }],
              },
            ],
          },
        ],
      });

      const page = await service.list("user-1");

      expect(prisma.speakingAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", parentAttemptId: null },
        }),
      );
      expect(page.items[0]).toMatchObject({
        id: "root-1",
        revisionCount: 2,
        latestBand: 6,
      });
      expect(page.items[0]).not.toHaveProperty("revisions");
    });
  });
});
