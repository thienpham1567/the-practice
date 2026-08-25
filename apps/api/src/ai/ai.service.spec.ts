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
        .mockResolvedValue(
          jsonResponse({ choices: [{ message: { content: "One.\nTwo." } }] }),
        );

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

      await expect(
        service.rewrite({ text: "x", issueType: "passive" }),
      ).rejects.toMatchObject({ message: expect.stringContaining("insufficient credits") });
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
      const assertion = expect(service.rewrite({ text: "x", issueType: "passive" })).rejects.toBeInstanceOf(
        GatewayTimeoutException,
      );

      await jest.advanceTimersByTimeAsync(15_000);
      await assertion;

      jest.useRealTimers();
    });

    it("báo lỗi khi mô hình trả về nội dung rỗng", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] }));

      const service = new AiService(fakeConfig({ OPENROUTER_API_KEY: "key" }));

      await expect(
        service.rewrite({ text: "x", issueType: "passive" }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
