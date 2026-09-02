import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { MistakesService } from "./mistakes.service";

function serviceWith(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { practiceAttempt: { findMany } };
  return {
    service: new MistakesService(prisma as unknown as PrismaService),
    findMany,
  };
}

const mark = (category: string) => ({
  start: 0,
  end: 1,
  category,
  severity: "error",
  correction: "x",
  note: "y",
});

describe("MistakesService", () => {
  it("asks only for graded root attempts, newest first", async () => {
    const { service, findMany } = serviceWith([]);

    await service.profile("user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          submittedAt: { not: null },
          parentAttemptId: null,
          marks: { not: Prisma.DbNull },
        },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
    );
  });

  it("excludes failed extractions in the query so the window stays ten papers", async () => {
    const { service, findMany } = serviceWith([]);

    await service.profile("user-1");

    const { where, take } = findMany.mock.calls[0][0];
    // Excluding after `take` would leave a window of however many of the last
    // ten happened to extract — the bug this asserts against.
    expect(where.marks).toEqual({ not: Prisma.DbNull });
    expect(take).toBe(10);
  });

  it("summarises the marks it finds", async () => {
    const { service } = serviceWith([
      {
        marks: [mark("article"), mark("article")],
        wordCount: 100,
        submittedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const profile = await service.profile("user-1");

    expect(profile.attemptsConsidered).toBe(1);
    expect(profile.tallies).toEqual([{ category: "article", count: 2, trend: null }]);
  });

  it("still skips a non-array marks row the query let through", async () => {
    const { service } = serviceWith([
      { marks: null, wordCount: 100, submittedAt: new Date("2026-01-01T00:00:00Z") },
      {
        marks: [mark("article"), mark("article")],
        wordCount: 100,
        submittedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const profile = await service.profile("user-1");

    expect(profile.attemptsConsidered).toBe(1);
  });

  it("returns an empty profile when nothing is graded yet", async () => {
    const { service } = serviceWith([]);
    expect(await service.profile("user-1")).toEqual({ tallies: [], attemptsConsidered: 0 });
  });
});
