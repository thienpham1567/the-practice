import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  overallBand,
  pickSpeakingTask,
  speakingFluency,
  type Level,
} from "@writing-helper/practice";
import { AiService, PRACTICE_DEADLINE_MS, PRACTICE_TIMEOUT_MS } from "../ai/ai.service";
import { DEFAULT_PAGE_SIZE, toCursorPage } from "../common/cursor-page";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSpeakingAttemptDto, SubmitSpeakingAttemptDto } from "./dto/speaking.dto";
import { locateMarks } from "./locate-marks";
import {
  SPEAKING_GENERATE_SCHEMA,
  buildSpeakingGeneratePrompt,
  type GeneratedCueCard,
} from "./speaking-generate-prompt";
import {
  SPEAKING_GRADE_SCHEMA,
  buildSpeakingGradePrompt,
  type SpeakingGradeResult,
} from "./speaking-grade-prompt";

const LIST_FIELDS = {
  id: true,
  level: true,
  band: true,
  durationMs: true,
  startedAt: true,
  submittedAt: true,
} satisfies Prisma.SpeakingAttemptSelect;

const LIST_REVISION_FIELDS = {
  band: true,
  revisionRound: true,
} satisfies Prisma.SpeakingAttemptSelect;

const LIST_CHAIN_SELECT = {
  ...LIST_FIELDS,
  revisions: {
    select: {
      ...LIST_REVISION_FIELDS,
      revisions: { select: LIST_REVISION_FIELDS },
    },
  },
} satisfies Prisma.SpeakingAttemptSelect;

type ListRevisionNode = {
  band: number | null;
  revisionRound: number;
  revisions?: ListRevisionNode[];
};

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

type CueCardJson = { topic: string; bullets: string[] };

function asCueCard(value: unknown): CueCardJson {
  const card = value as CueCardJson | null;
  if (!card || typeof card.topic !== "string" || !Array.isArray(card.bullets)) {
    throw new BadRequestException("Speaking attempt has an invalid cue card");
  }
  return card;
}

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, dto: CreateSpeakingAttemptDto) {
    const recent = await this.prisma.speakingAttempt.findMany({
      where: { userId, level: dto.level, parentAttemptId: null },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { cueCard: true },
    });
    const recentTopics = recent
      .map((row) => {
        const card = row.cueCard as CueCardJson | null;
        return typeof card?.topic === "string" ? card.topic : null;
      })
      .filter((topic): topic is string => Boolean(topic));

    const seed = pickSpeakingTask(dto.level as Level, recentTopics);
    const generated = await this.ai.complete<GeneratedCueCard>({
      prompt: buildSpeakingGeneratePrompt(seed, dto.level as Level),
      schema: SPEAKING_GENERATE_SCHEMA,
      maxTokens: 800,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
      usage: { userId, endpoint: "speaking.generate" },
    });

    const cueCard = {
      topic: generated.topic.trim(),
      bullets: generated.bullets.map((b) => b.trim()).slice(0, 3),
    };

    return this.prisma.speakingAttempt.create({
      data: {
        userId,
        level: dto.level,
        cueCard: cueCard as Prisma.InputJsonValue,
      },
    });
  }

  async list(userId: string, opts: { cursor?: string; limit?: number } = {}) {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await this.prisma.speakingAttempt.findMany({
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
    const attempt = await this.prisma.speakingAttempt.findFirst({
      where: { id, userId },
      include: {
        parent: { select: { band: true } },
        revisions: { select: { id: true, submittedAt: true }, take: 1 },
      },
    });
    if (!attempt) throw new NotFoundException("Speaking attempt not found");
    const { parent, revisions, ...rest } = attempt;
    const child = revisions[0] ?? null;
    return {
      ...rest,
      parentBand: parent?.band ?? null,
      hasRevision: child != null,
      pendingRevisionId: child != null && child.submittedAt == null ? child.id : null,
    };
  }

  async revise(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.speakingAttempt.findFirst({ where: { id, userId } });
      if (!parent) throw new NotFoundException("Speaking attempt not found");
      if (!parent.submittedAt || parent.band == null) {
        throw new ConflictException("Speaking attempt has not been graded yet");
      }
      if (parent.revisionRound >= 2) {
        throw new ConflictException("Maximum revision rounds reached");
      }
      const existing = await tx.speakingAttempt.findFirst({
        where: { parentAttemptId: id },
      });
      if (existing) {
        throw new ConflictException("Speaking attempt already has a revision");
      }

      return tx.speakingAttempt.create({
        data: {
          userId,
          level: parent.level,
          cueCard: parent.cueCard as Prisma.InputJsonValue,
          parentAttemptId: id,
          revisionRound: parent.revisionRound + 1,
        },
      });
    });
  }

  async submit(userId: string, id: string, dto: SubmitSpeakingAttemptDto) {
    if (!dto.audioBase64?.trim()) {
      throw new BadRequestException("Audio is required");
    }
    if (dto.durationMs < 10_000) {
      throw new BadRequestException("Recording must be at least 10 seconds");
    }

    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Speaking attempt already submitted");
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - GRADING_LOCK_STALE_MS);
    const claimed = await this.prisma.speakingAttempt.updateMany({
      where: {
        id,
        userId,
        submittedAt: null,
        OR: [{ gradingStartedAt: null }, { gradingStartedAt: { lte: staleBefore } }],
      },
      data: { gradingStartedAt: now },
    });

    if (claimed.count === 0) {
      throw new ConflictException("Speaking attempt is already being graded");
    }

    const cueCard = asCueCard(attempt.cueCard);

    try {
      const graded = await this.ai.complete<SpeakingGradeResult>({
        prompt: buildSpeakingGradePrompt({
          topic: cueCard.topic,
          bullets: cueCard.bullets,
          level: attempt.level,
        }),
        schema: SPEAKING_GRADE_SCHEMA,
        maxTokens: 4000,
        timeoutMs: PRACTICE_TIMEOUT_MS,
        deadlineMs: PRACTICE_DEADLINE_MS,
        audio: { base64: dto.audioBase64, format: dto.format },
        usage: { userId, endpoint: "speaking.grade" },
      });

      const transcript = typeof graded.transcript === "string" ? graded.transcript : "";
      const fluency = speakingFluency(transcript, dto.durationMs);
      const band = overallBand([
        graded.scores.fluencyCoherence,
        graded.scores.lexicalResource,
        graded.scores.grammaticalRange,
        graded.scores.pronunciation,
      ]);

      let marks: Prisma.InputJsonValue | null = null;
      try {
        if (!Array.isArray(graded.marks)) {
          throw new Error("marks is not an array");
        }
        marks = locateMarks(graded.marks, transcript) as unknown as Prisma.InputJsonValue;
      } catch (error: unknown) {
        this.logger.warn(
          `event=speaking_marks_dropped attemptId=${id} ${error instanceof Error ? error.message : "unknown"}`,
        );
        marks = null;
      }

      return this.prisma.speakingAttempt.update({
        where: { id },
        data: {
          durationMs: dto.durationMs,
          transcript,
          marks: marks === null ? Prisma.DbNull : marks,
          fluency: fluency as unknown as Prisma.InputJsonValue,
          submittedAt: new Date(),
          gradingStartedAt: null,
          band,
          scores: graded.scores as unknown as Prisma.InputJsonValue,
          feedback: graded.feedback as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await this.prisma.speakingAttempt.updateMany({
        where: { id, userId, submittedAt: null },
        data: { gradingStartedAt: null },
      });
      throw error;
    }
  }
}
