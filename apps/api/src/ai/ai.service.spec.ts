import { GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("AiService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isEnabled", () => {
    it("bật khi có OPENROUTER_API_KEY", () => {
      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      expect(service.isEnabled()).toBe(true);
    });

    it("tắt khi thiếu OPENROUTER_API_KEY", () => {
      const service = new AiService(fakeConfig({}));
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe("rewrite", () => {
    it("từ chối khi chưa cấu hình key, không gọi OpenRouter", async () => {
      const fetchSpy = jest.spyOn(global, "fetch");
      const service = new AiService(fakeConfig({}));

      await expect(
        service.rewrite({ text: "It was done.", issueType: "passive" }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("gửi đúng model cấu hình và trả về gợi ý đã phân tích", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "One.\nTwo." } }] }));

      const service = new AiService(
        fakeConfig({ OPENROUTER_API_KEY: "key", AI_MODEL: "some/model" }),
      );

      const result = await service.rewrite({ text: "It was done.", issueType: "passive" });

      expect(result.suggestions).toEqual(["One.", "Two."]);
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("some/model");
    });

    it("dùng model mặc định khi không cấu hình AI_MODEL", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "One." } }] }));

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      await service.rewrite({ text: "x", issueType: "adverb" });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("anthropic/claude-haiku-4.5");
    });

    it("báo lỗi rõ ràng khi OpenRouter trả lỗi", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          jsonResponse({ error: { message: "insufficient credits" } }, false, 402),
        );

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));

      await expect(service.rewrite({ text: "x", issueType: "passive" })).rejects.toMatchObject({
        message: expect.stringContaining("insufficient credits"),
      });
    });

    it("báo timeout riêng biệt khi request bị abort", async () => {
      jest.useFakeTimers();
      jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      // Gắn assertion ngay lập tức: nếu chờ đến sau `advanceTimersByTimeAsync`
      // mới gắn, promise đã reject mà chưa có handler và Jest báo lỗi ngoài ý
      // muốn (unhandled rejection) trước khi kịp assert.
      const assertion = expect(
        service.rewrite({ text: "x", issueType: "passive" }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);

      await jest.advanceTimersByTimeAsync(15_000);
      await assertion;

      jest.useRealTimers();
    });

    it("báo lỗi khi mô hình trả về nội dung rỗng", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] }));

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));

      await expect(service.rewrite({ text: "x", issueType: "passive" })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe("complete timeouts", () => {
    it("rewrite giữ timeout 15s mỗi lượt", async () => {
      jest.useFakeTimers();
      jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      const assertion = expect(
        service.rewrite({ text: "x", issueType: "passive" }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);

      await jest.advanceTimersByTimeAsync(14_999);
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      await jest.advanceTimersByTimeAsync(1);
      await assertion;
      jest.useRealTimers();
    });

    it("complete tôn trọng timeoutMs tùy chỉnh trên mỗi lượt", async () => {
      jest.useFakeTimers();
      jest.spyOn(global, "fetch").mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal;
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      });

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      const assertion = expect(
        service.complete({
          prompt: "grade",
          maxTokens: 100,
          timeoutMs: 30_000,
          deadlineMs: 30_000,
        }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);

      await jest.advanceTimersByTimeAsync(29_999);
      await jest.advanceTimersByTimeAsync(1);
      await assertion;
      jest.useRealTimers();
    });
  });

  describe("complete", () => {
    it("gửi prompt, maxTokens và không kèm response_format khi không có schema", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hello" } }] }));

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      const result = await service.complete<string>({ prompt: "Say hi", maxTokens: 80 });

      expect(result).toBe("hello");
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as {
        messages: { content: string }[];
        max_tokens: number;
        response_format?: unknown;
      };
      expect(body.messages[0]?.content).toBe("Say hi");
      expect(body.max_tokens).toBe(80);
      expect(body.response_format).toBeUndefined();
    });

    it("gắn json_schema vào request và parse JSON trả về đúng kiểu", async () => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: '{"prompt":"Write about tea","ideas":["aroma"]}' } }],
        }),
      );

      const schema = {
        name: "practice_prompt",
        schema: {
          type: "object",
          properties: { prompt: { type: "string" }, ideas: { type: "array" } },
        },
      };

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      const result = await service.complete<{ prompt: string; ideas: string[] }>({
        prompt: "Generate a task",
        maxTokens: 400,
        schema,
      });

      expect(result).toEqual({ prompt: "Write about tea", ideas: ["aroma"] });
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as {
        response_format: { type: string; json_schema: { name: string; schema: unknown } };
      };
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.name).toBe("practice_prompt");
      expect(body.response_format.json_schema.schema).toEqual(schema.schema);
    });

    it("gỡ markdown fence nếu mô hình không trả JSON thuần", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: '```json\n{"ok":true}\n```' } }],
        }),
      );

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));
      const result = await service.complete<{ ok: boolean }>({
        prompt: "x",
        maxTokens: 20,
        schema: { name: "ok", schema: { type: "object" } },
      });

      expect(result).toEqual({ ok: true });
    });
  });
});
