import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { overallBand } from "@writing-helper/practice";
import type { AiService } from "../ai/ai.service";
import type { PrismaService } from "../prisma/prisma.service";
import { GRADE_TASK_SCHEMA } from "./grade-prompt";
import { PracticeService } from "./practice.service";
import { REVISION_GRADE_SCHEMA } from "./revision-grade-prompt";
import { SAMPLE_ESSAY_SCHEMA } from "./sample-essay-prompt";

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
  reviewCandidates?: Array<{ word: string; meaning: string; example: string }>;
  reviewCandidatesError?: Error;
  recordSuggestedError?: Error;
  markUsedError?: Error;
} = {}) {
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
    delete: jest.fn().mockResolvedValue({ id: "a1" }),
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

  const reviewCandidates = jest.fn().mockImplementation(async () => {
    if (overrides.reviewCandidatesError) throw overrides.reviewCandidatesError;
    return overrides.reviewCandidates ?? [];
  });
  const recordSuggested = jest.fn().mockImplementation(async () => {
    if (overrides.recordSuggestedError) throw overrides.recordSuggestedError;
  });
  const markUsed = jest.fn().mockImplementation(async () => {
    if (overrides.markUsedError) throw overrides.markUsedError;
  });
  const vocab = { reviewCandidates, recordSuggested, markUsed };

  const service = new PracticeService(
    prisma as unknown as PrismaService,
    ai,
    vocab as never,
  );

  return { service, prisma, complete, vocab };
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
            scale: "toeic",
            taskType: "describe-experience",
            ideas: generated.ideas,
            vocabulary: generated.vocabulary,
            prompt: expect.stringContaining(generated.prompt),
          }),
        }),
      );
    });

    /**
     * The catalog instruction used to be concatenated onto the stored prompt.
     * It reads as a redundant trailing sentence after a generated situation
     * that already says the same thing, and both grading prompts and the UI
     * take it from the TaskSpec anyway — so the stored prompt is the situation
     * alone.
     */
    it("stores the situation alone, without the catalog instruction", async () => {
      const { service, prisma } = serviceWith({ recentTypes: [] });

      await service.create("user-1", { level: "A2", taskType: "email" });

      const data = prisma.practiceAttempt.create.mock.calls[0]![0].data as {
        prompt: string;
      };
      expect(data.prompt).toBe(generated.prompt);
      expect(data.prompt).not.toContain("Write an email to a specific person");
    });

    it("passes review candidates into the generate prompt", async () => {
      const candidates = [
        { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
      ];
      const { service, complete, vocab } = serviceWith({
        recentTypes: [],
        reviewCandidates: candidates,
      });

      await service.create("user-1", { level: "A2", taskType: "email" });

      expect(vocab.reviewCandidates).toHaveBeenCalledWith("user-1", "A2");
      expect(complete.mock.calls[0]![0].prompt).toContain("lively");
      expect(complete.mock.calls[0]![0].prompt).toContain("Decide the topic FIRST");
    });

    it("flags matching vocabulary items with review: true and records all suggested", async () => {
      const candidates = [
        { word: "Lively", meaning: "full of energy", example: "The crowd was lively." },
        { word: "commute", meaning: "travel to work", example: "I commute by bus." },
      ];
      const aiVocab = [
        { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
        { word: "memorable", meaning: "worth remembering", example: "A memorable day." },
      ];
      const { service, prisma, complete, vocab } = serviceWith({ recentTypes: [] });
      complete.mockResolvedValueOnce({ ...generated, vocabulary: aiVocab });
      vocab.reviewCandidates.mockResolvedValueOnce(candidates);

      await service.create("user-1", { level: "A2", taskType: "email" });

      expect(prisma.practiceAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vocabulary: [
              { ...aiVocab[0], review: true },
              aiVocab[1],
            ],
          }),
        }),
      );
      expect(vocab.recordSuggested).toHaveBeenCalledWith("user-1", "A2", aiVocab);
    });

    it("still creates the attempt when reviewCandidates throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma, complete, vocab } = serviceWith({
        recentTypes: [],
        reviewCandidatesError: new Error("db down"),
      });

      await expect(service.create("user-1", { level: "A2", taskType: "email" })).resolves.toEqual(
        expect.objectContaining({ id: "a1" }),
      );

      expect(complete.mock.calls[0]![0].prompt).not.toContain("Decide the topic FIRST");
      expect(prisma.practiceAttempt.create).toHaveBeenCalled();
      expect(vocab.recordSuggested).toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("still creates the attempt when recordSuggested throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma } = serviceWith({
        recentTypes: [],
        recordSuggestedError: new Error("upsert failed"),
      });

      await expect(service.create("user-1", { level: "A2", taskType: "email" })).resolves.toEqual(
        expect.objectContaining({ id: "a1" }),
      );

      expect(prisma.practiceAttempt.create).toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
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
          revisions: { select: { id: true, submittedAt: true }, take: 1 },
        },
      });
      expect(result).toMatchObject({
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        feedbackAudit: [{ point: "Use complex sentences", status: "resolved" }],
        parentBand: 5.5,
        hasRevision: false,
        pendingRevisionId: null,
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
        pendingRevisionId: null,
      });
      expect(result).not.toHaveProperty("parent");
      expect(result).not.toHaveProperty("revisions");
    });

    it("returns hasRevision true and pendingRevisionId when the child is unsubmitted", async () => {
      const { service } = serviceWith({
        attempt: {
          id: "a1",
          userId: "user-1",
          parentAttemptId: null,
          revisionRound: 0,
          band: 5.5,
          parent: null,
          revisions: [{ id: "rev-1", submittedAt: null }],
        },
      });

      const result = await service.findOne("user-1", "a1");

      expect(result).toMatchObject({
        id: "a1",
        hasRevision: true,
        pendingRevisionId: "rev-1",
      });
      expect(result).not.toHaveProperty("revisions");
    });

    it("returns hasRevision true and pendingRevisionId null when the child is submitted", async () => {
      const { service } = serviceWith({
        attempt: {
          id: "a1",
          userId: "user-1",
          parentAttemptId: null,
          revisionRound: 0,
          band: 5.5,
          parent: null,
          revisions: [{ id: "rev-1", submittedAt: new Date("2026-08-27T12:00:00Z") }],
        },
      });

      const result = await service.findOne("user-1", "a1");

      expect(result).toMatchObject({
        id: "a1",
        hasRevision: true,
        pendingRevisionId: null,
      });
      expect(result).not.toHaveProperty("revisions");
    });
  });

  describe("update", () => {
    /** findOne() destructures `revisions`, nên fixture phải có mảng đó. */
    const editable = {
      id: "a1",
      userId: "user-1",
      level: "A2",
      taskType: "email",
      prompt: "Write to your teacher.",
      plainText: "Dear teacher, ...",
      wordCount: 95,
      startedAt: new Date("2026-08-25T10:00:00Z"),
      submittedAt: null,
      revisions: [],
    };

    it("stores the handled-mark keys", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { handledMarks: ["2:11", "20:26"] });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ handledMarks: ["2:11", "20:26"] }),
        }),
      );
    });

    /** Bỏ đánh dấu cái cuối cùng gửi lên mảng rỗng — phải ghi, không phải bỏ qua. */
    it("stores an empty list when the last mark is unticked", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { handledMarks: [] });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.handledMarks).toEqual([]);
    });

    it("leaves handledMarks alone when the autosave does not mention it", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { plainText: "just the text" });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data).not.toHaveProperty("handledMarks");
    });

    it("refuses to touch a submitted paper", async () => {
      const { service } = serviceWith({ attempt: { ...editable, submittedAt: new Date() } });

      await expect(
        service.update("user-1", "a1", { handledMarks: ["2:11"] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("remove", () => {
    it("404 when the attempt is missing or belongs to someone else", async () => {
      const { service, prisma } = serviceWith({ attempt: null });

      await expect(service.remove("user-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.practiceAttempt.delete).not.toHaveBeenCalled();
    });

    it("deletes the attempt after confirming ownership", async () => {
      const { service, prisma } = serviceWith({ attempt: { id: "a1" } });

      await service.remove("user-1", "a1");

      expect(prisma.practiceAttempt.findFirst).toHaveBeenCalledWith({
        where: { id: "a1", userId: "user-1" },
        select: { id: true },
      });
      expect(prisma.practiceAttempt.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
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
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("computes overall band on the server from the four criteria", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: { ...draft, parentAttemptId: null, parent: null },
        updated: { id: "a1", band: 6 },
      });
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

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
      expect(complete.mock.calls[1]![0].prompt).not.toContain("Previous feedback points to audit");
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
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(revisionGraded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "rev-1", {
        styleSnapshot: { counts: { passives: 0 } },
      });

      expect(prisma.practiceAttempt.findFirst).toHaveBeenCalledWith({
        where: { id: "a1" },
        select: { feedback: true, band: true, marks: true, plainText: true },
      });
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Previous feedback points to audit"),
          schema: REVISION_GRADE_SCHEMA,
        }),
      );
      expect(complete.mock.calls[1]![0].prompt).toContain("band 5.5");
      expect(complete.mock.calls[1]![0].prompt).toContain(graded.feedback.nextFocus);
      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(revisionGraded.scores),
            scores: revisionGraded.scores,
            feedback: revisionGraded.feedback,
            feedbackAudit: { criteria: revisionGraded.feedbackAudit, marksResolution: [] },
            gradingStartedAt: null,
          }),
        }),
      );
    });

    it("saves empty audit criteria (but still computes marksResolution) when audit array is missing", async () => {
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
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce({ scores, feedback: graded.feedback })
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "rev-1", { styleSnapshot: {} });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(scores),
            scores,
            feedback: graded.feedback,
            // Criteria drop to [] on invalid AI output, but marksResolution is
            // computed from the parent's marks in code — never dropped wholesale.
            feedbackAudit: { criteria: [], marksResolution: [] },
          }),
        }),
      );
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("saves empty audit criteria when audit is wrong-typed", async () => {
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
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(revisionGraded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "rev-1", { styleSnapshot: {} });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(revisionGraded.scores),
            scores: revisionGraded.scores,
            feedback: revisionGraded.feedback,
            feedbackAudit: { criteria: [], marksResolution: [] },
          }),
        }),
      );
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("passes the parent's specific marks into both the extract and revision-grade prompts, and computes marksResolution deterministically", async () => {
      const revisionDraft = {
        ...draft,
        id: "rev-1",
        parentAttemptId: "a1",
        revisionRound: 1,
        // The register mark's quote ("Best,") is gone — replaced by the AI's own
        // suggested fix — while everything else about the parent essay is unchanged.
        plainText: "Dear teacher, ...\n\nBest regards,",
        parent: { band: 5.5 },
      };
      const parentMarks = [
        { start: 19, end: 24, category: "register", severity: "refinement", correction: "Best regards,", note: "More formal." },
      ];
      const { service, prisma, complete } = serviceWith({
        findFirstResults: [
          revisionDraft,
          { feedback: graded.feedback, band: 5.5, marks: parentMarks, plainText: "Dear teacher, ...\n\nBest," },
        ],
        updated: { id: "rev-1", band: 6.5 },
      });
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "rev-1", { styleSnapshot: {} });

      const extractPrompt = complete.mock.calls[0]![0].prompt as string;
      expect(extractPrompt).toContain("Best,");
      expect(extractPrompt).toContain("Best regards,");

      const gradePrompt = complete.mock.calls[1]![0].prompt as string;
      expect(gradePrompt).toContain("Best,");
      expect(gradePrompt).toContain("Best regards,");
      expect(gradePrompt).toMatch(/reverse a recommendation/i);

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            feedbackAudit: expect.objectContaining({
              marksResolution: [
                { quote: "Best,", category: "register", resolved: true },
              ],
            }),
          }),
        }),
      );
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

      // One winning submit now makes three AI calls (extract + verify + grade),
      // but the loser is still shut out entirely — that's what this test guards.
      expect(complete).toHaveBeenCalledTimes(3);
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

      // One winning submit now makes three AI calls (extract + verify + grade),
      // but the loser is still shut out entirely — that's what this test guards.
      expect(complete).toHaveBeenCalledTimes(3);
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
      // Registration order is extract, then grade, then verify — the grade
      // call is the one that fails here.
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockRejectedValueOnce(new Error("AI down"))
        .mockResolvedValueOnce({ marks: [] });

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
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

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
      expect(complete).toHaveBeenCalledTimes(3);
    });

    it("calls markUsed with the submitted plainText after a successful grade", async () => {
      const { service, vocab, complete } = serviceWith({
        attempt: { ...draft, parentAttemptId: null, parent: null },
        updated: { id: "a1", band: 6 },
      });
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "The crowd was lively and memorable.",
      });

      expect(vocab.markUsed).toHaveBeenCalledWith(
        "user-1",
        "The crowd was lively and memorable.",
      );
    });

    it("still returns the graded attempt when markUsed throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const gradedRow = { id: "a1", band: 6 };
      const { service, complete } = serviceWith({
        attempt: { ...draft, parentAttemptId: null, parent: null },
        updated: gradedRow,
        markUsedError: new Error("scan failed"),
      });
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await expect(
        service.submit("user-1", "a1", {
          styleSnapshot: {},
          plainText: "Dear teacher, the trip was memorable.",
        }),
      ).resolves.toEqual(gradedRow);

      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("stores mistakes resolved from the model's quotes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({
          marks: [
            {
              quote: "very like",
              occurrence: 1,
              category: "word-order",
              correction: "like it very much",
              note: "Word order.",
            },
          ],
        })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            marks: [
              {
                start: 2,
                end: 11,
                category: "word-order",
                severity: "error",
                correction: "like it very much",
                note: "Word order.",
              },
            ],
          }),
        }),
      );
    });

    it("still saves the band when mistake extraction fails", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete
        .mockRejectedValueOnce(new Error("model returned junk"))
        .mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.band).toBe(overallBand(graded.scores));
      expect(data.marks).toBeUndefined();
    });

    it("stores an empty list when the paper has no mistakes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      // Registration order is extract, then grade (both fire synchronously
      // before either resolves), then verify (fires once extract resolves).
      complete
        .mockResolvedValueOnce({ marks: [] })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "Flawless.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.marks).toEqual([]);
    });

    it("treats a total locate failure as extraction failed, not a clean paper", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      // Paraphrased quotes: nothing in the list can be located in the paper.
      complete
        .mockResolvedValueOnce({
          marks: [
            {
              quote: "I like it very",
              occurrence: 1,
              category: "word-order",
              correction: "I like it very much",
              note: "Word order.",
            },
            {
              quote: "a apple",
              occurrence: 1,
              category: "article",
              correction: "an apple",
              note: "Article.",
            },
          ],
        })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.band).toBe(overallBand(graded.scores));
      expect(data.marks).toBeUndefined();
    });

    it("keeps the marks that did locate when only some quotes fail", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete
        .mockResolvedValueOnce({
          marks: [
            {
              quote: "nowhere in the paper",
              occurrence: 1,
              category: "article",
              correction: "n/a",
              note: "Article.",
            },
            {
              quote: "very like",
              occurrence: 1,
              category: "word-order",
              correction: "like it very much",
              note: "Word order.",
            },
          ],
        })
        .mockResolvedValueOnce(graded)
        .mockResolvedValueOnce({ marks: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.marks).toEqual([
        {
          start: 2,
          end: 11,
          category: "word-order",
          severity: "error",
          correction: "like it very much",
          note: "Word order.",
        },
      ]);
    });
  });

  describe("list", () => {
    const rootRow = {
      id: "root-1",
      level: "B1",
      taskType: "email",
      band: 5.5,
      wordCount: 100,
      hintsOpened: false,
      startedAt: new Date("2026-08-25T10:00:00Z"),
      submittedAt: new Date("2026-08-25T10:20:00Z"),
      elapsedSeconds: 1200,
    };

    it("queries only root attempts with nested revision chain fields", async () => {
      const { service, prisma } = serviceWith({});
      prisma.practiceAttempt.findMany.mockResolvedValueOnce([]);

      await service.list("user-1");

      expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", parentAttemptId: null },
          select: expect.objectContaining({
            id: true,
            band: true,
            revisions: {
              select: {
                band: true,
                revisionRound: true,
                revisions: {
                  select: {
                    band: true,
                    revisionRound: true,
                  },
                },
              },
            },
          }),
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          take: 21,
        }),
      );
    });

    it("maps the revision chain to revisionCount and latestBand", async () => {
      const { service, prisma } = serviceWith({});
      prisma.practiceAttempt.findMany.mockResolvedValueOnce([
        {
          ...rootRow,
          revisions: [
            {
              band: 6.0,
              revisionRound: 1,
              revisions: [{ band: 6.5, revisionRound: 2 }],
            },
          ],
        },
      ]);

      const page = await service.list("user-1");

      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        id: "root-1",
        band: 5.5,
        revisionCount: 2,
        latestBand: 6.5,
      });
      expect(page.items[0]).not.toHaveProperty("revisions");
    });

    it("uses the furthest graded revision for latestBand", async () => {
      const { service, prisma } = serviceWith({});
      prisma.practiceAttempt.findMany.mockResolvedValueOnce([
        {
          ...rootRow,
          revisions: [
            {
              band: 6.0,
              revisionRound: 1,
              revisions: [{ band: null, revisionRound: 2 }],
            },
          ],
        },
      ]);

      const page = await service.list("user-1");

      expect(page.items[0]).toMatchObject({
        revisionCount: 2,
        latestBand: 6.0,
      });
    });

    it("sets revisionCount 0 and latestBand null when there are no revisions", async () => {
      const { service, prisma } = serviceWith({});
      prisma.practiceAttempt.findMany.mockResolvedValueOnce([
        { ...rootRow, revisions: [] },
      ]);

      const page = await service.list("user-1");

      expect(page.items[0]).toMatchObject({
        id: "root-1",
        revisionCount: 0,
        latestBand: null,
      });
    });

    it("paginates roots with cursor without surfacing revisions as rows", async () => {
      const { service, prisma } = serviceWith({});
      const roots = [
        { ...rootRow, id: "root-a", revisions: [] },
        { ...rootRow, id: "root-b", revisions: [{ band: 6.5, revisionRound: 1, revisions: [] }] },
        { ...rootRow, id: "root-c", revisions: [] },
      ];
      prisma.practiceAttempt.findMany.mockResolvedValueOnce(roots);

      const page = await service.list("user-1", { limit: 2 });

      expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", parentAttemptId: null },
          take: 3,
        }),
      );
      expect(page.items.map((item) => item.id)).toEqual(["root-a", "root-b"]);
      expect(page.nextCursor).toBe("root-b");
      expect(page.items.every((item) => !("revisions" in item))).toBe(true);

      prisma.practiceAttempt.findMany.mockResolvedValueOnce([]);
      await service.list("user-1", { cursor: "root-b", limit: 2 });
      expect(prisma.practiceAttempt.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", parentAttemptId: null },
          cursor: { id: "root-b" },
          skip: 1,
          take: 3,
        }),
      );
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

  describe("generateSamples", () => {
    const gradedAttempt = {
      id: "a1",
      userId: "user-1",
      level: "B1",
      taskType: "email",
      prompt: "Write to your teacher.",
      submittedAt: new Date("2026-08-25T10:05:00Z"),
      band: 6,
      sampleEssays: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("returns 409 when the attempt has not been graded", async () => {
      const { service, complete } = serviceWith({
        attempt: { ...gradedAttempt, submittedAt: null, band: null },
      });

      await expect(service.generateSamples("user-1", "a1")).rejects.toBeInstanceOf(
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
      const existing = ["Essay one text.", "Essay two text."];
      const { service, complete } = serviceWith({
        attempt: { ...gradedAttempt, sampleEssays: existing },
      });

      const result = await service.generateSamples("user-1", "a1");

      expect(result.sampleEssays).toEqual(existing);
      expect(complete).not.toHaveBeenCalled();
    });

    it("generates and saves two samples, sized to the task level, when none exist yet", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: gradedAttempt,
        updated: { id: "a1", sampleEssays: ["Essay one.", "Essay two."] },
      });
      complete.mockResolvedValueOnce({
        essays: [{ text: "Essay one." }, { text: "Essay two." }],
      });

      const result = await service.generateSamples("user-1", "a1");

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Write to your teacher."),
          schema: SAMPLE_ESSAY_SCHEMA,
          usage: { userId: "user-1", endpoint: "practice.samples" },
        }),
      );
      expect(complete.mock.calls[0]![0].prompt).toContain("B1");
      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: { sampleEssays: ["Essay one.", "Essay two."] },
      });
      expect(result.sampleEssays).toEqual(["Essay one.", "Essay two."]);
    });
  });
});
