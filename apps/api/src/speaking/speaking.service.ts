import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  cefrFromScaled,
  pickSpeakingSpec,
  pickSpeakingTask,
  practiceScaled,
  speakingFluency,
  TOEIC_SCENES,
  type SpeakingTaskType,
} from "@writing-helper/practice";
import { AiService, PRACTICE_DEADLINE_MS, PRACTICE_TIMEOUT_MS } from "../ai/ai.service";
import { DEFAULT_PAGE_SIZE, toCursorPage } from "../common/cursor-page";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateSpeakingAttemptDto,
  SubmitSpeakingAttemptDto,
  UpdateSpeakingAttemptDto,
} from "./dto/speaking.dto";
import { locateMarks } from "./locate-marks";
import { VocabService, type VocabSuggestItem } from "../practice/vocab.service";
import { tagReviewVocabulary } from "../practice/vocab-tag";
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
import {
  SPEAKING_SAMPLE_SCHEMA,
  buildSpeakingSamplePrompt,
  type SpeakingSampleResult,
} from "./speaking-sample-prompt";

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

const REVIEW_LEVEL = "TOEIC";

const SPEAKING_TASK_TYPES: SpeakingTaskType[] = [
  "read-aloud",
  "describe-picture",
  "respond-question",
  "respond-with-info",
  "express-opinion",
];

type CueCardJson = {
  type: SpeakingTaskType;
  key: string;
  prepSeconds: number;
  speakSeconds: number;
  maxRaw: number;
  passage?: string;
  imageUrl?: string;
  question?: string;
  info?: string;
  infoSeconds?: number;
  topic?: string;
  bullets?: string[];
};

function isGraded(attempt: {
  submittedAt: Date | null;
  rawRating: number | null;
  scale: string;
  band: number | null;
}): boolean {
  if (!attempt.submittedAt) return false;
  return attempt.rawRating != null || (attempt.scale === "ielts" && attempt.band != null);
}

function clampRawRating(raw: unknown, maxRaw: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(maxRaw, Math.max(0, Math.round(n)));
}

function recentSpeakingKey(value: unknown): string | null {
  const card = value as { key?: unknown; topic?: unknown } | null;
  if (typeof card?.key === "string" && card.key.length > 0) return card.key;
  if (typeof card?.topic === "string" && card.topic.length > 0) return card.topic;
  return null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asCueCard(value: unknown): CueCardJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Speaking attempt has an invalid cue card");
  }
  const card = value as Record<string, unknown>;
  const type = card.type;
  if (
    typeof type !== "string" ||
    !SPEAKING_TASK_TYPES.includes(type as SpeakingTaskType) ||
    typeof card.speakSeconds !== "number"
  ) {
    throw new BadRequestException("Speaking attempt has an invalid cue card");
  }
  const typed = type as SpeakingTaskType;
  const enough =
    (typed === "read-aloud" && hasText(card.passage)) ||
    (typed === "describe-picture" && hasText(card.imageUrl)) ||
    (typed === "respond-question" && hasText(card.question)) ||
    (typed === "respond-with-info" && hasText(card.info) && hasText(card.question)) ||
    (typed === "express-opinion" && hasText(card.question));
  if (!enough) {
    throw new BadRequestException("Speaking attempt has an invalid cue card");
  }
  return card as CueCardJson;
}

function speakSecondsFor(
  type: SpeakingTaskType,
  specSpeakSeconds: number,
  dtoSeconds?: 15 | 30,
): number {
  if (
    dtoSeconds != null &&
    (type === "respond-question" || type === "respond-with-info")
  ) {
    return dtoSeconds;
  }
  return specSpeakSeconds;
}

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function buildCueCard(
  type: SpeakingTaskType,
  seed: ReturnType<typeof pickSpeakingTask>,
  spec: ReturnType<typeof pickSpeakingSpec>,
  speakSeconds: number,
  generated: GeneratedCueCard,
): CueCardJson {
  const card: CueCardJson = {
    type,
    key: seed.key,
    prepSeconds: spec.prepSeconds,
    speakSeconds,
    maxRaw: spec.maxRaw,
  };

  if (type === "read-aloud") {
    card.passage = trimmed(generated.passage) ?? seed.passage;
  } else if (type === "describe-picture") {
    const scene = TOEIC_SCENES.find((item) => item.id === seed.sceneId) ?? TOEIC_SCENES[0];
    if (!scene) throw new Error("No TOEIC scenes defined");
    card.imageUrl = scene.imageUrl;
  } else if (type === "respond-question") {
    card.question = trimmed(generated.question) ?? seed.question;
  } else if (type === "respond-with-info") {
    card.info = trimmed(generated.info) ?? seed.info;
    card.question = trimmed(generated.question) ?? seed.question;
    card.infoSeconds = spec.infoSeconds ?? 45;
  } else {
    card.question = trimmed(generated.question) ?? seed.question;
  }

  return card;
}

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly vocab: VocabService,
  ) {}

  async create(userId: string, dto: CreateSpeakingAttemptDto) {
    const recent = await this.prisma.speakingAttempt.findMany({
      where: { userId, parentAttemptId: null },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { cueCard: true },
    });
    const recentKeys = recent
      .map((row) => recentSpeakingKey(row.cueCard))
      .filter((key): key is string => Boolean(key));

    const type = dto.taskType;
    const seed = pickSpeakingTask(type, recentKeys);
    const spec = pickSpeakingSpec(type);
    const speakSeconds = speakSecondsFor(type, spec.speakSeconds, dto.speakSeconds);
    const generateSpec = { ...spec, speakSeconds };

    let reviewCandidates: VocabSuggestItem[] = [];
    try {
      reviewCandidates = await this.vocab.reviewCandidates(userId);
    } catch (error: unknown) {
      this.logger.warn(
        `event=vocab_review_candidates_failed userId=${userId} ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    const generated = await this.ai.complete<GeneratedCueCard>({
      prompt: buildSpeakingGeneratePrompt(seed, generateSpec, reviewCandidates),
      schema: SPEAKING_GENERATE_SCHEMA,
      maxTokens: 1500,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
      usage: { userId, endpoint: "speaking.generate" },
    });

    const cueCard = buildCueCard(type, seed, spec, speakSeconds, generated);
    const structure = generated.structure.map((beat) => beat.trim()).slice(0, 5);
    const vocabulary = tagReviewVocabulary(generated.vocabulary, reviewCandidates);

    const attempt = await this.prisma.speakingAttempt.create({
      data: {
        userId,
        level: REVIEW_LEVEL,
        scale: "toeic",
        taskType: type,
        cueCard: cueCard as Prisma.InputJsonValue,
        structure: structure as Prisma.InputJsonValue,
        vocabulary: vocabulary as Prisma.InputJsonValue,
      },
    });

    try {
      await this.vocab.recordSuggested(userId, REVIEW_LEVEL, generated.vocabulary);
    } catch (error: unknown) {
      this.logger.warn(
        `event=vocab_record_suggested_failed userId=${userId} ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    return attempt;
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

  async remove(userId: string, id: string) {
    const existing = await this.prisma.speakingAttempt.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Speaking attempt not found");
    await this.prisma.speakingAttempt.delete({ where: { id } });
  }

  async revise(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.speakingAttempt.findFirst({ where: { id, userId } });
      if (!parent) throw new NotFoundException("Speaking attempt not found");
      if (!isGraded(parent)) {
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
          scale: parent.scale,
          taskType: parent.taskType,
          cueCard: parent.cueCard as Prisma.InputJsonValue,
          structure: parent.structure as Prisma.InputJsonValue,
          vocabulary: parent.vocabulary as Prisma.InputJsonValue,
          hintsOpened: parent.hintsOpened,
          parentAttemptId: id,
          revisionRound: parent.revisionRound + 1,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateSpeakingAttemptDto) {
    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Submitted speaking cannot be edited");
    }

    return this.prisma.speakingAttempt.update({
      where: { id },
      data: {
        ...(dto.hintsOpened ? { hintsOpened: true } : {}),
      },
    });
  }

  async generateSamples(userId: string, id: string) {
    const attempt = await this.findOne(userId, id);
    if (!isGraded(attempt)) {
      throw new ConflictException("Speaking attempt has not been graded yet");
    }
    if (attempt.sampleTalks != null) {
      return attempt;
    }

    const cueCard = asCueCard(attempt.cueCard);
    const generated = await this.ai.complete<SpeakingSampleResult>({
      prompt: buildSpeakingSamplePrompt(cueCard),
      schema: SPEAKING_SAMPLE_SCHEMA,
      maxTokens: 2500,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
      usage: { userId, endpoint: "speaking.samples" },
    });
    const sampleTalks = generated.talks.map((talk) => talk.text);

    const updated = await this.prisma.speakingAttempt.update({
      where: { id },
      data: { sampleTalks: sampleTalks as unknown as Prisma.InputJsonValue },
    });
    return { ...attempt, ...updated };
  }

  async submit(userId: string, id: string, dto: SubmitSpeakingAttemptDto) {
    if (!dto.audioBase64?.trim()) {
      throw new BadRequestException("Audio is required");
    }
    if (dto.durationMs < 3_000) {
      throw new BadRequestException("Recording must be at least 3 seconds");
    }

    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Speaking attempt already submitted");
    }

    const cueCard = asCueCard(attempt.cueCard);
    const spec = pickSpeakingSpec(cueCard.type);
    const maxRaw = cueCard.maxRaw ?? spec.maxRaw;

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

    try {
      const graded = await this.ai.complete<SpeakingGradeResult>({
        prompt: buildSpeakingGradePrompt({
          type: cueCard.type,
          speakSeconds: cueCard.speakSeconds,
          maxRaw,
          passage: cueCard.passage,
          question: cueCard.question,
          info: cueCard.info,
          imageUrl: cueCard.imageUrl,
          topic: cueCard.topic,
          bullets: cueCard.bullets,
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
      const rawRating = clampRawRating(graded.rawRating, maxRaw);
      const estimatedScaled = practiceScaled(rawRating, maxRaw);
      const cefrEstimate = cefrFromScaled(estimatedScaled, "speaking");

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
          band: null,
          rawRating,
          estimatedScaled,
          cefrEstimate,
          scale: "toeic",
          scores: Prisma.DbNull,
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
