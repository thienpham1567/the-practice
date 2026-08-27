import type { PrismaService } from "../prisma/prisma.service";
import { VocabService } from "./vocab.service";

function serviceWith(overrides: {
  upsert?: jest.Mock;
  findMany?: jest.Mock;
  update?: jest.Mock;
  attemptFindFirst?: jest.Mock;
} = {}) {
  const vocabEntry = {
    upsert: overrides.upsert ?? jest.fn().mockResolvedValue({}),
    findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    update: overrides.update ?? jest.fn().mockResolvedValue({}),
  };
  const practiceAttempt = {
    findFirst:
      overrides.attemptFindFirst ?? jest.fn().mockResolvedValue(null),
  };
  const prisma = { vocabEntry, practiceAttempt };
  const service = new VocabService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe("VocabService", () => {
  describe("recordSuggested", () => {
    it("creates a new entry with normalized word, meaning, example, and level", async () => {
      const { service, prisma } = serviceWith();

      await service.recordSuggested("user-1", "B1", [
        { word: "  Lively ", meaning: "full of energy", example: "The crowd was lively." },
      ]);

      expect(prisma.vocabEntry.upsert).toHaveBeenCalledWith({
        where: { userId_word: { userId: "user-1", word: "lively" } },
        create: {
          userId: "user-1",
          word: "lively",
          meaning: "full of energy",
          example: "The crowd was lively.",
          level: "B1",
        },
        update: {
          suggestedCount: { increment: 1 },
          lastSuggestedAt: expect.any(Date),
        },
      });
    });

    it("on repeat suggestion increments count without changing meaning or example", async () => {
      const { service, prisma } = serviceWith();

      await service.recordSuggested("user-1", "B1", [
        { word: "lively", meaning: "different meaning", example: "different example" },
      ]);

      const call = prisma.vocabEntry.upsert.mock.calls[0]![0];
      expect(call.update).toEqual({
        suggestedCount: { increment: 1 },
        lastSuggestedAt: expect.any(Date),
      });
      expect(call.update).not.toHaveProperty("meaning");
      expect(call.update).not.toHaveProperty("example");
      expect(call.create.meaning).toBe("different meaning");
    });

    it("treats different casings as the same word identity", async () => {
      const { service, prisma } = serviceWith();

      await service.recordSuggested("user-1", "A2", [
        { word: "Commute", meaning: "travel to work", example: "I commute by bus." },
        { word: "COMMUTE", meaning: "other", example: "other" },
      ]);

      expect(prisma.vocabEntry.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.vocabEntry.upsert.mock.calls[0]![0].where.userId_word.word).toBe(
        "commute",
      );
      expect(prisma.vocabEntry.upsert.mock.calls[1]![0].where.userId_word.word).toBe(
        "commute",
      );
    });
  });

  describe("reviewCandidates", () => {
    it("returns unused same-level entries oldest first, capped at 4", async () => {
      const rows = [
        { word: "a", meaning: "m1", example: "e1" },
        { word: "b", meaning: "m2", example: "e2" },
        { word: "c", meaning: "m3", example: "e3" },
        { word: "d", meaning: "m4", example: "e4" },
      ];
      const { service, prisma } = serviceWith({
        findMany: jest.fn().mockResolvedValue(rows),
        attemptFindFirst: jest.fn().mockResolvedValue(null),
      });

      const result = await service.reviewCandidates("user-1", "B1");

      expect(prisma.practiceAttempt.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { startedAt: "desc" },
        select: { vocabulary: true },
      });
      expect(prisma.vocabEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          level: "B1",
          usedCount: 0,
          word: { notIn: [] },
        },
        orderBy: { lastSuggestedAt: "asc" },
        take: 4,
        select: { word: true, meaning: true, example: true },
      });
      expect(result).toEqual(rows);
    });

    it("excludes words from the newest attempt vocabulary (any level)", async () => {
      const { service, prisma } = serviceWith({
        findMany: jest.fn().mockResolvedValue([]),
        attemptFindFirst: jest.fn().mockResolvedValue({
          vocabulary: [
            { word: "Lively", meaning: "x", example: "y" },
            { word: "commute", meaning: "x", example: "y" },
          ],
        }),
      });

      await service.reviewCandidates("user-1", "A2");

      expect(prisma.vocabEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            word: { notIn: ["lively", "commute"] },
          }),
        }),
      );
    });

    it("ignores malformed vocabulary on the newest attempt", async () => {
      const { service, prisma } = serviceWith({
        findMany: jest.fn().mockResolvedValue([]),
        attemptFindFirst: jest.fn().mockResolvedValue({ vocabulary: "not-an-array" }),
      });

      await service.reviewCandidates("user-1", "B1");

      expect(prisma.vocabEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ word: { notIn: [] } }),
        }),
      );
    });
  });

  describe("markUsed", () => {
    it("increments usedCount for every matched entry in one scan", async () => {
      const entries = [
        { id: "1", word: "lively", usedCount: 0, firstUsedAt: null },
        { id: "2", word: "commute", usedCount: 0, firstUsedAt: null },
        { id: "3", word: "useful", usedCount: 0, firstUsedAt: null },
      ];
      const update = jest.fn().mockResolvedValue({});
      const { service, prisma } = serviceWith({
        findMany: jest.fn().mockResolvedValue(entries),
        update,
      });

      await service.markUsed(
        "user-1",
        "The commuting crowd was lively last night.",
      );

      expect(prisma.vocabEntry.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(update).toHaveBeenCalledTimes(2);
      const updatedIds = update.mock.calls.map((c) => c[0].where.id).sort();
      expect(updatedIds).toEqual(["1", "2"]);
      for (const call of update.mock.calls) {
        expect(call[0].data.usedCount).toEqual({ increment: 1 });
        expect(call[0].data.firstUsedAt).toEqual(expect.any(Date));
      }
    });

    it("still increments when already used, without overwriting firstUsedAt", async () => {
      const firstUsedAt = new Date("2026-01-01T00:00:00.000Z");
      const entries = [
        { id: "1", word: "lively", usedCount: 2, firstUsedAt },
      ];
      const update = jest.fn().mockResolvedValue({});
      const { service } = serviceWith({
        findMany: jest.fn().mockResolvedValue(entries),
        update,
      });

      await service.markUsed("user-1", "It was lively.");

      expect(update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          usedCount: { increment: 1 },
        },
      });
      expect(update.mock.calls[0]![0].data).not.toHaveProperty("firstUsedAt");
    });

    it("does nothing when no vocabulary matches", async () => {
      const update = jest.fn().mockResolvedValue({});
      const { service } = serviceWith({
        findMany: jest.fn().mockResolvedValue([
          { id: "1", word: "lively", usedCount: 0, firstUsedAt: null },
        ]),
        update,
      });

      await service.markUsed("user-1", "Nothing relevant here.");

      expect(update).not.toHaveBeenCalled();
    });
  });
});
