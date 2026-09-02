import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  overallBand,
  pickTask,
  TASK_CATALOG,
  type Level,
  type TaskSpec,
  type TaskType,
} from "@writing-helper/practice";
import { AiService, PRACTICE_DEADLINE_MS, PRACTICE_TIMEOUT_MS } from "../ai/ai.service";
import { DEFAULT_PAGE_SIZE, toCursorPage } from "../common/cursor-page";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateAttemptDto,
  SubmitAttemptDto,
  UpdateAttemptDto,
} from "./dto/practice.dto";
import { GENERATE_TASK_SCHEMA, buildGeneratePrompt, type GeneratedTask } from "./generate-prompt";
import { GRADE_TASK_SCHEMA, buildGradePrompt, type GradeResult } from "./grade-prompt";
import { EXTRACT_MARKS_SCHEMA, buildMarkPrompt, type ExtractMarksResult } from "./mark-prompt";
import { resolveWritingMarks } from "./resolve-marks";
import {
  REVISION_GRADE_SCHEMA,
  buildRevisionGradePrompt,
  parseFeedbackAudit,
  type RevisionGradeResult,
} from "./revision-grade-prompt";
import { normalizeWord } from "./vocab-match";
import { VocabService, type VocabSuggestItem } from "./vocab.service";

const LIST_FIELDS = {
  id: true,
  level: true,
  taskType: true,
  band: true,
  wordCount: true,
  hintsOpened: true,
  startedAt: true,
  submittedAt: true,
  elapsedSeconds: true,
} satisfies Prisma.PracticeAttemptSelect;

const LIST_REVISION_FIELDS = {
  band: true,
  revisionRound: true,
} satisfies Prisma.PracticeAttemptSelect;

/** Nested include for root→rev1→rev2 chain summary on list rows. */
const LIST_CHAIN_SELECT = {
  ...LIST_FIELDS,
  revisions: {
    select: {
      ...LIST_REVISION_FIELDS,
      revisions: { select: LIST_REVISION_FIELDS },
    },
  },
} satisfies Prisma.PracticeAttemptSelect;

type ListRevisionNode = {
  band: number | null;
  revisionRound: number;
  revisions?: ListRevisionNode[];
};

/** Flatten root→rev1→rev2 into revisionCount + furthest graded band. */
function summarizeRevisionChain(revisions: ListRevisionNode[]): {
  revisionCount: number;
  latestBand: number | null;
} {
  const flat: Array<{ band: number | null; revisionRound: number }> = [];
  for (const rev of revisions) {
    flat.push(rev);
    if (rev.revisions) flat.push(...rev.revisions);
  }
  const revisionCount = flat.length;
  if (revisionCount === 0) return { revisionCount: 0, latestBand: null };

  let latestBand: number | null = null;
  let latestRound = -1;
  for (const rev of flat) {
    if (rev.band != null && rev.revisionRound > latestRound) {
      latestBand = rev.band;
      latestRound = rev.revisionRound;
    }
  }
  return { revisionCount, latestBand };
}

/** Khoá chấm quá 2 phút coi là chết — cho phép chiếm lại. */
const GRADING_LOCK_STALE_MS = 2 * 60 * 1000;

@Injectable()
export class PracticeService {
  private readonly logger = new Logger(PracticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly vocab: VocabService,
  ) {}

  async create(userId: string, dto: CreateAttemptDto) {
    const chosen = await this.chooseTask(userId, dto.level, dto.taskType);

    let reviewCandidates: VocabSuggestItem[] = [];
    try {
      reviewCandidates = await this.vocab.reviewCandidates(userId, dto.level);
    } catch (error: unknown) {
      this.logger.warn(
        `event=vocab_review_candidates_failed userId=${userId} ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    const generated = await this.ai.complete<GeneratedTask>({
      prompt: buildGeneratePrompt(chosen, dto.level, reviewCandidates),
      schema: GENERATE_TASK_SCHEMA,
      maxTokens: 1000,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
      usage: { userId, endpoint: "practice.generate" },
    });

    const vocabulary = tagReviewVocabulary(generated.vocabulary, reviewCandidates);

    const attempt = await this.prisma.practiceAttempt.create({
      data: {
        userId,
        level: dto.level,
        taskType: chosen.type,
        prompt: `${generated.prompt.trim()}\n\n${chosen.instruction}`,
        ideas: generated.ideas as Prisma.InputJsonValue,
        vocabulary: vocabulary as Prisma.InputJsonValue,
      },
    });

    try {
      await this.vocab.recordSuggested(userId, dto.level, generated.vocabulary);
    } catch (error: unknown) {
      this.logger.warn(
        `event=vocab_record_suggested_failed userId=${userId} ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    return attempt;
  }

  async list(userId: string, opts: { cursor?: string; limit?: number } = {}) {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await this.prisma.practiceAttempt.findMany({
      where: { userId, parentAttemptId: null },
      select: LIST_CHAIN_SELECT,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const items = rows.map(({ revisions, ...rest }) => ({
      ...rest,
      ...summarizeRevisionChain(revisions),
    }));
    return toCursorPage(items, limit);
  }

  async findOne(userId: string, id: string) {
    const attempt = await this.prisma.practiceAttempt.findFirst({
      where: { id, userId },
      include: {
        parent: { select: { band: true } },
        revisions: { select: { id: true, submittedAt: true }, take: 1 },
      },
    });
    if (!attempt) throw new NotFoundException("Practice attempt not found");
    const { parent, revisions, ...rest } = attempt;
    const child = revisions[0] ?? null;
    return {
      ...rest,
      parentBand: parent?.band ?? null,
      hasRevision: child != null,
      pendingRevisionId: child != null && child.submittedAt == null ? child.id : null,
    };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.practiceAttempt.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Practice attempt not found");
    await this.prisma.practiceAttempt.delete({ where: { id } });
  }

  async revise(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.practiceAttempt.findFirst({ where: { id, userId } });
      if (!parent) throw new NotFoundException("Practice attempt not found");
      if (!parent.submittedAt || parent.band == null) {
        throw new ConflictException("Practice attempt has not been graded yet");
      }
      if (parent.revisionRound >= 2) {
        throw new ConflictException("Maximum revision rounds reached");
      }
      const existing = await tx.practiceAttempt.findFirst({
        where: { parentAttemptId: id },
      });
      if (existing) {
        throw new ConflictException("Practice attempt already has a revision");
      }

      return tx.practiceAttempt.create({
        data: {
          userId,
          level: parent.level,
          taskType: parent.taskType,
          prompt: parent.prompt,
          ideas: parent.ideas as Prisma.InputJsonValue,
          vocabulary: parent.vocabulary as Prisma.InputJsonValue,
          hintsOpened: parent.hintsOpened,
          content: parent.content as Prisma.InputJsonValue | undefined,
          plainText: parent.plainText,
          wordCount: parent.wordCount,
          parentAttemptId: id,
          revisionRound: parent.revisionRound + 1,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAttemptDto) {
    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Submitted practice cannot be edited");
    }

    return this.prisma.practiceAttempt.update({
      where: { id },
      data: {
        ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
        ...(dto.plainText !== undefined && { plainText: dto.plainText }),
        ...(dto.wordCount !== undefined && { wordCount: dto.wordCount }),
        ...(dto.hintsOpened ? { hintsOpened: true } : {}),
      },
    });
  }

  async submit(userId: string, id: string, dto: SubmitAttemptDto) {
    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Practice attempt already submitted");
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - GRADING_LOCK_STALE_MS);
    const claimed = await this.prisma.practiceAttempt.updateMany({
      where: {
        id,
        userId,
        submittedAt: null,
        OR: [{ gradingStartedAt: null }, { gradingStartedAt: { lte: staleBefore } }],
      },
      data: { gradingStartedAt: now },
    });

    if (claimed.count === 0) {
      throw new ConflictException("Practice attempt is already being graded");
    }

    const task = this.taskByType(attempt.taskType as TaskType);
    const plainText = dto.plainText ?? attempt.plainText;
    const wordCount = dto.wordCount ?? attempt.wordCount;
    const isRevision = Boolean(attempt.parentAttemptId);

    try {
      // Bóc lỗi chạy song song với chấm điểm. `.catch` gắn ngay tại đây nên
      // promise này không bao giờ reject: chấm điểm hỏng thì submit hỏng như
      // cũ, còn bóc lỗi hỏng thì người học vẫn có band, chỉ mất phần đánh dấu.
      const marksPromise = this.ai
        .complete<ExtractMarksResult>({
          prompt: buildMarkPrompt(task, plainText),
          schema: EXTRACT_MARKS_SCHEMA,
          maxTokens: 2000,
          timeoutMs: PRACTICE_TIMEOUT_MS,
          deadlineMs: PRACTICE_DEADLINE_MS,
          usage: { userId, endpoint: "practice.marks" },
        })
        .then((result) => resolveWritingMarks(plainText, result.marks ?? []))
        .catch((error: unknown) => {
          this.logger.warn(
            `event=practice_marks_failed attemptId=${id} ${error instanceof Error ? error.message : "unknown"}`,
          );
          return null;
        });

      let graded: GradeResult | RevisionGradeResult;
      if (isRevision) {
        const parent = await this.prisma.practiceAttempt.findFirst({
          where: { id: attempt.parentAttemptId! },
          select: { feedback: true, band: true },
        });
        if (!parent || parent.band == null || parent.feedback == null) {
          throw new NotFoundException("Parent practice attempt not found");
        }
        graded = await this.ai.complete<RevisionGradeResult>({
          prompt: buildRevisionGradePrompt({
            task,
            promptText: attempt.prompt,
            essay: plainText,
            wordCount,
            parentFeedback: parent.feedback as GradeResult["feedback"],
            parentBand: parent.band,
            level: attempt.level,
          }),
          schema: REVISION_GRADE_SCHEMA,
          maxTokens: 1500,
          timeoutMs: PRACTICE_TIMEOUT_MS,
          deadlineMs: PRACTICE_DEADLINE_MS,
          usage: { userId, endpoint: "practice.grade" },
        });
      } else {
        graded = await this.ai.complete<GradeResult>({
          prompt: buildGradePrompt({
            task,
            promptText: attempt.prompt,
            essay: plainText,
            wordCount,
          }),
          schema: GRADE_TASK_SCHEMA,
          maxTokens: 1500,
          timeoutMs: PRACTICE_TIMEOUT_MS,
          deadlineMs: PRACTICE_DEADLINE_MS,
          usage: { userId, endpoint: "practice.grade" },
        });
      }

      const submittedAt = new Date();
      const elapsedSeconds = Math.max(
        0,
        Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
      );
      let feedbackAudit: ReturnType<typeof parseFeedbackAudit> | undefined;
      if (isRevision) {
        feedbackAudit = parseFeedbackAudit(
          "feedbackAudit" in graded ? graded.feedbackAudit : undefined,
        );
        if (feedbackAudit === null) {
          this.logger.warn(
            `event=revision_feedback_audit_dropped attemptId=${id} reason=invalid_or_missing`,
          );
        }
      }

      const marks = await marksPromise;

      const updated = await this.prisma.practiceAttempt.update({
        where: { id },
        data: {
          ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
          plainText,
          wordCount,
          submittedAt,
          elapsedSeconds,
          gradingStartedAt: null,
          band: overallBand(graded.scores),
          scores: graded.scores as unknown as Prisma.InputJsonValue,
          feedback: graded.feedback as unknown as Prisma.InputJsonValue,
          ...(feedbackAudit !== undefined && {
            feedbackAudit: feedbackAudit as unknown as Prisma.InputJsonValue,
          }),
          styleSnapshot: dto.styleSnapshot as Prisma.InputJsonValue,
          ...(marks !== null && { marks: marks as unknown as Prisma.InputJsonValue }),
        },
      });

      try {
        await this.vocab.markUsed(userId, plainText);
      } catch (error: unknown) {
        this.logger.warn(
          `event=vocab_mark_used_failed userId=${userId} attemptId=${id} ${error instanceof Error ? error.message : "unknown"}`,
        );
      }

      return updated;
    } catch (error) {
      await this.prisma.practiceAttempt.updateMany({
        where: { id, userId, submittedAt: null },
        data: { gradingStartedAt: null },
      });
      throw error;
    }
  }

  private async chooseTask(userId: string, level: Level, taskType?: TaskType): Promise<TaskSpec> {
    if (taskType) return this.resolveTask(level, taskType);

    const recent = await this.prisma.practiceAttempt.findMany({
      where: { userId, level },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { taskType: true },
    });

    return pickTask(
      level,
      recent.map((row) => row.taskType as TaskType),
    );
  }

  private resolveTask(level: Level, taskType: TaskType): TaskSpec {
    const task = this.taskByType(taskType);
    if (!task.levels.includes(level)) {
      throw new BadRequestException(`${taskType} is not available at level ${level}`);
    }
    return task;
  }

  private taskByType(taskType: TaskType): TaskSpec {
    const task = TASK_CATALOG.find((item) => item.type === taskType);
    if (!task) throw new BadRequestException(`Unknown task type: ${taskType}`);
    return task;
  }
}

/** Tag AI vocabulary items that match review candidates (normalized word). */
function tagReviewVocabulary(
  vocabulary: GeneratedTask["vocabulary"],
  candidates: VocabSuggestItem[],
): Array<GeneratedTask["vocabulary"][number] & { review?: true }> {
  if (candidates.length === 0) return vocabulary;

  const reviewWords = new Set(
    candidates.map((item) => normalizeWord(item.word)).filter(Boolean),
  );

  return vocabulary.map((item) => {
    if (reviewWords.has(normalizeWord(item.word))) {
      return { ...item, review: true as const };
    }
    return item;
  });
}
