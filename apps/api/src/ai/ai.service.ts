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

  async rewrite(input: RewriteDto): Promise<{ suggestions: string[] }> {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) throw new ServiceUnavailableException("AI rewrite is not configured");

    const model = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;
    const prompt = buildRewritePrompt(input.text, input.issueType, input.context);

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
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new ServiceUnavailableException(await describeError(response));

      const body = (await response.json()) as OpenRouterResponse;
      const content = body.choices?.[0]?.message?.content ?? "";
      const suggestions = parseSuggestions(content);

      if (suggestions.length === 0) {
        throw new ServiceUnavailableException("AI rewrite returned no suggestions");
      }

      return { suggestions };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GatewayTimeoutException("AI rewrite timed out");
      }
      throw new ServiceUnavailableException("AI rewrite failed");
    } finally {
      clearTimeout(timer);
    }
  }
}

async function describeError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) return `AI rewrite failed: ${body.error.message}`;
  } catch {
    // Body không phải JSON — dùng thông báo mặc định bên dưới.
  }

  return `AI rewrite failed (${response.status})`;
}
