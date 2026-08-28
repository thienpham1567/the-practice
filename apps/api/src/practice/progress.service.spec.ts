import type { PrismaService } from "../prisma/prisma.service";
import { ProgressService } from "./progress.service";

function serviceWith(opts: {
  writingFindMany?: jest.Mock;
  speakingFindMany?: jest.Mock;
} = {}) {
  const writingFindMany = opts.writingFindMany ?? jest.fn().mockResolvedValue([]);
  const speakingFindMany = opts.speakingFindMany ?? jest.fn().mockResolvedValue([]);
  const prisma = {
    practiceAttempt: { findMany: writingFindMany },
    speakingAttempt: { findMany: speakingFindMany },
  };
  const service = new ProgressService(prisma as unknown as PrismaService);
  return { service, writingFindMany, speakingFindMany };
}

const scores = {
  taskResponse: 6.5,
  coherenceCohesion: 6,
  lexicalResource: 7,
  grammaticalRange: 5.5,
};

describe("ProgressService", () => {
  describe("summary", () => {
    it("queries graded root writing and speaking attempts in the last 90 days", async () => {
      const { service, writingFindMany, speakingFindMany } = serviceWith();
      const before = Date.now();

      await service.summary("user-1");

      const after = Date.now();
      expect(writingFindMany).toHaveBeenCalledTimes(1);
      expect(speakingFindMany).toHaveBeenCalledTimes(1);

      const writingArg = writingFindMany.mock.calls[0]![0];
      expect(writingArg.where).toEqual({
        userId: "user-1",
        parentAttemptId: null,
        submittedAt: { gte: expect.any(Date) },
        band: { not: null },
      });
      expect(writingArg.orderBy).toEqual({ submittedAt: "asc" });

      const speakingArg = speakingFindMany.mock.calls[0]![0];
      expect(speakingArg.where).toEqual({
        userId: "user-1",
        parentAttemptId: null,
        submittedAt: { gte: expect.any(Date) },
        band: { not: null },
      });
      expect(speakingArg.orderBy).toEqual({ submittedAt: "asc" });

      const ninetyDaysMs = 90 * 86_400_000;
      for (const since of [
        writingArg.where.submittedAt.gte as Date,
        speakingArg.where.submittedAt.gte as Date,
      ]) {
        expect(since.getTime()).toBeGreaterThanOrEqual(before - ninetyDaysMs - 1000);
        expect(since.getTime()).toBeLessThanOrEqual(after - ninetyDaysMs + 1000);
      }
    });

    it("returns empty series and zero streak when user has no graded attempts", async () => {
      const { service } = serviceWith();

      const result = await service.summary("user-1");

      expect(result).toEqual({
        series: [],
        streak: { current: 0, submittedDates: [] },
        speaking: { series: [] },
      });
    });

    it("maps scores and converts styleSnapshot to per-100-words", async () => {
      const submittedAt = new Date("2026-08-20T10:00:00.000Z");
      const writingFindMany = jest.fn().mockResolvedValue([
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
      const { service } = serviceWith({ writingFindMany });

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

    it("maps speaking band and wordsPerMinute on a separate series", async () => {
      const submittedAt = new Date("2026-08-20T11:00:00.000Z");
      const speakingFindMany = jest.fn().mockResolvedValue([
        {
          submittedAt,
          level: "B1",
          band: 6,
          fluency: { wordsPerMinute: 120, fillerCount: 3 },
        },
        {
          submittedAt: new Date("2026-08-21T11:00:00.000Z"),
          level: "B2",
          band: 6.5,
          fluency: null,
        },
      ]);
      const { service } = serviceWith({ speakingFindMany });

      const result = await service.summary("user-1");

      expect(result.speaking.series).toEqual([
        {
          at: submittedAt.toISOString(),
          level: "B1",
          band: 6,
          wordsPerMinute: 120,
        },
        {
          at: "2026-08-21T11:00:00.000Z",
          level: "B2",
          band: 6.5,
          wordsPerMinute: null,
        },
      ]);
      // Writing streak stays writing-only
      expect(result.series).toEqual([]);
      expect(result.streak.submittedDates).toEqual([]);
    });

    it("sets per100 to null when styleSnapshot is missing or broken", async () => {
      const submittedAt = new Date("2026-08-21T12:00:00.000Z");
      const writingFindMany = jest.fn().mockResolvedValue([
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
      const { service } = serviceWith({ writingFindMany });

      const result = await service.summary("user-1");

      expect(result.series.map((row) => row.per100)).toEqual([null, null, null, null]);
    });

    it("computes current streak from submitted dates", async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const writingFindMany = jest.fn().mockResolvedValue([
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
      const { service } = serviceWith({ writingFindMany });

      const result = await service.summary("user-1");

      expect(result.streak.current).toBe(2);
      expect(result.streak.submittedDates).toHaveLength(2);
    });
  });
});
