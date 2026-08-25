import { ConflictException, NotFoundException } from "@nestjs/common";
import { overallBand } from "@writing-helper/practice";
import type { AiService } from "../ai/ai.service";
import type { PrismaService } from "../prisma/prisma.service";
import { PracticeService } from "./practice.service";

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
  created?: Record<string, unknown>;
  updated?: Record<string, unknown>;
}) {
  const prisma = {
    practiceAttempt: {
      findMany: jest.fn().mockResolvedValue(
        (overrides.recentTypes ?? []).map((taskType) => ({ taskType })),
      ),
      findFirst: jest.fn().mockResolvedValue(overrides.attempt ?? null),
      create: jest.fn().mockResolvedValue(overrides.created ?? { id: "a1", ...generated }),
      update: jest.fn().mockResolvedValue(overrides.updated ?? { id: "a1" }),
    },
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
    };

    it("computes overall band on the server from the four criteria", async () => {
      const { service, prisma, complete } = serviceWith({
        attempt: draft,
        updated: { id: "a1", band: 6 },
      });
      complete.mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: { counts: { passives: 1 } },
      });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Write to your teacher."),
        }),
      );
      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            band: overallBand(graded.scores),
            scores: graded.scores,
            feedback: graded.feedback,
            styleSnapshot: { counts: { passives: 1 } },
          }),
        }),
      );
      expect(overallBand(graded.scores)).toBe(6);
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
  });
});
