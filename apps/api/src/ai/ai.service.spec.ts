import { GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function fakePrisma(overrides: {
  create?: jest.Mock;
  count?: jest.Mock;
  findMany?: jest.Mock;
} = {}) {
  return {
    aiUsage: {
      create: overrides.create ?? jest.fn().mockResolvedValue({}),
      count: overrides.count ?? jest.fn().mockResolvedValue(0),
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

function makeService(
  env: Record<string, string | undefined>,
  prisma: ReturnType<typeof fakePrisma> = fakePrisma(),
) {
  return {
    service: new AiService(fakeConfig(env), prisma as never),
    prisma,
  };
}

function jsonResponse(
  body: unknown,
  ok = true,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    },
    json: () => Promise.resolve(body),
  } as Response;
}

describe("AiService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isEnabled", () => {
    it("bật khi có OPENROUTER_API_KEY", () => {
      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      expect(service.isEnabled()).toBe(true);
    });

    it("tắt khi thiếu OPENROUTER_API_KEY", () => {
      const { service } = makeService({});
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe("rewrite", () => {
    it("từ chối khi chưa cấu hình key, không gọi OpenRouter", async () => {
      const fetchSpy = jest.spyOn(global, "fetch");
      const { service } = makeService({});

      await expect(
        service.rewrite("user-1", { text: "It was done.", issueType: "passive" }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("gửi đúng model cấu hình và trả về gợi ý đã phân tích", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "One.\nTwo." } }] }));

      const { service } = makeService({ OPENROUTER_API_KEY: "key", AI_MODEL: "some/model" });

      const result = await service.rewrite("user-1", { text: "It was done.", issueType: "passive" });

      expect(result.suggestions).toEqual(["One.", "Two."]);
      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("some/model");
    });

    it("dùng model mặc định khi không cấu hình AI_MODEL", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "One." } }] }));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      await service.rewrite("user-1", { text: "x", issueType: "adverb" });

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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });

      await expect(service.rewrite("user-1", { text: "x", issueType: "passive" })).rejects.toMatchObject({
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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      // Gắn assertion ngay lập tức: nếu chờ đến sau `advanceTimersByTimeAsync`
      // mới gắn, promise đã reject mà chưa có handler và Jest báo lỗi ngoài ý
      // muốn (unhandled rejection) trước khi kịp assert.
      const assertion = expect(
        service.rewrite("user-1", { text: "x", issueType: "passive" }),
      ).rejects.toBeInstanceOf(GatewayTimeoutException);

      await jest.advanceTimersByTimeAsync(15_000);
      await assertion;

      jest.useRealTimers();
    });

    it("báo lỗi khi mô hình trả về nội dung rỗng", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] }));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });

      await expect(service.rewrite("user-1", { text: "x", issueType: "passive" })).rejects.toBeInstanceOf(
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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      const assertion = expect(
        service.rewrite("user-1", { text: "x", issueType: "passive" }),
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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
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

  describe("model selection", () => {
    it("dùng AI_MODEL khi không có audio và không phải speaking endpoint", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "anthropic/claude-haiku-4.5",
        AI_MODEL_AUDIO: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        usage: { userId: "user-1", endpoint: "practice.grade" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("anthropic/claude-haiku-4.5");
    });

    it("dùng AI_MODEL_AUDIO khi có audio", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "anthropic/claude-haiku-4.5",
        AI_MODEL_AUDIO: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        audio: { base64: "AAAA", format: "wav" },
        usage: { userId: "user-1", endpoint: "speaking.grade" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("google/gemini-2.5-flash");
    });

    it("dùng AI_MODEL_AUDIO cho speaking.generate dù không có audio", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "anthropic/claude-haiku-4.5",
        AI_MODEL_AUDIO: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        usage: { userId: "user-1", endpoint: "speaking.generate" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("google/gemini-2.5-flash");
    });

    it("fallback về AI_MODEL khi thiếu AI_MODEL_AUDIO mà có audio", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        audio: { base64: "AAAA", format: "wav" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("google/gemini-2.5-flash");
    });

    it("tôn trọng model override tường minh", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "anthropic/claude-haiku-4.5",
        AI_MODEL_AUDIO: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        model: "openai/gpt-audio-mini",
        audio: { base64: "AAAA", format: "wav" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("openai/gpt-audio-mini");
    });

    it("ghi AiUsage với model audio đã chọn cho speaking.grade", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
        }),
      );
      const create = jest.fn().mockResolvedValue({});
      const { service } = makeService(
        {
          OPENROUTER_API_KEY: "key",
          AI_MODEL: "anthropic/claude-haiku-4.5",
          AI_MODEL_AUDIO: "google/gemini-2.5-flash",
        },
        fakePrisma({ create }),
      );

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        audio: { base64: "AAAA", format: "wav" },
        usage: { userId: "user-1", endpoint: "speaking.grade" },
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endpoint: "speaking.grade",
          model: "google/gemini-2.5-flash",
        }),
      });
    });
  });

  describe("complete", () => {
    it("gửi prompt, maxTokens và không kèm response_format khi không có schema", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hello" } }] }));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
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

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      const result = await service.complete<{ ok: boolean }>({
        prompt: "x",
        maxTokens: 20,
        schema: { name: "ok", schema: { type: "object" } },
      });

      expect(result).toEqual({ ok: true });
    });
  });

  describe("complete retries", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("503 → thử lại và thành công ở lượt 2", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(jsonResponse({ error: { message: "busy" } }, false, 503))
        .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "hello" } }] }));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      await expect(
        service.complete({ prompt: "x", maxTokens: 10, deadlineMs: 60_000 }),
      ).resolves.toBe("hello");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("400 → không retry lần nào", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ error: { message: "bad request" } }, false, 400));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      await expect(service.complete({ prompt: "x", maxTokens: 10 })).rejects.toMatchObject({
        message: expect.stringContaining("bad request"),
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("hết 3 lượt 503 → ném lỗi cuối", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ error: { message: "down" } }, false, 503));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      await expect(
        service.complete({ prompt: "x", maxTokens: 10, deadlineMs: 60_000 }),
      ).rejects.toMatchObject({ message: expect.stringContaining("down") });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("tôn trọng Retry-After (giây) thay vì backoff mặc định", async () => {
      jest.useFakeTimers();
      jest.spyOn(Math, "random").mockReturnValue(1);
      let calls = 0;
      jest.spyOn(global, "fetch").mockImplementation(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve(
            jsonResponse({ error: { message: "rate" } }, false, 429, {
              "retry-after": "2",
            }),
          );
        }
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
      });

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      const pending = service.complete({ prompt: "x", maxTokens: 10, deadlineMs: 60_000 });

      await Promise.resolve();
      await Promise.resolve();
      expect(calls).toBe(1);

      await jest.advanceTimersByTimeAsync(1_999);
      expect(calls).toBe(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe("ok");
      expect(calls).toBe(2);
    });

    it("dừng retry khi vượt deadlineMs dù còn lượt", async () => {
      jest.useFakeTimers();
      // Backoff lượt 1 = 500ms * 1 → vượt deadline 100ms.
      jest.spyOn(Math, "random").mockReturnValue(1);
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ error: { message: "down" } }, false, 503));

      const { service } = makeService({ OPENROUTER_API_KEY: "key" });
      const pending = service.complete({
        prompt: "x",
        maxTokens: 10,
        timeoutMs: 50,
        deadlineMs: 100,
      });

      await expect(pending).rejects.toMatchObject({
        message: expect.stringContaining("down"),
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("usage recording", () => {
    it("ghi AiUsage từ usage OpenRouter khi có context", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: "hello" } }],
          usage: { prompt_tokens: 11, completion_tokens: 7, cost: 0.001234 },
        }),
      );
      const create = jest.fn().mockResolvedValue({});
      const { service } = makeService({ OPENROUTER_API_KEY: "key" }, fakePrisma({ create }));

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        usage: { userId: "user-1", endpoint: "rewrite" },
      });

      await Promise.resolve();
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          endpoint: "rewrite",
          promptTokens: 11,
          completionTokens: 7,
        }),
      });
    });

    it("không làm hỏng request khi lưu usage thất bại", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: "hello" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
        }),
      );
      const create = jest.fn().mockRejectedValue(new Error("db down"));
      const { service } = makeService({ OPENROUTER_API_KEY: "key" }, fakePrisma({ create }));

      await expect(
        service.complete({
          prompt: "x",
          maxTokens: 10,
          usage: { userId: "user-1", endpoint: "rewrite" },
        }),
      ).resolves.toBe("hello");
    });
  });
});
