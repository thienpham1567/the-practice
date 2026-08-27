import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { computeStreak, type Level } from "@writing-helper/practice";
import { PrismaService } from "../prisma/prisma.service";

const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 90;

const SUMMARY_FIELDS = {
  submittedAt: true,
  level: true,
  band: true,
  scores: true,
  styleSnapshot: true,
} satisfies Prisma.PracticeAttemptSelect;

export type ProgressScores = {
  task: number;
  coherence: number;
  lexical: number;
  grammar: number;
};

export type ProgressPer100 = {
  passives: number;
  adverbs: number;
};

export type ProgressSeriesPoint = {
  at: string;
  level: Level;
  band: number;
  scores: ProgressScores;
  per100: ProgressPer100 | null;
};

export type ProgressSummary = {
  series: ProgressSeriesPoint[];
  streak: { current: number; submittedDates: string[] };
};

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, now: Date = new Date()): Promise<ProgressSummary> {
    const since = new Date(now.getTime() - LOOKBACK_DAYS * MS_PER_DAY);

    const rows = await this.prisma.practiceAttempt.findMany({
      where: {
        userId,
        parentAttemptId: null,
        submittedAt: { gte: since },
        band: { not: null },
      },
      select: SUMMARY_FIELDS,
      orderBy: { submittedAt: "asc" },
    });

    const series: ProgressSeriesPoint[] = rows.map((row) => {
      const submittedAt = row.submittedAt!;
      return {
        at: submittedAt.toISOString(),
        level: row.level as Level,
        band: row.band!,
        scores: mapScores(row.scores),
        per100: per100FromSnapshot(row.styleSnapshot),
      };
    });

    const submittedDates = series.map((point) => point.at);
    const streak = computeStreak(
      submittedDates.map((iso) => new Date(iso)),
      now,
    );

    return {
      series,
      streak: {
        current: streak.current,
        submittedDates,
      },
    };
  }
}

function mapScores(raw: unknown): ProgressScores {
  const scores =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    task: asNumber(scores.taskResponse),
    coherence: asNumber(scores.coherenceCohesion),
    lexical: asNumber(scores.lexicalResource),
    grammar: asNumber(scores.grammaticalRange),
  };
}

function per100FromSnapshot(raw: unknown): ProgressPer100 | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const snapshot = raw as Record<string, unknown>;
    const counts =
      snapshot.counts && typeof snapshot.counts === "object"
        ? (snapshot.counts as Record<string, unknown>)
        : null;
    const stats =
      snapshot.stats && typeof snapshot.stats === "object"
        ? (snapshot.stats as Record<string, unknown>)
        : null;
    if (!counts || !stats) return null;

    const passives = asOptionalNumber(counts.passives);
    const adverbs = asOptionalNumber(counts.adverbs);
    const words = asOptionalNumber(stats.words);
    if (passives == null || adverbs == null || words == null || words <= 0) {
      return null;
    }

    return {
      passives: (passives / words) * 100,
      adverbs: (adverbs / words) * 100,
    };
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
