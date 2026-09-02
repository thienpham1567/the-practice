import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { buildRewritePrompt, parseSuggestions } from "./prompts";
import type { RewriteDto } from "./dto/rewrite.dto";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Timeout mỗi lượt mặc định — rewrite và caller không chỉ định. */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Deadline tổng mặc định bằng một lượt — không retry vượt quá trừ khi caller nới. */
export const DEFAULT_DEADLINE_MS = 15_000;
/** Chấm bài / sinh đề: mỗi lượt dài hơn vì structured output nặng. */
export const PRACTICE_TIMEOUT_MS = 30_000;
/** Chấm bài / sinh đề: tổng thời gian cho phép retry thoáng qua. */
export const PRACTICE_DEADLINE_MS = 90_000;
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = [500, 1_500] as const;
const DEFAULT_DAILY_QUOTA = 100;
const USAGE_WINDOW_DAYS = 30;

export type AiEndpoint =
  | "rewrite"
  | "practice.generate"
  | "practice.grade"
  | "practice.marks"
  | "speaking.generate"
  | "speaking.grade";

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface CompleteOptions {
  prompt: string;
  maxTokens: number;
  schema?: JsonSchemaSpec;
  /** Timeout AbortController cho một lượt fetch. */
  timeoutMs?: number;
  /** Tổng thời gian cho phép kể cả retry. */
  deadlineMs?: number;
  /** Khi có: ghi AiUsage sau lần gọi thành công. */
  usage?: { userId: string; endpoint: AiEndpoint };
  /**
   * Optional audio input for multimodal OpenRouter calls.
   * When set, attemptOnce sends content as text + input_audio parts
   * and resolveModel prefers AI_MODEL_AUDIO.
   */
  audio?: { base64: string; format: "wav" | "mp3" };
  /** Explicit model override; wins over AI_MODEL / AI_MODEL_AUDIO. */
  model?: string;
}

class OpenRouterAttemptError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
    readonly causeName?: string,
  ) {
    super(message);
    this.name = "OpenRouterAttemptError";
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Không dựng abstraction `LLMProvider` ở đây: OpenRouter là provider duy
   * nhất, và một adapter chỉ là seam giả định. Nếu sau này có provider thứ
   * hai, tách seam lúc đó rẻ hơn vì mọi thứ còn nằm gọn một chỗ.
   */
  isEnabled(): boolean {
    return Boolean(this.config.get<string>("OPENROUTER_API_KEY"));
  }

  /**
   * Cổng OpenRouter duy nhất. Caller dựng prompt và schema; service này chỉ
   * gọi, timeout/retry, và ánh xạ lỗi — không biết rewrite hay chấm bài là gì.
   */
  async complete<T = string>(options: CompleteOptions): Promise<T> {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) throw new ServiceUnavailableException("AI is not configured");

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
    const deadlineAt = Date.now() + deadlineMs;
    const model = this.resolveModel(options);

    let lastError: OpenRouterAttemptError | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) break;

      try {
        const result = await this.attemptOnce<T>({
          apiKey,
          model,
          options,
          timeoutMs: Math.min(timeoutMs, remaining),
        });
        if (options.usage) {
          try {
            await this.recordUsage(options.usage, model, result.usage);
          } catch (error: unknown) {
            this.logger.warn(
              `event=ai_usage_write_failed endpoint=${options.usage.endpoint} ${error instanceof Error ? error.message : "unknown"}`,
            );
          }
        }
        return result.value;
      } catch (error) {
        const attemptError = toAttemptError(error);
        lastError = attemptError;

        if (!isRetryable(attemptError) || attempt === MAX_ATTEMPTS - 1) {
          throw toHttpException(attemptError);
        }

        const waitMs = delayBeforeRetry(attemptError, attempt);
        if (Date.now() + waitMs >= deadlineAt) {
          throw toHttpException(attemptError);
        }
        await sleep(waitMs);
      }
    }

    throw toHttpException(
      lastError ?? new OpenRouterAttemptError("AI request failed"),
    );
  }

  async assertWithinDailyQuota(userId: string): Promise<void> {
    const limit = this.dailyQuotaLimit();
    if (limit <= 0) return;

    const since = startOfUtcDay(new Date());
    const used = await this.prisma.aiUsage.count({
      where: { userId, createdAt: { gte: since } },
    });

    if (used >= limit) {
      const resetsAt = new Date(since.getTime() + 24 * 60 * 60 * 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily AI quota exceeded. Resets at ${resetsAt.toISOString()} (UTC).`,
          resetsAt: resetsAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async usageSummary(userId: string): Promise<{
    windowDays: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: string;
    calls: number;
  }> {
    const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.aiUsage.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { promptTokens: true, completionTokens: true, costUsd: true },
    });

    let promptTokens = 0;
    let completionTokens = 0;
    let cost = new Prisma.Decimal(0);
    for (const row of rows) {
      promptTokens += row.promptTokens;
      completionTokens += row.completionTokens;
      cost = cost.add(row.costUsd);
    }

    return {
      windowDays: USAGE_WINDOW_DAYS,
      promptTokens,
      completionTokens,
      costUsd: cost.toFixed(6),
      calls: rows.length,
    };
  }

  private resolveModel(options: CompleteOptions): string {
    if (options.model) return options.model;

    const defaultModel = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;
    const endpoint = options.usage?.endpoint;
    const useAudioModel =
      Boolean(options.audio) ||
      endpoint === "speaking.generate" ||
      endpoint === "speaking.grade";

    if (useAudioModel) {
      return this.config.get<string>("AI_MODEL_AUDIO") ?? defaultModel;
    }
    return defaultModel;
  }

  private dailyQuotaLimit(): number {
    // Ưu tiên process.env để e2e có thể hạ ngưỡng mà không cần bootstrap lại app.
    const raw = process.env.AI_DAILY_QUOTA ?? this.config.get<string>("AI_DAILY_QUOTA");
    if (raw === undefined || raw === "") return DEFAULT_DAILY_QUOTA;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : DEFAULT_DAILY_QUOTA;
  }

  private async recordUsage(
    usage: { userId: string; endpoint: AiEndpoint },
    model: string,
    tokens: { promptTokens: number; completionTokens: number; costUsd: number },
  ): Promise<void> {
    await this.prisma.aiUsage.create({
      data: {
        userId: usage.userId,
        endpoint: usage.endpoint,
        model,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
        costUsd: new Prisma.Decimal(tokens.costUsd.toFixed(6)),
      },
    });
  }

  private async attemptOnce<T>(args: {
    apiKey: string;
    model: string;
    options: CompleteOptions;
    timeoutMs: number;
  }): Promise<{
    value: T;
    usage: { promptTokens: number; completionTokens: number; costUsd: number };
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs);

    try {
      const messageContent = args.options.audio
        ? [
            { type: "text" as const, text: args.options.prompt },
            {
              type: "input_audio" as const,
              input_audio: {
                data: args.options.audio.base64,
                format: args.options.audio.format,
              },
            },
          ]
        : args.options.prompt;

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages: [{ role: "user", content: messageContent }],
          max_tokens: args.options.maxTokens,
          ...(args.options.schema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: args.options.schema.name,
                    strict: true,
                    schema: args.options.schema.schema,
                  },
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OpenRouterAttemptError(
          await describeError(response),
          response.status,
          parseRetryAfterMs(response.headers?.get?.("retry-after") ?? null),
        );
      }

      const body = (await response.json()) as OpenRouterResponse;
      const content = body.choices?.[0]?.message?.content ?? "";
      const usage = {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        costUsd: typeof body.usage?.cost === "number" ? body.usage.cost : 0,
      };

      if (args.options.schema) {
        return { value: parseJsonContent<T>(content), usage };
      }
      return { value: content as T, usage };
    } catch (error) {
      if (error instanceof OpenRouterAttemptError) throw error;
      if (error instanceof ServiceUnavailableException) {
        throw new OpenRouterAttemptError(error.message);
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenRouterAttemptError("AI request timed out", undefined, undefined, "AbortError");
      }
      throw new OpenRouterAttemptError("AI request failed", undefined, undefined, "NetworkError");
    } finally {
      clearTimeout(timer);
    }
  }

  async rewrite(userId: string, input: RewriteDto): Promise<{ suggestions: string[] }> {
    const prompt = buildRewritePrompt(input.text, input.issueType, input.context);
    const content = await this.complete<string>({
      prompt,
      maxTokens: 200,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      deadlineMs: DEFAULT_DEADLINE_MS,
      usage: { userId, endpoint: "rewrite" },
    });
    const suggestions = parseSuggestions(content);

    if (suggestions.length === 0) {
      throw new ServiceUnavailableException("AI rewrite returned no suggestions");
    }

    return { suggestions };
  }
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    throw new ServiceUnavailableException("AI returned invalid JSON");
  }
}

async function describeError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) return `AI request failed: ${body.error.message}`;
  } catch {
    // Body không phải JSON — dùng thông báo mặc định bên dưới.
  }

  return `AI request failed (${response.status})`;
}

function toAttemptError(error: unknown): OpenRouterAttemptError {
  if (error instanceof OpenRouterAttemptError) return error;
  if (error instanceof Error) {
    return new OpenRouterAttemptError(error.message, undefined, undefined, error.name);
  }
  return new OpenRouterAttemptError("AI request failed");
}

function isRetryable(error: OpenRouterAttemptError): boolean {
  if (error.causeName === "AbortError" || error.causeName === "NetworkError") return true;
  if (error.status === undefined) return false;
  return [429, 500, 502, 503, 504].includes(error.status);
}

function delayBeforeRetry(error: OpenRouterAttemptError, failedAttempt: number): number {
  if (error.retryAfterMs !== undefined) return error.retryAfterMs;
  const base = BACKOFF_BASE_MS[Math.min(failedAttempt, BACKOFF_BASE_MS.length - 1)]!;
  return Math.random() * base;
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1_000;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return undefined;
}

function toHttpException(error: OpenRouterAttemptError): never {
  if (error.causeName === "AbortError") {
    throw new GatewayTimeoutException("AI request timed out");
  }
  throw new ServiceUnavailableException(error.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
