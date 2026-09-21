import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TOEIC_SCENES } from "@writing-helper/practice";
import type { AiService } from "../ai/ai.service";
import type { PrismaService } from "../prisma/prisma.service";
import { SPEAKING_GRADE_SCHEMA } from "./speaking-grade-prompt";
import { SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";
import { SPEAKING_SAMPLE_SCHEMA } from "./speaking-sample-prompt";
import { SpeakingService } from "./speaking.service";

const generatedStructure = [
  "State your view in one breath",
  "Give a workplace reason",
  "Give a daily-life reason",
  "Answer a likely objection",
  "Close with a clear recommendation",
];

const generatedVocabulary = [
  { word: "packed", meaning: "very crowded", example: "The square was packed." },
];

const generatedQuestion =
  "Do you think companies should allow employees to work from home two days a week?";

const generatedFull = {
  passage: "",
  question: generatedQuestion,
  info: "",
  structure: generatedStructure,
  vocabulary: generatedVocabulary,
};

const opinionCue = {
  type: "express-opinion",
  key: "wfh-two-days",
  prepSeconds: 45,
  speakSeconds: 60,
  maxRaw: 5,
  question: generatedQuestion,
};

const graded = {
  rawRating: 5,
  transcript: "Um, I went to a festival last year with my friends.",
  marks: [
    { quote: "Um,", kind: "filler" as const, note: "Filler at the start." },
    { quote: "missing quote", kind: "grammar" as const, note: "Will be dropped." },
  ],
  feedback: {
    pronunciation: "",
    intonationStress: "",
    taskAppropriateness: "You answered the question.",
    delivery: "Mostly steady.",
    languageUse: "Adequate words.",
    overview: "A fair opinion talk.",
    nextFocus: "Cut fillers at the start.",
  },
};

function serviceWith(
  overrides: {
    recentKeys?: string[];
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
        return (overrides.recentKeys ?? []).map((key) => ({
          cueCard: { key, type: "express-opinion", speakSeconds: 60 },
        }));
      }
      return [];
    }),
    findFirst: findFirstResults
      ? jest.fn().mockImplementation(async () =>
          findFirstResults.length > 0 ? findFirstResults.shift()! : null,
        )
      : jest.fn().mockResolvedValue(overrides.attempt ?? null),
    create: jest.fn().mockResolvedValue(overrides.created ?? { id: "s1", ...opinionCue }),
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
    it("picks a seed, calls speaking.generate, and stores a TOEIC cue card plus prep notes", async () => {
      const { service, prisma, complete, vocab } = serviceWith({
        created: { id: "s1", level: "TOEIC", cueCard: opinionCue },
      });

      await service.create("user-1", { taskType: "express-opinion" });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: SPEAKING_GENERATE_SCHEMA,
          maxTokens: 1500,
          usage: { userId: "user-1", endpoint: "speaking.generate" },
          prompt: expect.stringContaining("express-opinion"),
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).not.toMatch(/IELTS/i);
      expect(vocab.reviewCandidates).toHaveBeenCalledWith("user-1");
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            level: "TOEIC",
            scale: "toeic",
            taskType: "express-opinion",
            cueCard: opinionCue,
            structure: generatedStructure,
            vocabulary: generatedVocabulary,
          }),
        }),
      );
      expect(vocab.recordSuggested).toHaveBeenCalledWith(
        "user-1",
        "TOEIC",
        generatedVocabulary,
      );
    });

    it("overrides speakSeconds only for respond-question", async () => {
      const { service, prisma, complete } = serviceWith();
      complete.mockResolvedValueOnce({
        ...generatedFull,
        question: "What time do you usually start work?",
      });

      await service.create("user-1", { taskType: "respond-question", speakSeconds: 30 });

      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskType: "respond-question",
            cueCard: expect.objectContaining({
              type: "respond-question",
              speakSeconds: 30,
              maxRaw: 3,
              question: "What time do you usually start work?",
            }),
          }),
        }),
      );
    });

    it("defaults respond-with-info to 30s speak and stores infoSeconds 45", async () => {
      const { service, prisma, complete } = serviceWith();
      complete.mockResolvedValueOnce({
        ...generatedFull,
        info: "Lunch 11:30–14:00. Today's special: grilled fish.",
        question: "Until what time is lunch served?",
      });

      await service.create("user-1", { taskType: "respond-with-info" });

      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cueCard: expect.objectContaining({
              type: "respond-with-info",
              speakSeconds: 30,
              infoSeconds: 45,
              info: "Lunch 11:30–14:00. Today's special: grilled fish.",
              question: "Until what time is lunch served?",
            }),
          }),
        }),
      );
    });

    it("stores a catalog imageUrl for describe-picture and does not invent an image", async () => {
      const { service, prisma, complete } = serviceWith();

      await service.create("user-1", { taskType: "describe-picture" });

      expect(complete.mock.calls[0]![0].prompt).toMatch(/do not invent/i);
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskType: "describe-picture",
            cueCard: expect.objectContaining({
              type: "describe-picture",
              speakSeconds: 30,
              maxRaw: 3,
              imageUrl: TOEIC_SCENES[0]!.imageUrl,
            }),
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

      await service.create("user-1", { taskType: "express-opinion" });

      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vocabulary: [{ ...generatedVocabulary[0], review: true }],
          }),
        }),
      );
      expect(vocab.recordSuggested).toHaveBeenCalledWith(
        "user-1",
        "TOEIC",
        generatedVocabulary,
      );
    });

    it("still creates the attempt when recordSuggested throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma } = serviceWith({
        recordSuggestedError: new Error("upsert failed"),
      });

      await expect(
        service.create("user-1", { taskType: "express-opinion" }),
      ).resolves.toEqual(expect.objectContaining({ id: "s1" }));
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
          cueCard: opinionCue,
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
      level: "TOEIC",
      scale: "toeic",
      taskType: "express-opinion",
      cueCard: opinionCue,
      startedAt: new Date("2026-08-28T10:00:00Z"),
      submittedAt: null,
      gradingStartedAt: null,
      parentAttemptId: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("rejects audio under 3 seconds before calling AI", async () => {
      const { service, complete } = serviceWith({ attempt: draft });

      await expect(
        service.submit("user-1", "s1", {
          audioBase64: "AAAA",
          format: "wav",
          durationMs: 2_999,
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

    it("stores TOEIC rawRating and practice scaled score, not an IELTS band", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: draft,
        updated: { id: "s1", rawRating: 5, estimatedScaled: 200, band: null },
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
      expect(complete.mock.calls[0]![0].prompt).not.toMatch(/IELTS/i);
      expect(complete.mock.calls[0]![0].prompt).not.toMatch(/Part 2/i);
      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: null,
            rawRating: 5,
            estimatedScaled: 200,
            cefrEstimate: "C1",
            scale: "toeic",
            scores: Prisma.DbNull,
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
    });

    it("saves transcript with marks null when locateMarks throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma, complete } = serviceWith({
        attempt: draft,
        updated: { id: "s1", rawRating: 5, estimatedScaled: 200, band: null },
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
            rawRating: 5,
            estimatedScaled: 200,
            band: null,
            marks: expect.anything(),
          }),
        }),
      );
      const updateData = prisma.speakingAttempt.update.mock.calls[0]![0].data as {
        marks: unknown;
      };
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
        level: "TOEIC",
        cueCard: opinionCue,
        structure: generatedStructure,
        vocabulary: generatedVocabulary,
        hintsOpened: true,
        submittedAt: new Date(),
        band: null,
        rawRating: 5,
        scale: "toeic",
        taskType: "express-opinion",
        revisionRound: 0,
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
            cueCard: opinionCue,
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
            submittedAt: new Date(),
            band: null,
            rawRating: null,
            scale: "toeic",
            revisionRound: 0,
            cueCard: opinionCue,
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
            band: null,
            rawRating: 5,
            scale: "toeic",
            revisionRound: 0,
            cueCard: opinionCue,
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
            band: null,
            rawRating: 5,
            scale: "toeic",
            revisionRound: 2,
            cueCard: opinionCue,
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
      level: "TOEIC",
      scale: "toeic",
      taskType: "express-opinion",
      cueCard: opinionCue,
      submittedAt: new Date("2026-08-28T10:05:00Z"),
      band: null,
      rawRating: 5,
      sampleTalks: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("returns 409 when the attempt has not been graded", async () => {
      const { service, complete } = serviceWith({
        attempt: { ...gradedAttempt, submittedAt: new Date(), band: null, rawRating: null },
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
          prompt: expect.stringContaining(generatedQuestion),
          schema: SPEAKING_SAMPLE_SCHEMA,
          usage: { userId: "user-1", endpoint: "speaking.samples" },
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).not.toMatch(/IELTS/i);
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
            level: "TOEIC",
            band: null,
            durationMs: 60_000,
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
