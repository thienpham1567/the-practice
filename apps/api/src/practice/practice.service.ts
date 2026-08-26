import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateAttemptDto,
  SubmitAttemptDto,
  UpdateAttemptDto,
} from "./dto/practice.dto";
import { GENERATE_TASK_SCHEMA, buildGeneratePrompt, type GeneratedTask } from "./generate-prompt";
import { GRADE_TASK_SCHEMA, buildGradePrompt, type GradeResult } from "./grade-prompt";

const LIST_FIELDS = {
  id: true,
  level: true,
  taskType: true,
  prompt: true,
  band: true,
  wordCount: true,
  hintsOpened: true,
  startedAt: true,
  submittedAt: true,
  elapsedSeconds: true,
} satisfies Prisma.PracticeAttemptSelect;

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, dto: CreateAttemptDto) {
    const chosen = await this.chooseTask(userId, dto.level, dto.taskType);
    const generated = await this.ai.complete<GeneratedTask>({
      prompt: buildGeneratePrompt(chosen, dto.level),
      schema: GENERATE_TASK_SCHEMA,
      maxTokens: 1000,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      deadlineMs: PRACTICE_DEADLINE_MS,
    });

    return this.prisma.practiceAttempt.create({
      data: {
        userId,
        level: dto.level,
        taskType: chosen.type,
        prompt: `${generated.prompt.trim()}\n\n${chosen.instruction}`,
        ideas: generated.ideas as Prisma.InputJsonValue,
        vocabulary: generated.vocabulary as Prisma.InputJsonValue,
      },
    });
  }

  list(userId: string) {
    return this.prisma.practiceAttempt.findMany({
      where: { userId },
      select: LIST_FIELDS,
      orderBy: { startedAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    const attempt = await this.prisma.practiceAttempt.findFirst({ where: { id, userId } });
    if (!attempt) throw new NotFoundException("Practice attempt not found");
    return attempt;
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

    const task = this.taskByType(attempt.taskType as TaskType);
    const plainText = dto.plainText ?? attempt.plainText;
    const wordCount = dto.wordCount ?? attempt.wordCount;

    const graded = await this.ai.complete<GradeResult>({
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
    });

    const submittedAt = new Date();
    const elapsedSeconds = Math.max(
      0,
      Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
    );

    return this.prisma.practiceAttempt.update({
      where: { id },
      data: {
        ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
        plainText,
        wordCount,
        submittedAt,
        elapsedSeconds,
        band: overallBand(graded.scores),
        scores: graded.scores as unknown as Prisma.InputJsonValue,
        feedback: graded.feedback as unknown as Prisma.InputJsonValue,
        styleSnapshot: dto.styleSnapshot as Prisma.InputJsonValue,
      },
    });
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
