import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { buildRewritePrompt, parseSuggestions } from "./prompts";
import type { RewriteDto } from "./dto/rewrite.dto";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 15_000;
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

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
   * gọi, timeout, và ánh xạ lỗi — không biết rewrite hay chấm bài là gì.
   */
  async complete<T = string>(options: CompleteOptions): Promise<T> {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) throw new ServiceUnavailableException("AI is not configured");

    const model = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: options.prompt }],
          max_tokens: options.maxTokens,
          ...(options.schema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: options.schema.name,
                    strict: true,
                    schema: options.schema.schema,
                  },
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new ServiceUnavailableException(await describeError(response));

      const body = (await response.json()) as OpenRouterResponse;
      const content = body.choices?.[0]?.message?.content ?? "";

      if (options.schema) return parseJsonContent<T>(content);
      return content as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GatewayTimeoutException("AI request timed out");
      }
      throw new ServiceUnavailableException("AI request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  async rewrite(input: RewriteDto): Promise<{ suggestions: string[] }> {
    const prompt = buildRewritePrompt(input.text, input.issueType, input.context);
    const content = await this.complete<string>({ prompt, maxTokens: 200 });
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
