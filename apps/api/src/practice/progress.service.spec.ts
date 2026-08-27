import type { PrismaService } from "../prisma/prisma.service";
import { ProgressService } from "./progress.service";

function serviceWith(findMany: jest.Mock = jest.fn().mockResolvedValue([])) {
  const prisma = { practiceAttempt: { findMany } };
  const service = new ProgressService(prisma as unknown as PrismaService);
  return { service, prisma, findMany };
}

const scores = {
  taskResponse: 6.5,
  coherenceCohesion: 6,
  lexicalResource: 7,
  grammaticalRange: 5.5,
};

describe("ProgressService", () => {
  describe("summary", () => {
    it("queries graded root attempts in the last 90 days, oldest first", async () => {
      const { service, findMany } = serviceWith();
      const before = Date.now();

      await service.summary("user-1");

      const after = Date.now();
      expect(findMany).toHaveBeenCalledTimes(1);
      const arg = findMany.mock.calls[0]![0];
      expect(arg.where).toEqual({
        userId: "user-1",
        parentAttemptId: null,
        submittedAt: { gte: expect.any(Date) },
        band: { not: null },
      });
      const since = arg.where.submittedAt.gte as Date;
      const ninetyDaysMs = 90 * 86_400_000;
      expect(since.getTime()).toBeGreaterThanOrEqual(before - ninetyDaysMs - 1000);
      expect(since.getTime()).toBeLessThanOrEqual(after - ninetyDaysMs + 1000);
      expect(arg.orderBy).toEqual({ submittedAt: "asc" });
    });

    it("returns empty series and zero streak when user has no graded attempts", async () => {
      const { service } = serviceWith(jest.fn().mockResolvedValue([]));

      const result = await service.summary("user-1");

      expect(result).toEqual({
        series: [],
        streak: { current: 0, submittedDates: [] },
      });
    });

    it("maps scores and converts styleSnapshot to per-100-words", async () => {
      const submittedAt = new Date("2026-08-20T10:00:00.000Z");
      const findMany = jest.fn().mockResolvedValue([
        {
          submittedAt,
          level: "B1",
          band: 6.5,
          scores,
          styleSnapshot: {
            counts: { passives: 2, adverbs: 5 },
            stats: { words: 250 },
          },
        },
      ]);
      const { service } = serviceWith(findMany);

      const result = await service.summary("user-1");

      expect(result.series).toEqual([
        {
          at: submittedAt.toISOString(),
          level: "B1",
          band: 6.5,
          scores: { task: 6.5, coherence: 6, lexical: 7, grammar: 5.5 },
          per100: { passives: 0.8, adverbs: 2 },
        },
      ]);
      expect(result.streak.submittedDates).toEqual([submittedAt.toISOString()]);
    });

    it("sets per100 to null when styleSnapshot is missing or broken", async () => {
      const submittedAt = new Date("2026-08-21T12:00:00.000Z");
      const findMany = jest.fn().mockResolvedValue([
        {
          submittedAt,
          level: "A2",
          band: 5,
          scores,
          styleSnapshot: null,
        },
        {
          submittedAt: new Date("2026-08-22T12:00:00.000Z"),
          level: "A2",
          band: 5.5,
          scores,
          styleSnapshot: { counts: { passives: 1 }, stats: { words: 0 } },
        },
        {
          submittedAt: new Date("2026-08-23T12:00:00.000Z"),
          level: "A2",
          band: 6,
          scores,
          styleSnapshot: "not-json-object",
        },
        {
          submittedAt: new Date("2026-08-24T12:00:00.000Z"),
          level: "A2",
          band: 6,
          scores,
          styleSnapshot: { counts: { passives: 1, adverbs: 2 } },
        },
      ]);
      const { service } = serviceWith(findMany);

      const result = await service.summary("user-1");

      expect(result.series.map((row) => row.per100)).toEqual([null, null, null, null]);
    });

    it("computes current streak from submitted dates", async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const findMany = jest.fn().mockResolvedValue([
        {
          submittedAt: yesterday,
          level: "B1",
          band: 6,
          scores,
          styleSnapshot: null,
        },
        {
          submittedAt: today,
          level: "B1",
          band: 6.5,
          scores,
          styleSnapshot: null,
        },
      ]);
      const { service } = serviceWith(findMany);

      const result = await service.summary("user-1");

      expect(result.streak.current).toBe(2);
      expect(result.streak.submittedDates).toHaveLength(2);
    });
  });
});
