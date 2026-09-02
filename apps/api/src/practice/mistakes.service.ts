import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  PROFILE_WINDOW,
  summarizeMarks,
  type MistakeProfile,
  type WritingMark,
} from "@writing-helper/practice";
import { PrismaService } from "../prisma/prisma.service";

const PROFILE_FIELDS = {
  marks: true,
  wordCount: true,
  submittedAt: true,
} satisfies Prisma.PracticeAttemptSelect;

@Injectable()
export class MistakesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Root attempts only (`parentAttemptId: null`): a revision starts from the
   * paper it revises, so counting both would double-count the same mistakes.
   * Same rule the progress page settled on.
   *
   * The profile is computed here rather than shipping every paper's marks to
   * the client — both consumers only need labels and counts.
   */
  async profile(userId: string): Promise<MistakeProfile> {
    const rows = await this.prisma.practiceAttempt.findMany({
      where: { userId, submittedAt: { not: null }, parentAttemptId: null },
      orderBy: { submittedAt: "desc" },
      take: PROFILE_WINDOW,
      select: PROFILE_FIELDS,
    });

    return summarizeMarks(
      rows
        .filter((row) => Array.isArray(row.marks))
        .map((row) => ({
          marks: row.marks as unknown as WritingMark[],
          wordCount: row.wordCount,
          submittedAt: row.submittedAt as Date,
        })),
    );
  }
}
