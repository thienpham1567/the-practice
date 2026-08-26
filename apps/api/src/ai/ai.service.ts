import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
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
  constructor(private readonly config: ConfigService) {}

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
    const model = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;

    let lastError: OpenRouterAttemptError | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) break;

      try {
        return await this.attemptOnce<T>({
          apiKey,
          model,
          options,
          timeoutMs: Math.min(timeoutMs, remaining),
        });
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

  private async attemptOnce<T>(args: {
    apiKey: string;
    model: string;
    options: CompleteOptions;
    timeoutMs: number;
  }): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages: [{ role: "user", content: args.options.prompt }],
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
          parseRetryAfterMs(response.headers.get("retry-after")),
        );
      }

      const body = (await response.json()) as OpenRouterResponse;
      const content = body.choices?.[0]?.message?.content ?? "";

      if (args.options.schema) return parseJsonContent<T>(content);
      return content as T;
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

  async rewrite(input: RewriteDto): Promise<{ suggestions: string[] }> {
    const prompt = buildRewritePrompt(input.text, input.issueType, input.context);
    const content = await this.complete<string>({
      prompt,
      maxTokens: 200,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      deadlineMs: DEFAULT_DEADLINE_MS,
    });
    const suggestions = parseSuggestions(content);

    if (suggestions.length === 0) {
      throw new ServiceUnavailableException("AI rewrite returned no suggestions");
    }

    return { suggestions };
  }
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
