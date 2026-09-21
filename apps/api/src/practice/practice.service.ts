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
  type Enhancement,
  type Level,
  type TaskSpec,
  type TaskType,
  type WritingMark,
} from "@writing-helper/practice";
import { AiService, PRACTICE_DEADLINE_MS, PRACTICE_TIMEOUT_MS } from "../ai/ai.service";
import { DEFAULT_PAGE_SIZE, toCursorPage } from "../common/cursor-page";
import { PrismaService } from "../prisma/prisma.service";
import { computeMarksResolution } from "./audit-marks-resolution";
import type {
  CreateAttemptDto,
  SubmitAttemptDto,
  UpdateAttemptDto,
} from "./dto/practice.dto";
import { GENERATE_TASK_SCHEMA, buildGeneratePrompt, type GeneratedTask } from "./generate-prompt";
import { GRADE_TASK_SCHEMA, buildGradePrompt, type GradeResult } from "./grade-prompt";
import {
  EXTRACT_MARKS_SCHEMA,
  VERIFY_MARKS_SCHEMA,
  buildMarkPrompt,
  buildVerifyMarksPrompt,
  toPriorMarkContext,
  type ExtractMarksResult,
  type PriorMarkContext,
  type RawWritingMark,
  type VerifyMarksResult,
} from "./mark-prompt";
import { resolveEnhancements } from "./resolve-enhancements";
import { resolveWritingMarks } from "./resolve-marks";
import {
  REVISION_GRADE_SCHEMA,
  buildRevisionGradePrompt,
  parseFeedbackAudit,
  type RevisionGradeResult,
} from "./revision-grade-prompt";
import {
  SAMPLE_ESSAY_SCHEMA,
  buildSampleEssayPrompt,
  type SampleEssayResult,
} from "./sample-essay-prompt";
import { VocabService, type VocabSuggestItem } from "./vocab.service";
import { tagReviewVocabulary } from "./vocab-tag";

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
        scale: "toeic",
        taskType: chosen.type,
        // Chỉ lưu tình huống. Khung yêu cầu cố định của dạng bài đã đi kèm
        // `TaskSpec`, nên cả hai prompt chấm lẫn giao diện đều tự lấy được —
        // nối vào đây chỉ tạo ra một câu thừa lặp lại điều đề đã nói.
        prompt: generated.prompt.trim(),
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

  /**
   * Sinh 2 bài mẫu tham khảo cho đúng đề đã chấm. Sinh một lần duy nhất —
   * bấm lại chỉ trả về kết quả cũ, không gọi AI thêm (xem
   * docs/superpowers/specs/2026-09-14-sample-essays-and-path-rename-design.md).
   */
  async generateSamples(userId: string, id: string) {
    const attempt = await this.findOne(userId, id);
    if (!attempt.submittedAt || attempt.band == null) {
      throw new ConflictException("Practice attempt has not been graded yet");
    }
    if (attempt.sampleEssays != null) {
      return attempt;
    }

    const task = this.taskByType(attempt.taskType as TaskType);
    const generated = await this.ai.complete<SampleEssayResult>({
      prompt: buildSampleEssayPrompt(task, attempt.prompt, attempt.level as Level),
      schema: SAMPLE_ESSAY_SCHEMA,
      maxTokens: 3000,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
      usage: { userId, endpoint: "practice.samples" },
    });
    const sampleEssays = generated.essays.map((essay) => essay.text);

    const updated = await this.prisma.practiceAttempt.update({
      where: { id },
      data: { sampleEssays: sampleEssays as unknown as Prisma.InputJsonValue },
    });
    return { ...attempt, ...updated };
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
        // `!== undefined` chứ không phải kiểm truthy: mảng rỗng là giá trị hợp
        // lệ (bỏ đánh dấu hết) và phải được ghi.
        ...(dto.handledMarks !== undefined && {
          handledMarks: dto.handledMarks as unknown as Prisma.InputJsonValue,
        }),
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
      // Bài revision cần bài cha SỚM: vừa để chấm (feedback + audit), vừa để
      // cấp ngữ cảnh cho lượt bóc lỗi — không phải chờ tới lúc chấm mới biết
      // bài cha nói gì (xem docs/superpowers/specs/2026-09-14-grading-exhaustiveness-design.md).
      let parent: {
        feedback: Prisma.JsonValue;
        band: number | null;
        marks: Prisma.JsonValue;
        plainText: string;
      } | null = null;
      let parentMarksContext: PriorMarkContext[] = [];
      if (isRevision) {
        parent = await this.prisma.practiceAttempt.findFirst({
          where: { id: attempt.parentAttemptId! },
          select: { feedback: true, band: true, marks: true, plainText: true },
        });
        if (!parent || parent.band == null || parent.feedback == null) {
          throw new NotFoundException("Parent practice attempt not found");
        }
        const parentMarks = (parent.marks as unknown as WritingMark[] | null) ?? [];
        parentMarksContext = toPriorMarkContext(parent.plainText, parentMarks);
      }

      // Bóc lỗi chạy song song với chấm điểm. `.catch` gắn ngay tại đây nên
      // promise này không bao giờ reject: chấm điểm hỏng thì submit hỏng như
      // cũ, còn bóc lỗi hỏng thì người học vẫn có band, chỉ mất phần đánh dấu.
      const marksPromise = this.extractMarksAndEnhancements({
        userId,
        attemptId: id,
        task,
        promptText: attempt.prompt,
        plainText,
        parentMarks: parentMarksContext,
      });

      let graded: GradeResult | RevisionGradeResult;
      if (isRevision) {
        graded = await this.ai.complete<RevisionGradeResult>({
          prompt: buildRevisionGradePrompt({
            task,
            promptText: attempt.prompt,
            essay: plainText,
            wordCount,
            parentFeedback: parent!.feedback as GradeResult["feedback"],
            parentBand: parent!.band!,
            parentMarks: parentMarksContext,
            level: attempt.level,
          }),
          schema: REVISION_GRADE_SCHEMA,
          // Was 1500; feedback.improvements pushed revision grading (already the
          // heaviest schema — scores + feedback + feedbackAudit) past that budget
          // and truncated mid-JSON. Bumped for both calls so base and revision
          // grading stay comparable.
          maxTokens: 2000,
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
          maxTokens: 2000,
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
      // Vế "criteria" do AI thuật lại (có thể sai, xem note ở buildRevisionGradePrompt);
      // vế "marksResolution" tính bằng code từ đúng bài hiện tại nên không thể ảo giác.
      let feedbackAudit: { criteria: NonNullable<ReturnType<typeof parseFeedbackAudit>>; marksResolution: ReturnType<typeof computeMarksResolution> } | undefined;
      if (isRevision) {
        const criteria = parseFeedbackAudit(
          "feedbackAudit" in graded ? graded.feedbackAudit : undefined,
        );
        if (criteria === null) {
          this.logger.warn(
            `event=revision_feedback_audit_dropped attemptId=${id} reason=invalid_or_missing`,
          );
        }
        const parentMarks = (parent!.marks as unknown as WritingMark[] | null) ?? [];
        feedbackAudit = {
          criteria: criteria ?? [],
          marksResolution: computeMarksResolution(parent!.plainText, parentMarks, plainText),
        };
      }

      const { marks, enhancements } = await marksPromise;

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
          ...(enhancements !== null && {
            enhancements: enhancements as unknown as Prisma.InputJsonValue,
          }),
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

  /**
   * Trích lỗi 2 lượt: extract rồi verify. Một lượt sinh duy nhất luôn có xác
   * suất bỏ sót — verify đưa lại bài + danh sách vừa tìm, ép AI rà lại và chỉ
   * trả về lỗi CHƯA có trong danh sách. Verify hỏng thì vẫn dùng kết quả lượt
   * extract (không để một lượt phụ kéo sập cả lượt chính). Xem
   * docs/superpowers/specs/2026-09-14-grading-exhaustiveness-design.md.
   */
  private async extractMarksAndEnhancements(params: {
    userId: string;
    attemptId: string;
    task: TaskSpec;
    promptText: string;
    plainText: string;
    parentMarks: PriorMarkContext[];
  }): Promise<{ marks: WritingMark[] | null; enhancements: Enhancement[] | null }> {
    const { userId, attemptId, task, promptText, plainText, parentMarks } = params;

    try {
      const first = await this.ai.complete<ExtractMarksResult>({
        prompt: buildMarkPrompt(task, promptText, plainText, parentMarks),
        schema: EXTRACT_MARKS_SCHEMA,
        maxTokens: 2000,
        timeoutMs: PRACTICE_TIMEOUT_MS,
        deadlineMs: PRACTICE_DEADLINE_MS,
        usage: { userId, endpoint: "practice.marks" },
      });

      let combinedRaw: RawWritingMark[] = first.marks ?? [];
      try {
        const verify = await this.ai.complete<VerifyMarksResult>({
          prompt: buildVerifyMarksPrompt(task, promptText, plainText, combinedRaw),
          schema: VERIFY_MARKS_SCHEMA,
          maxTokens: 1500,
          timeoutMs: PRACTICE_TIMEOUT_MS,
          deadlineMs: PRACTICE_DEADLINE_MS,
          usage: { userId, endpoint: "practice.marks" },
        });
        combinedRaw = combinedRaw.concat(verify.marks ?? []);
      } catch (error: unknown) {
        this.logger.warn(
          `event=practice_marks_verify_failed attemptId=${attemptId} ${error instanceof Error ? error.message : "unknown"}`,
        );
      }

      // Model trả lỗi nhưng không định vị được cái nào (thường vì nó diễn đạt
      // lại thay vì trích nguyên văn) là bóc lỗi thất bại, không phải bài sạch
      // lỗi — trả `null` để không đếm nhầm thành bài không lỗi.
      const resolvedMarks = resolveWritingMarks(plainText, combinedRaw);
      if (combinedRaw.length > 0 && resolvedMarks.length === 0) {
        this.logger.warn(
          `event=practice_marks_unlocatable attemptId=${attemptId} returned=${combinedRaw.length}`,
        );
        return { marks: null, enhancements: null };
      }

      const resolvedEnhancements = resolveEnhancements(plainText, first.enhancements ?? []);
      return { marks: resolvedMarks, enhancements: resolvedEnhancements };
    } catch (error: unknown) {
      this.logger.warn(
        `event=practice_marks_failed attemptId=${attemptId} ${error instanceof Error ? error.message : "unknown"}`,
      );
      return { marks: null, enhancements: null };
    }
  }

  private async chooseTask(userId: string, level: Level, taskType?: string): Promise<TaskSpec> {
    if (taskType) return this.resolveTask(taskType);

    const recent = await this.prisma.practiceAttempt.findMany({
      where: { userId, level },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { taskType: true },
    });

    return pickTask(recent.map((row) => row.taskType as TaskType));
  }

  private resolveTask(taskType: string): TaskSpec {
    return this.taskByType(taskType);
  }

  private taskByType(taskType: string): TaskSpec {
    const task = TASK_CATALOG.find((item) => item.type === taskType);
    if (!task) throw new BadRequestException(`Unknown task type: ${taskType}`);
    return task;
  }
}
