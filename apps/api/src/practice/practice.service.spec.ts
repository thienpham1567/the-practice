import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { overallBand } from "@writing-helper/practice";
import type { AiService } from "../ai/ai.service";
import type { PrismaService } from "../prisma/prisma.service";
import { GRADE_TASK_SCHEMA } from "./grade-prompt";
import { PracticeService } from "./practice.service";
import { REVISION_GRADE_SCHEMA } from "./revision-grade-prompt";

const generated = {
  prompt: "You are writing to a friend about a concert you went to last weekend.",
  ideas: ["who you went with", "the music", "the crowd", "how you felt"],
  vocabulary: [
    { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
  ],
};

const graded = {
  scores: {
    taskResponse: 6,
    coherenceCohesion: 6,
    lexicalResource: 6,
    grammaticalRange: 5,
  },
  feedback: {
    taskResponse: "You answered the task.",
    coherenceCohesion: "Ideas are ordered clearly.",
    lexicalResource: "Vocabulary is adequate.",
    grammaticalRange: "Mostly simple sentences.",
    overview: "A fair B1 letter.",
    nextFocus: "Use one complex sentence next time.",
  },
};

function serviceWith(overrides: {
  recentTypes?: string[];
  attempt?: Record<string, unknown> | null;
  /** Sequential findFirst results (e.g. parent then existing-revision check). */
  findFirstResults?: Array<Record<string, unknown> | null>;
  created?: Record<string, unknown>;
  updated?: Record<string, unknown>;
  claimCounts?: number[];
}) {
  const claimCounts = [...(overrides.claimCounts ?? [1])];
  const findFirstResults = overrides.findFirstResults
    ? [...overrides.findFirstResults]
    : undefined;
  const practiceAttempt = {
    findMany: jest.fn().mockResolvedValue(
      (overrides.recentTypes ?? []).map((taskType) => ({ taskType })),
    ),
    findFirst: findFirstResults
      ? jest.fn().mockImplementation(async () =>
          findFirstResults.length > 0 ? findFirstResults.shift()! : null,
        )
      : jest.fn().mockResolvedValue(overrides.attempt ?? null),
    create: jest.fn().mockResolvedValue(overrides.created ?? { id: "a1", ...generated }),
    update: jest.fn().mockResolvedValue(overrides.updated ?? { id: "a1" }),
    updateMany: jest.fn().mockImplementation(async () => {
      const count = claimCounts.length > 0 ? claimCounts.shift()! : 0;
      return { count };
    }),
  };
  const prisma = {
    practiceAttempt,
    $transaction: jest.fn(async (fn: (tx: { practiceAttempt: typeof practiceAttempt }) => unknown) =>
      fn({ practiceAttempt }),
    ),
  };

  const complete = jest.fn().mockResolvedValue(generated);
  const ai = { complete } as unknown as AiService;
  const service = new PracticeService(prisma as unknown as PrismaService, ai);

  return { service, prisma, complete };
}

describe("PracticeService", () => {
  describe("create", () => {
    it("skips a recently used task type and stores ideas plus vocabulary", async () => {
      const { service, prisma, complete } = serviceWith({
        recentTypes: ["email"],
        created: { id: "a1", taskType: "describe-experience" },
      });

      await service.create("user-1", { level: "A2" });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Recount an experience"),
        }),
      );
      expect(prisma.practiceAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            level: "A2",
            taskType: "describe-experience",
            ideas: generated.ideas,
            vocabulary: generated.vocabulary,
            prompt: expect.stringContaining(generated.prompt),
          }),
        }),
      );
    });

    it("appends the catalog instruction to the stored prompt", async () => {
      const { service, prisma } = serviceWith({ recentTypes: [] });

      await service.create("user-1", { level: "A2", taskType: "email" });

      const data = prisma.practiceAttempt.create.mock.calls[0]![0].data as {
        prompt: string;
      };
      expect(data.prompt).toContain(generated.prompt);
      expect(data.prompt).toContain("Write an email to a specific person");
    });
  });

  describe("findOne", () => {
    it("returns 404 when the attempt is missing or belongs to someone else", async () => {
      const { service } = serviceWith({ attempt: null });

      await expect(service.findOne("user-1", "missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns parentBand from the parent include for a revision", async () => {
      const { service, prisma } = serviceWith({
        attempt: {
          id: "rev-1",
          userId: "user-1",
          parentAttemptId: "a1",
          revisionRound: 1,
          feedbackAudit: [{ point: "Use complex sentences", status: "resolved" }],
          band: 6.5,
          parent: { band: 5.5 },
          revisions: [],
        },
      });

      const result = await service.findOne("user-1", "rev-1");

      expect(prisma.practiceAttempt.findFirst).toHaveBeenCalledWith({
        where: { id: "rev-1", userId: "user-1" },
        include: {
          parent: { select: { band: true } },
          revisions: { select: { id: true }, take: 1 },
        },
      });
      expect(result).toMatchObject({
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        feedbackAudit: [{ point: "Use complex sentences", status: "resolved" }],
        parentBand: 5.5,
        hasRevision: false,
      });
      expect(result).not.toHaveProperty("parent");
      expect(result).not.toHaveProperty("revisions");
    });

    it("returns parentBand null for a root attempt", async () => {
      const { service } = serviceWith({
        attempt: {
          id: "a1",
          userId: "user-1",
          parentAttemptId: null,
          revisionRound: 0,
          feedbackAudit: null,
          band: 5.5,
          parent: null,
          revisions: [],
        },
      });

      const result = await service.findOne("user-1", "a1");

      expect(result).toMatchObject({
        id: "a1",
        parentAttemptId: null,
        revisionRound: 0,
        parentBand: null,
        hasRevision: false,
      });
      expect(result).not.toHaveProperty("parent");
      expect(result).not.toHaveProperty("revisions");
    });

    it("returns hasRevision true when a child revision exists", async () => {
      const { service } = serviceWith({
        attempt: {
          id: "a1",
          userId: "user-1",
          parentAttemptId: null,
          revisionRound: 0,
          band: 5.5,
          parent: null,
          revisions: [{ id: "rev-1" }],
        },
      });

      const result = await service.findOne("user-1", "a1");

      expect(result).toMatchObject({ id: "a1", hasRevision: true });
      expect(result).not.toHaveProperty("revisions");
    });
  });

  describe("submit", () => {
    const draft = {
      id: "a1",
      userId: "user-1",
      level: "A2",
      taskType: "email",
      prompt: "Write to your teacher.",
      plainText: "Dear teacher, ...",
      wordCount: 95,
      startedAt: new Date("2026-08-25T10:00:00Z"),
      submittedAt: null,
      gradingStartedAt: null,
      revisions: [] as { id: string }[],
    };

    it("computes overall band on the server from the four criteria", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: { ...draft, parentAttemptId: null, parent: null },
        updated: { id: "a1", band: 6 },
      });
      complete.mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: { counts: { passives: 1 } },
      });

      expect(prisma.practiceAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gradingStartedAt: expect.any(Date) }),
        }),
      );
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Write to your teacher."),
          schema: GRADE_TASK_SCHEMA,
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).not.toContain("Previous feedback points to audit");
      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(graded.scores),
            scores: graded.scores,
            feedback: graded.feedback,
            styleSnapshot: { counts: { passives: 1 } },
            gradingStartedAt: null,
          }),
        }),
      );
      expect(prisma.practiceAttempt.update.mock.calls[0]![0].data).not.toHaveProperty(
        "feedbackAudit",
      );
      expect(overallBand(graded.scores)).toBe(6);
    });

    it("grades a revision with comparative prompt and saves feedbackAudit", async () => {
      const revisionDraft = {
        ...draft,
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        plainText: "Dear teacher, thank you for your help with complex sentences.",
        wordCount: 110,
        parent: { band: 5.5 },
      };
      const parentGraded = {
        feedback: graded.feedback,
        band: 5.5,
      };
      const revisionGraded = {
        ...graded,
        scores: {
          taskResponse: 6.5,
          coherenceCohesion: 6.5,
          lexicalResource: 6,
          grammaticalRange: 6.5,
        },
        feedbackAudit: [
          { point: "Mostly simple sentences.", status: "resolved" },
          { point: "Use one complex sentence next time.", status: "partial" },
        ],
      };
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [revisionDraft, parentGraded],
        updated: { id: "rev-1", band: 6.5 },
      });
      complete.mockResolvedValueOnce(revisionGraded);

      await service.submit("user-1", "rev-1", {
        styleSnapshot: { counts: { passives: 0 } },
      });

      expect(prisma.practiceAttempt.findFirst).toHaveBeenCalledWith({
        where: { id: "a1" },
        select: { feedback: true, band: true },
      });
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Previous feedback points to audit"),
          schema: REVISION_GRADE_SCHEMA,
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).toContain("band 5.5");
      expect(complete.mock.calls[0]![0].prompt).toContain(graded.feedback.nextFocus);
      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(revisionGraded.scores),
            scores: revisionGraded.scores,
            feedback: revisionGraded.feedback,
            feedbackAudit: revisionGraded.feedbackAudit,
            gradingStartedAt: null,
          }),
        }),
      );
    });

    it("saves band and null feedbackAudit when audit array is missing", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const revisionDraft = {
        ...draft,
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        parent: { band: 5.5 },
      };
      const scores = {
        taskResponse: 6.5,
        coherenceCohesion: 6.5,
        lexicalResource: 6,
        grammaticalRange: 6.5,
      };
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [revisionDraft, { feedback: graded.feedback, band: 5.5 }],
        updated: { id: "rev-1", band: 6.5 },
      });
      complete.mockResolvedValueOnce({ scores, feedback: graded.feedback });

      await service.submit("user-1", "rev-1", { styleSnapshot: {} });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(scores),
            scores,
            feedback: graded.feedback,
            feedbackAudit: null,
          }),
        }),
      );
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("saves band and null feedbackAudit when audit is wrong-typed", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const revisionDraft = {
        ...draft,
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        parent: { band: 5.5 },
      };
      const revisionGraded = {
        ...graded,
        scores: {
          taskResponse: 6.5,
          coherenceCohesion: 6.5,
          lexicalResource: 6,
          grammaticalRange: 6.5,
        },
        feedbackAudit: "not-an-array",
      };
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [revisionDraft, { feedback: graded.feedback, band: 5.5 }],
        updated: { id: "rev-1", band: 6.5 },
      });
      complete.mockResolvedValueOnce(revisionGraded);

      await service.submit("user-1", "rev-1", { styleSnapshot: {} });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(revisionGraded.scores),
            scores: revisionGraded.scores,
            feedback: revisionGraded.feedback,
            feedbackAudit: null,
          }),
        }),
      );
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("rejects a second submit with 409", async () => {
      const { service, complete } = serviceWith({
        attempt: { ...draft, submittedAt: new Date() },
      });

      await expect(
        service.submit("user-1", "a1", { styleSnapshot: {} }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(complete).not.toHaveBeenCalled();
    });

    it("hai lần submit đồng thời chỉ gọi AI một lần", async () => {
      const { service, complete } = serviceWith({
        attempt: draft,
        claimCounts: [1, 0],
      });
      complete.mockResolvedValue(graded);

      const results = await Promise.allSettled([
        service.submit("user-1", "a1", { styleSnapshot: {} }),
        service.submit("user-1", "a1", { styleSnapshot: {} }),
      ]);

      expect(complete).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictException);
    });

    it("hai lần submit đồng thời trên bản sửa chỉ gọi AI một lần", async () => {
      const revisionDraft = {
        ...draft,
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
      };
      const parentGraded = {
        feedback: graded.feedback,
        band: 5.5,
      };
      const revisionGraded = {
        ...graded,
        feedbackAudit: [
          { point: "Mostly simple sentences.", status: "resolved" as const },
        ],
      };
      // Both concurrent submits look up the draft first; only the winner loads parent.
      const { service, complete } = serviceWith({
        findFirstResults: [revisionDraft, revisionDraft, parentGraded],
        claimCounts: [1, 0],
      });
      complete.mockResolvedValue(revisionGraded);

      const results = await Promise.allSettled([
        service.submit("user-1", "rev-1", { styleSnapshot: {} }),
        service.submit("user-1", "rev-1", { styleSnapshot: {} }),
      ]);

      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: REVISION_GRADE_SCHEMA,
          usage: { userId: "user-1", endpoint: "practice.grade" },
        }),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictException);
    });

    it("xoá gradingStartedAt khi chấm AI thất bại", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete.mockRejectedValueOnce(new Error("AI down"));

      await expect(
        service.submit("user-1", "a1", { styleSnapshot: {} }),
      ).rejects.toThrow("AI down");

      expect(prisma.practiceAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "a1", userId: "user-1", submittedAt: null }),
          data: { gradingStartedAt: null },
        }),
      );
    });

    it("cho chiếm lại khoá grading cũ hơn 2 phút", async () => {
      const stale = new Date(Date.now() - 3 * 60 * 1000);
      const { service, prisma, complete } = serviceWith({
        attempt: { ...draft, gradingStartedAt: stale },
      });
      complete.mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", { styleSnapshot: {} });

      const claimWhere = prisma.practiceAttempt.updateMany.mock.calls[0]![0].where as {
        OR: unknown[];
      };
      expect(claimWhere.OR).toEqual(
        expect.arrayContaining([
          { gradingStartedAt: null },
          { gradingStartedAt: { lte: expect.any(Date) } },
        ]),
      );
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe("revise", () => {
    const gradedParent = {
      id: "a1",
      userId: "user-1",
      level: "A2",
      taskType: "email",
      prompt: "Write to your teacher.",
      ideas: ["who to thank", "what happened"],
      vocabulary: [{ word: "grateful", meaning: "thankful", example: "I am grateful." }],
      hintsOpened: true,
      content: { type: "doc", content: [{ type: "paragraph" }] },
      plainText: "Dear teacher, thank you.",
      wordCount: 95,
      submittedAt: new Date("2026-08-25T10:05:00Z"),
      band: 6,
      revisionRound: 0,
      parentAttemptId: null,
    };

    it("returns 404 when the attempt is missing or belongs to someone else", async () => {
      const { service } = serviceWith({ findFirstResults: [null] });

      await expect(service.revise("user-1", "missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns 409 when the attempt is not yet graded (submittedAt null)", async () => {
      const { service } = serviceWith({
        findFirstResults: [{ ...gradedParent, submittedAt: null }],
      });

      await expect(service.revise("user-1", "a1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("returns 409 when the attempt has no band", async () => {
      const { service } = serviceWith({
        findFirstResults: [{ ...gradedParent, band: null }],
      });

      await expect(service.revise("user-1", "a1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("returns 409 when a revision already exists", async () => {
      const { service } = serviceWith({
        findFirstResults: [gradedParent, { id: "rev-1", parentAttemptId: "a1" }],
      });

      await expect(service.revise("user-1", "a1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("returns 409 when revisionRound is already 2", async () => {
      const { service } = serviceWith({
        findFirstResults: [{ ...gradedParent, revisionRound: 2 }],
      });

      await expect(service.revise("user-1", "a1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("creates a revision attempt copying parent fields without calling AI", async () => {
      const created = {
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
      };
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [gradedParent, null],
        created,
      });

      const result = await service.revise("user-1", "a1");

      expect(result).toEqual(created);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.practiceAttempt.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          level: "A2",
          taskType: "email",
          prompt: "Write to your teacher.",
          ideas: gradedParent.ideas,
          vocabulary: gradedParent.vocabulary,
          hintsOpened: true,
          content: gradedParent.content,
          plainText: "Dear teacher, thank you.",
          wordCount: 95,
          parentAttemptId: "a1",
          revisionRound: 1,
        },
      });
      expect(complete).not.toHaveBeenCalled();
    });
  });
});
