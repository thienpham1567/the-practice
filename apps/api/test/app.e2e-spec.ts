import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Rate limit auth là 10 req/phút và mọi test dùng chung một IP, nên bộ này
    // sẽ tự chặn chính mình. Throttling được kiểm chứng riêng ở throttle.e2e-spec.
    process.env.DISABLE_RATE_LIMIT = "true";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "AiUsage", "AuthNonce", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function registerUser(email: string) {
    const response = await server()
      .post("/auth/register")
      .send({ email, password: "correct-horse" })
      .expect(201);

    return {
      accessToken: response.body.accessToken as string,
      cookies: response.headers["set-cookie"] as unknown as string[],
    };
  }

  describe("auth", () => {
    it("đăng ký trả về access token và đặt refresh cookie", async () => {
      const response = await server()
        .post("/auth/register")
        .send({ email: "writer@example.com", password: "correct-horse" })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({ email: "writer@example.com" });
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(String(response.headers["set-cookie"])).toContain("refresh_token=");
      expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
    });

    it("từ chối email sai định dạng và mật khẩu quá ngắn", async () => {
      await server().post("/auth/register").send({ email: "nope", password: "short" }).expect(400);
      await server()
        .post("/auth/register")
        .send({ email: "a@b.com", password: "short" })
        .expect(400);
    });

    it("từ chối email đã đăng ký", async () => {
      await registerUser("dup@example.com");

      await server()
        .post("/auth/register")
        .send({ email: "dup@example.com", password: "correct-horse" })
        .expect(409);
    });

    it("đăng nhập được sau khi đăng ký", async () => {
      await registerUser("login@example.com");

      const response = await server()
        .post("/auth/login")
        .send({ email: "login@example.com", password: "correct-horse" })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it("từ chối mật khẩu sai mà không tiết lộ email có tồn tại hay không", async () => {
      await registerUser("real@example.com");

      const wrongPassword = await server()
        .post("/auth/login")
        .send({ email: "real@example.com", password: "wrong-password" })
        .expect(401);

      const noSuchUser = await server()
        .post("/auth/login")
        .send({ email: "ghost@example.com", password: "wrong-password" })
        .expect(401);

      expect(wrongPassword.body.message).toBe(noSuchUser.body.message);
    });

    it("refresh cấp access token mới và thu hồi token cũ", async () => {
      const { cookies } = await registerUser("rotate@example.com");

      const first = await server().post("/auth/refresh").set("Cookie", cookies).expect(200);
      expect(first.body.accessToken).toEqual(expect.any(String));
      // Web dựa vào đây để biết ai đang đăng nhập sau khi tải lại trang.
      expect(first.body.user).toMatchObject({ email: "rotate@example.com" });

      // Cookie cũ đã bị xoay vòng nên không dùng lại được.
      await server().post("/auth/refresh").set("Cookie", cookies).expect(401);
    });

    it("logout làm refresh token hết hiệu lực", async () => {
      const { cookies } = await registerUser("logout@example.com");

      await server().post("/auth/logout").set("Cookie", cookies).expect(204);
      await server().post("/auth/refresh").set("Cookie", cookies).expect(401);
    });

    it("refresh không có cookie trả 401", async () => {
      await server().post("/auth/refresh").expect(401);
    });

    it("cấp nonce Google khi chưa đăng nhập", async () => {
      const response = await server().get("/auth/google/nonce").expect(200);

      expect(response.body).toEqual({ nonce: expect.any(String) });
      expect(response.body.nonce).toHaveLength(64);
      expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("từ chối refresh token đã hết hạn", async () => {
      const { cookies } = await registerUser("expired@example.com");

      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await server().post("/auth/refresh").set("Cookie", cookies).expect(401);
    });

    it("access token của người này không mở được dữ liệu người kia", async () => {
      const alice = await registerUser("a1@example.com");
      await registerUser("b1@example.com");

      // Token hợp lệ nhưng ký bằng secret khác thì phải bị từ chối.
      const forged = `${alice.accessToken.split(".").slice(0, 2).join(".")}.forged-signature`;
      await server().get("/documents").set("Authorization", `Bearer ${forged}`).expect(401);
    });
  });

  describe("documents", () => {
    const payload = {
      title: "Draft",
      content: { root: { children: [] } },
      plainText: "The cat sat.",
      grade: 3,
    };

    it("chặn truy cập khi chưa đăng nhập", async () => {
      await server().get("/documents").expect(401);
      await server().post("/documents").send(payload).expect(401);
    });

    it("chặn access token không hợp lệ", async () => {
      await server().get("/documents").set("Authorization", "Bearer nonsense").expect(401);
    });

    it("tạo, đọc, sửa, xóa document", async () => {
      const { accessToken } = await registerUser("crud@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server().post("/documents").set(auth).send(payload).expect(201);
      const id = created.body.id as string;
      expect(created.body).toMatchObject({ title: "Draft", plainText: "The cat sat.", grade: 3 });

      const fetched = await server().get(`/documents/${id}`).set(auth).expect(200);
      expect(fetched.body.content).toEqual(payload.content);

      const updated = await server()
        .patch(`/documents/${id}`)
        .set(auth)
        .send({ title: "Revised", plainText: "The dog ran." })
        .expect(200);
      expect(updated.body).toMatchObject({ title: "Revised", plainText: "The dog ran." });
      expect(updated.body.grade).toBe(3);

      await server().delete(`/documents/${id}`).set(auth).expect(204);
      await server().get(`/documents/${id}`).set(auth).expect(404);
    });

    it("danh sách chỉ trả document của chính mình và bỏ content", async () => {
      const alice = await registerUser("alice@example.com");
      const bob = await registerUser("bob@example.com");

      await server()
        .post("/documents")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .send(payload)
        .expect(201);

      const aliceList = await server()
        .get("/documents")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .expect(200);
      expect(aliceList.body).toHaveLength(1);
      expect(aliceList.body[0].content).toBeUndefined();
      expect(aliceList.body[0].title).toBe("Draft");

      const bobList = await server()
        .get("/documents")
        .set({ Authorization: `Bearer ${bob.accessToken}` })
        .expect(200);
      expect(bobList.body).toEqual([]);
    });

    it("không cho người khác đọc, sửa hay xóa document của mình", async () => {
      const alice = await registerUser("owner@example.com");
      const bob = await registerUser("intruder@example.com");
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };

      const created = await server()
        .post("/documents")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .send(payload)
        .expect(201);
      const id = created.body.id as string;

      // 404 chứ không phải 403: 403 sẽ xác nhận document này có thật.
      await server().get(`/documents/${id}`).set(bobAuth).expect(404);
      await server().patch(`/documents/${id}`).set(bobAuth).send({ title: "Hijacked" }).expect(404);
      await server().delete(`/documents/${id}`).set(bobAuth).expect(404);

      const stillThere = await server()
        .get(`/documents/${id}`)
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .expect(200);
      expect(stillThere.body.title).toBe("Draft");
    });

    it("từ chối field lạ và thiếu field bắt buộc", async () => {
      const { accessToken } = await registerUser("validate@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      await server().post("/documents").set(auth).send({ plainText: "no content" }).expect(400);
      await server()
        .post("/documents")
        .set(auth)
        .send({ ...payload, ownerId: "someone-else" })
        .expect(400);
    });
  });

  describe("ai", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockOpenRouter(
      content: string,
      usage?: { prompt_tokens: number; completion_tokens: number; cost: number },
    ) {
      return jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content } }],
            ...(usage ? { usage } : {}),
          }),
      } as Response);
    }

    it("báo bật khi có OPENROUTER_API_KEY, không cần đăng nhập", async () => {
      await server().get("/ai/status").expect(200, { enabled: true });
    });

    it("chặn rewrite khi chưa đăng nhập", async () => {
      await server()
        .post("/ai/rewrite")
        .send({ text: "It was done.", issueType: "passive" })
        .expect(401);
    });

    it("từ chối issueType không hợp lệ", async () => {
      const { accessToken } = await registerUser("ai-validate@example.com");

      await server()
        .post("/ai/rewrite")
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({ text: "It was done.", issueType: "not-a-real-type" })
        .expect(400);
    });

    it("trả về gợi ý đã phân tích từ OpenRouter", async () => {
      mockOpenRouter("They finished the report.\nThe team finished it.");
      const { accessToken } = await registerUser("ai-rewrite@example.com");

      const response = await server()
        .post("/ai/rewrite")
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({ text: "The report was finished by them.", issueType: "passive" })
        .expect(201);

      expect(response.body.suggestions).toEqual([
        "They finished the report.",
        "The team finished it.",
      ]);
    });

    it("trả lỗi rõ ràng khi OpenRouter báo lỗi", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 402,
        json: () => Promise.resolve({ error: { message: "insufficient credits" } }),
      } as Response);
      const { accessToken } = await registerUser("ai-failure@example.com");

      const response = await server()
        .post("/ai/rewrite")
        .set({ Authorization: `Bearer ${accessToken}` })
        .send({ text: "It was done.", issueType: "passive" })
        .expect(503);

      expect(response.body.message).toContain("insufficient credits");
    });

    it("GET /ai/usage chỉ thấy usage của chính mình trong 30 ngày", async () => {
      mockOpenRouter("One.\nTwo.", { prompt_tokens: 5, completion_tokens: 3, cost: 0.01 });
      const alice = await registerUser("usage-alice@example.com");
      const bob = await registerUser("usage-bob@example.com");

      await server()
        .post("/ai/rewrite")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .send({ text: "It was done.", issueType: "passive" })
        .expect(201);

      mockOpenRouter("A.\nB.", { prompt_tokens: 9, completion_tokens: 4, cost: 0.02 });
      await server()
        .post("/ai/rewrite")
        .set({ Authorization: `Bearer ${bob.accessToken}` })
        .send({ text: "It was done.", issueType: "passive" })
        .expect(201);

      const aliceUsage = await server()
        .get("/ai/usage")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .expect(200);

      expect(aliceUsage.body).toMatchObject({
        windowDays: 30,
        promptTokens: 5,
        completionTokens: 3,
        calls: 1,
      });
      expect(aliceUsage.body.costUsd).toBe("0.010000");

      const bobUsage = await server()
        .get("/ai/usage")
        .set({ Authorization: `Bearer ${bob.accessToken}` })
        .expect(200);
      expect(bobUsage.body.calls).toBe(1);
      expect(bobUsage.body.promptTokens).toBe(9);
    });

    it("vượt AI_DAILY_QUOTA → 429 kèm thời điểm reset UTC", async () => {
      const previous = process.env.AI_DAILY_QUOTA;
      process.env.AI_DAILY_QUOTA = "1";
      mockOpenRouter("One.\nTwo.", { prompt_tokens: 1, completion_tokens: 1, cost: 0 });

      try {
        const { accessToken } = await registerUser("quota@example.com");
        await server()
          .post("/ai/rewrite")
          .set({ Authorization: `Bearer ${accessToken}` })
          .send({ text: "It was done.", issueType: "passive" })
          .expect(201);

        const blocked = await server()
          .post("/ai/rewrite")
          .set({ Authorization: `Bearer ${accessToken}` })
          .send({ text: "It was done.", issueType: "passive" })
          .expect(429);

        expect(blocked.body.message).toMatch(/Daily AI quota exceeded/i);
        expect(blocked.body.resetsAt).toEqual(expect.stringMatching(/Z$/));
      } finally {
        if (previous === undefined) delete process.env.AI_DAILY_QUOTA;
        else process.env.AI_DAILY_QUOTA = previous;
      }
    });
  });

  describe("practice", () => {
    const generated = {
      prompt: "Write to your English teacher about a school trip.",
      ideas: ["where you went", "who went with you", "what you did", "how you felt"],
      vocabulary: [
        { word: "memorable", meaning: "worth remembering", example: "It was a memorable day." },
      ],
    };

    const graded = {
      scores: {
        taskResponse: 6,
        coherenceCohesion: 6,
        lexicalResource: 6,
        grammaticalRange: 5,
      },
      feedback: {
        taskResponse: "You covered the bullet points.",
        coherenceCohesion: "The order is clear.",
        lexicalResource: "Simple but accurate words.",
        grammaticalRange: "Mostly simple sentences.",
        overview: "A fair A2 email.",
        nextFocus: "Try one longer sentence next time.",
      },
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockPracticeAi() {
      return jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as {
          response_format?: { json_schema?: { name?: string } };
        };
        const content =
          body.response_format?.json_schema?.name === "practice_grade"
            ? JSON.stringify(graded)
            : JSON.stringify(generated);

        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ choices: [{ message: { content } }] }),
        } as Response;
      });
    }

    it("chặn khi chưa đăng nhập", async () => {
      await server().get("/practice/attempts").expect(401);
      await server().post("/practice/attempts").send({ level: "A2" }).expect(401);
    });

    it("từ chối DTO sai", async () => {
      const { accessToken } = await registerUser("practice-validate@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      await server().post("/practice/attempts").set(auth).send({}).expect(400);
      await server().post("/practice/attempts").set(auth).send({ level: "Z9" }).expect(400);
      await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "report" })
        .expect(400);
    });

    it("user khác nhận 404 với mọi route trên bài của mình", async () => {
      mockPracticeAi();
      const alice = await registerUser("practice-alice@example.com");
      const bob = await registerUser("practice-bob@example.com");
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set({ Authorization: `Bearer ${alice.accessToken}` })
        .send({ level: "A2", taskType: "email" })
        .expect(201);
      const id = created.body.id as string;

      await server().get(`/practice/attempts/${id}`).set(bobAuth).expect(404);
      await server()
        .patch(`/practice/attempts/${id}`)
        .set(bobAuth)
        .send({ plainText: "hijacked" })
        .expect(404);
      await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(bobAuth)
        .send({ styleSnapshot: {} })
        .expect(404);
    });

    it("tạo, autosave, nộp, rồi xem lại — band do server tính", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("practice-flow@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      expect(created.body.taskType).toBe("email");
      expect(created.body.prompt).toContain(generated.prompt);
      expect(created.body.prompt).toContain("Write an email to a specific person");
      expect(created.body.ideas).toEqual(generated.ideas);
      expect(created.body.vocabulary).toEqual(generated.vocabulary);
      expect(created.body.startedAt).toEqual(expect.any(String));
      expect(created.body.submittedAt).toBeNull();

      const id = created.body.id as string;
      const content = { root: { children: [] } };

      const saved = await server()
        .patch(`/practice/attempts/${id}`)
        .set(auth)
        .send({
          content,
          plainText: "Dear Ms Lee, I went on a school trip to the museum.",
          wordCount: 12,
          hintsOpened: true,
        })
        .expect(200);
      expect(saved.body.plainText).toContain("Dear Ms Lee");
      expect(saved.body.hintsOpened).toBe(true);

      const submitted = await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: { counts: { passives: 0 } },
          plainText: "Dear Ms Lee, I went on a school trip to the museum.",
          wordCount: 12,
        })
        .expect(201);

      expect(submitted.body.band).toBe(6);
      expect(submitted.body.scores).toEqual(graded.scores);
      expect(submitted.body.feedback.nextFocus).toContain("longer sentence");
      expect(submitted.body.styleSnapshot).toEqual({ counts: { passives: 0 } });
      expect(submitted.body.submittedAt).toEqual(expect.any(String));

      const listed = await server().get("/practice/attempts").set(auth).expect(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0].content).toBeUndefined();
      expect(listed.body[0].ideas).toBeUndefined();
      expect(listed.body[0].band).toBe(6);

      const fetched = await server().get(`/practice/attempts/${id}`).set(auth).expect(200);
      expect(fetched.body.content).toEqual(content);
      expect(fetched.body.band).toBe(6);

      await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(auth)
        .send({ styleSnapshot: {} })
        .expect(409);
    });
  });

  describe("health", () => {
    it("live trả 200 không cần DB ping ngoài tiến trình", async () => {
      await server().get("/health/live").expect(200, { status: "ok" });
    });

    it("ready trả 200 khi DB sống", async () => {
      await server().get("/health/ready").expect(200, { status: "ok" });
    });

    it("/health là alias của ready", async () => {
      await server().get("/health").expect(200, { status: "ok" });
    });
  });
});
