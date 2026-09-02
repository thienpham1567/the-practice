import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { configureBodyParser } from "../src/configure-body-parser";
import { PrismaService } from "../src/prisma/prisma.service";

describe("API (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Rate limit auth là 10 req/phút và mọi test dùng chung một IP, nên bộ này
    // sẽ tự chặn chính mình. Throttling được kiểm chứng riêng ở throttle.e2e-spec.
    process.env.DISABLE_RATE_LIMIT = "true";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureBodyParser(app);
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "AiUsage", "AuthNonce", "SpeakingAttempt", "PracticeAttempt", "VocabEntry", "Document", "RefreshToken", "User" CASCADE',
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

  describe("body size limits", () => {
    /** ~6 MB of JSON — under speaking 8mb, over default 1mb. */
    function largePayload(bytes = 6 * 1024 * 1024) {
      return { audioBase64: "A".repeat(bytes), format: "wav", durationMs: 60_000 };
    }

    it("accepts a ~6 MB body on speaking submit path (not 413)", async () => {
      const response = await server()
        .post("/speaking/attempts/any-id/submit")
        .send(largePayload());
      // Parsed successfully — route may 401/404 until the module exists; must not be 413.
      expect(response.status).not.toBe(413);
    });

    it("rejects a ~6 MB body on other JSON routes with 413", async () => {
      await server().post("/auth/login").send(largePayload()).expect(413);
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
      expect(aliceList.body.items).toHaveLength(1);
      expect(aliceList.body.nextCursor).toBeNull();
      expect(aliceList.body.items[0].content).toBeUndefined();
      expect(aliceList.body.items[0].title).toBe("Draft");

      const bobList = await server()
        .get("/documents")
        .set({ Authorization: `Bearer ${bob.accessToken}` })
        .expect(200);
      expect(bobList.body).toEqual({ items: [], nextCursor: null });
    });

    it("phân trang theo cursor — trang 1 và trang 2 không trùng", async () => {
      const { accessToken } = await registerUser("docs-page@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      for (let i = 0; i < 5; i += 1) {
        await server()
          .post("/documents")
          .set(auth)
          .send({ ...payload, title: `Draft ${i}` })
          .expect(201);
      }

      const page1 = await server().get("/documents?limit=2").set(auth).expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).toEqual(expect.any(String));

      const page2 = await server()
        .get(`/documents?limit=2&cursor=${page1.body.nextCursor}`)
        .set(auth)
        .expect(200);
      expect(page2.body.items).toHaveLength(2);

      const ids1 = page1.body.items.map((item: { id: string }) => item.id);
      const ids2 = page2.body.items.map((item: { id: string }) => item.id);
      expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);

      const noCursor = await server().get("/documents").set(auth).expect(200);
      expect(noCursor.body.items.length).toBeGreaterThanOrEqual(5);
      expect(noCursor.body.nextCursor).toBeNull();
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

    const extractedMarks = {
      marks: [
        {
          quote: "a school",
          occurrence: 1,
          category: "article",
          correction: "the school",
          note: "Use the definite article for a specific school.",
        },
        {
          quote: "a trip",
          occurrence: 1,
          category: "article",
          correction: "the trip",
          note: "The trip has already been mentioned.",
        },
      ],
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockPracticeAi(options?: {
      generateQueue?: Array<typeof generated>;
    }) {
      const generateQueue = [...(options?.generateQueue ?? [])];
      return jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as {
          response_format?: { json_schema?: { name?: string } };
        };
        const schemaName = body.response_format?.json_schema?.name;
        let content: string;
        if (schemaName === "practice_grade") {
          content = JSON.stringify(graded);
        } else if (schemaName === "practice_revision_grade") {
          content = JSON.stringify({
            ...graded,
            feedbackAudit: [
              { point: "Mostly simple sentences.", status: "resolved" },
              { point: "Try one longer sentence next time.", status: "partial" },
            ],
          });
        } else if (schemaName === "practice_marks") {
          content = JSON.stringify(extractedMarks);
        } else {
          const next = generateQueue.length > 0 ? generateQueue.shift()! : generated;
          content = JSON.stringify(next);
        }

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
      // Chỉ tình huống được lưu; khung yêu cầu cố định lấy từ TaskSpec.
      expect(created.body.prompt).toBe(generated.prompt);
      expect(created.body.prompt).not.toContain("Write an email to a specific person");
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
      expect(listed.body.items).toHaveLength(1);
      expect(listed.body.nextCursor).toBeNull();
      expect(listed.body.items[0].content).toBeUndefined();
      expect(listed.body.items[0].ideas).toBeUndefined();
      expect(listed.body.items[0].prompt).toBeUndefined();
      expect(listed.body.items[0].band).toBe(6);

      const fetched = await server().get(`/practice/attempts/${id}`).set(auth).expect(200);
      expect(fetched.body.content).toEqual(content);
      expect(fetched.body.band).toBe(6);

      await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(auth)
        .send({ styleSnapshot: {} })
        .expect(409);
    });

    it("revise trả 201 với attempt mới; revise lần hai trả 409", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("practice-revise@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);
      const id = created.body.id as string;

      await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: { counts: { passives: 0 } },
          plainText: "Dear Ms Lee, I went on a school trip to the museum.",
          wordCount: 12,
        })
        .expect(201);

      const revised = await server()
        .post(`/practice/attempts/${id}/revise`)
        .set(auth)
        .expect(201);

      expect(revised.body.id).not.toBe(id);
      expect(revised.body.parentAttemptId).toBe(id);
      expect(revised.body.revisionRound).toBe(1);
      expect(revised.body.submittedAt).toBeNull();
      expect(revised.body.plainText).toContain("Dear Ms Lee");

      const rootWhilePending = await server()
        .get(`/practice/attempts/${id}`)
        .set(auth)
        .expect(200);
      expect(rootWhilePending.body.hasRevision).toBe(true);
      expect(rootWhilePending.body.pendingRevisionId).toBe(revised.body.id);

      await server().post(`/practice/attempts/${id}/revise`).set(auth).expect(409);
    });

    it("submit bản sửa tính vào quota ngày — vượt hạn mức → 429", async () => {
      const previous = process.env.AI_DAILY_QUOTA;
      // create (generate) + root submit (grade) fill the quota; revise is free; revision submit must 429.
      process.env.AI_DAILY_QUOTA = "2";
      mockPracticeAi();

      try {
        const { accessToken } = await registerUser("practice-revision-quota@example.com");
        const auth = { Authorization: `Bearer ${accessToken}` };

        const created = await server()
          .post("/practice/attempts")
          .set(auth)
          .send({ level: "A2", taskType: "email" })
          .expect(201);
        const id = created.body.id as string;

        await server()
          .post(`/practice/attempts/${id}/submit`)
          .set(auth)
          .send({
            styleSnapshot: { counts: { passives: 0 } },
            plainText: "Dear Ms Lee, I went on a school trip to the museum.",
            wordCount: 12,
          })
          .expect(201);

        const revised = await server()
          .post(`/practice/attempts/${id}/revise`)
          .set(auth)
          .expect(201);

        const blocked = await server()
          .post(`/practice/attempts/${revised.body.id}/submit`)
          .set(auth)
          .send({
            styleSnapshot: { counts: { passives: 0 } },
            plainText: "Dear Ms Lee, I went on a school trip and learned a lot.",
            wordCount: 14,
          })
          .expect(429);

        expect(blocked.body.message).toMatch(/Daily AI quota exceeded/i);
        expect(blocked.body.resetsAt).toEqual(expect.stringMatching(/Z$/));
      } finally {
        if (previous === undefined) delete process.env.AI_DAILY_QUOTA;
        else process.env.AI_DAILY_QUOTA = previous;
      }
    });

    it("phân trang practice theo cursor — trang 1 và trang 2 không trùng", async () => {
      const { accessToken } = await registerUser("practice-page@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: "practice-page@example.com" },
      });

      for (let i = 0; i < 5; i += 1) {
        await prisma.practiceAttempt.create({
          data: {
            userId: user.id,
            level: "A2",
            taskType: "email",
            prompt: `Prompt ${i}`,
            ideas: [],
            vocabulary: [],
            startedAt: new Date(Date.now() - i * 60_000),
          },
        });
      }

      const page1 = await server().get("/practice/attempts?limit=2").set(auth).expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).toEqual(expect.any(String));
      expect(page1.body.items[0].prompt).toBeUndefined();

      const page2 = await server()
        .get(`/practice/attempts?limit=2&cursor=${page1.body.nextCursor}`)
        .set(auth)
        .expect(200);
      expect(page2.body.items).toHaveLength(2);

      const ids1 = page1.body.items.map((item: { id: string }) => item.id);
      const ids2 = page2.body.items.map((item: { id: string }) => item.id);
      expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    });

    it("GET /practice/vocab lists unused first, hides others, paginates without overlap", async () => {
      const alice = await registerUser("vocab-list-alice@example.com");
      const bob = await registerUser("vocab-list-bob@example.com");
      const aliceAuth = { Authorization: `Bearer ${alice.accessToken}` };
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };
      const aliceUser = await prisma.user.findUniqueOrThrow({
        where: { email: "vocab-list-alice@example.com" },
      });
      const bobUser = await prisma.user.findUniqueOrThrow({
        where: { email: "vocab-list-bob@example.com" },
      });

      const t = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000);

      // Mix of unused/used with staggered lastSuggestedAt — unused must lead.
      await prisma.vocabEntry.createMany({
        data: [
          {
            userId: aliceUser.id,
            word: "used-old",
            meaning: "m",
            example: "e",
            level: "B1",
            usedCount: 2,
            lastSuggestedAt: t(10),
          },
          {
            userId: aliceUser.id,
            word: "unused-newer",
            meaning: "m",
            example: "e",
            level: "B1",
            usedCount: 0,
            lastSuggestedAt: t(1),
          },
          {
            userId: aliceUser.id,
            word: "unused-older",
            meaning: "m",
            example: "e",
            level: "B1",
            usedCount: 0,
            lastSuggestedAt: t(5),
          },
          {
            userId: aliceUser.id,
            word: "used-newer",
            meaning: "m",
            example: "e",
            level: "B1",
            usedCount: 1,
            lastSuggestedAt: t(2),
          },
          {
            userId: aliceUser.id,
            word: "extra",
            meaning: "m",
            example: "e",
            level: "A2",
            usedCount: 0,
            lastSuggestedAt: t(3),
          },
          {
            userId: bobUser.id,
            word: "secret",
            meaning: "m",
            example: "e",
            level: "B1",
            usedCount: 0,
          },
        ],
      });

      await server().get("/practice/vocab").expect(401);

      const all = await server().get("/practice/vocab").set(aliceAuth).expect(200);
      const words = all.body.items.map((item: { word: string }) => item.word);
      expect(words).toEqual([
        "unused-newer",
        "extra",
        "unused-older",
        "used-newer",
        "used-old",
      ]);
      expect(all.body.items.every((item: { word: string }) => item.word !== "secret")).toBe(
        true,
      );

      const bobList = await server().get("/practice/vocab").set(bobAuth).expect(200);
      expect(bobList.body.items.map((item: { word: string }) => item.word)).toEqual([
        "secret",
      ]);

      const page1 = await server().get("/practice/vocab?limit=2").set(aliceAuth).expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).toEqual(expect.any(String));
      expect(page1.body.items.map((item: { word: string }) => item.word)).toEqual([
        "unused-newer",
        "extra",
      ]);

      const page2 = await server()
        .get(`/practice/vocab?limit=2&cursor=${page1.body.nextCursor}`)
        .set(aliceAuth)
        .expect(200);
      expect(page2.body.items).toHaveLength(2);

      const ids1 = page1.body.items.map((item: { id: string }) => item.id);
      const ids2 = page2.body.items.map((item: { id: string }) => item.id);
      expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
      expect(page2.body.items.map((item: { word: string }) => item.word)).toEqual([
        "unused-older",
        "used-newer",
      ]);
    });

    it("vocab notebook: create records words, submit marks used, next create flags review", async () => {
      const firstGenerate = {
        ...generated,
        vocabulary: [
          {
            word: "explore",
            meaning: "to look around a place",
            example: "We explore the museum.",
          },
          {
            word: "memorable",
            meaning: "worth remembering",
            example: "It was a memorable day.",
          },
        ],
      };
      const secondGenerate = {
        ...generated,
        prompt: "Write to a friend about your daily commute to school.",
        vocabulary: [
          {
            word: "commute",
            meaning: "travel to work or school",
            example: "I commute by bus.",
          },
          {
            word: "punctual",
            meaning: "on time",
            example: "She is always punctual.",
          },
        ],
      };

      mockPracticeAi({ generateQueue: [firstGenerate, secondGenerate] });
      const { accessToken } = await registerUser("practice-vocab@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: "practice-vocab@example.com" },
      });

      // Seed an unused word that will not appear on the first attempt, so the
      // second create can pick it as a review candidate (previous vocab excluded).
      await prisma.vocabEntry.create({
        data: {
          userId: user.id,
          word: "commute",
          meaning: "travel to work or school",
          example: "I commute by bus.",
          level: "A2",
        },
      });

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      const entriesAfterCreate = await prisma.vocabEntry.findMany({
        where: { userId: user.id },
        orderBy: { word: "asc" },
      });
      expect(entriesAfterCreate.map((e) => e.word).sort()).toEqual([
        "commute",
        "explore",
        "memorable",
      ]);
      expect(entriesAfterCreate.find((e) => e.word === "explore")?.usedCount).toBe(0);

      const id = created.body.id as string;
      await server()
        .post(`/practice/attempts/${id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: { counts: { passives: 0 } },
          plainText: "Dear Ms Lee, we were exploring the museum all afternoon.",
          wordCount: 12,
        })
        .expect(201);

      const explore = await prisma.vocabEntry.findUniqueOrThrow({
        where: { userId_word: { userId: user.id, word: "explore" } },
      });
      expect(explore.usedCount).toBeGreaterThan(0);
      expect(explore.firstUsedAt).not.toBeNull();

      const second = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      const vocab = second.body.vocabulary as Array<{
        word: string;
        review?: boolean;
      }>;
      expect(vocab.some((item) => item.word === "commute" && item.review === true)).toBe(
        true,
      );
      expect(vocab.find((item) => item.word === "punctual")?.review).toBeUndefined();

      // Revision submit still runs markUsed; revise does not add new vocab entries.
      await server()
        .post(`/practice/attempts/${second.body.id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: {},
          plainText: "Dear friend, my commute is short.",
          wordCount: 6,
        })
        .expect(201);

      const beforeReviseCount = await prisma.vocabEntry.count({
        where: { userId: user.id },
      });

      const revised = await server()
        .post(`/practice/attempts/${second.body.id}/revise`)
        .set(auth)
        .expect(201);

      await server()
        .post(`/practice/attempts/${revised.body.id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: {},
          plainText: "Dear friend, it was a memorable trip and I was punctual.",
          wordCount: 12,
        })
        .expect(201);

      const afterReviseCount = await prisma.vocabEntry.count({
        where: { userId: user.id },
      });
      expect(afterReviseCount).toBe(beforeReviseCount);

      const memorable = await prisma.vocabEntry.findUniqueOrThrow({
        where: { userId_word: { userId: user.id, word: "memorable" } },
      });
      expect(memorable.usedCount).toBeGreaterThan(0);

      const punctual = await prisma.vocabEntry.findUniqueOrThrow({
        where: { userId_word: { userId: user.id, word: "punctual" } },
      });
      expect(punctual.usedCount).toBeGreaterThan(0);
    });

    it("GET /practice/progress returns own graded root series and streak", async () => {
      const alice = await registerUser("progress-alice@example.com");
      const bob = await registerUser("progress-bob@example.com");
      const aliceAuth = { Authorization: `Bearer ${alice.accessToken}` };
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };
      const aliceUser = await prisma.user.findUniqueOrThrow({
        where: { email: "progress-alice@example.com" },
      });
      const bobUser = await prisma.user.findUniqueOrThrow({
        where: { email: "progress-bob@example.com" },
      });

      const older = new Date("2026-08-10T09:00:00.000Z");
      const newer = new Date("2026-08-20T15:30:00.000Z");
      const scores = {
        taskResponse: 6.5,
        coherenceCohesion: 6,
        lexicalResource: 7,
        grammaticalRange: 5.5,
      };

      const aliceRoot = await prisma.practiceAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          taskType: "letter",
          prompt: "Write a letter",
          ideas: [],
          vocabulary: [],
          submittedAt: older,
          band: 6.5,
          scores,
          styleSnapshot: {
            counts: { passives: 2, adverbs: 5 },
            stats: { words: 250 },
          },
        },
      });
      await prisma.practiceAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          taskType: "letter",
          prompt: "Revision",
          ideas: [],
          vocabulary: [],
          submittedAt: newer,
          band: 7,
          scores,
          parentAttemptId: aliceRoot.id,
          revisionRound: 1,
          styleSnapshot: {
            counts: { passives: 0, adverbs: 0 },
            stats: { words: 200 },
          },
        },
      });
      await prisma.practiceAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "A2",
          taskType: "email",
          prompt: "Draft only",
          ideas: [],
          vocabulary: [],
        },
      });
      await prisma.practiceAttempt.create({
        data: {
          userId: bobUser.id,
          level: "C1",
          taskType: "report",
          prompt: "Bob secret",
          ideas: [],
          vocabulary: [],
          submittedAt: newer,
          band: 8,
          scores,
          styleSnapshot: {
            counts: { passives: 1, adverbs: 1 },
            stats: { words: 100 },
          },
        },
      });

      await server().get("/practice/progress").expect(401);

      const aliceProgress = await server()
        .get("/practice/progress")
        .set(aliceAuth)
        .expect(200);

      expect(aliceProgress.body.series).toHaveLength(1);
      expect(aliceProgress.body.series[0]).toEqual({
        at: older.toISOString(),
        level: "B1",
        band: 6.5,
        scores: { task: 6.5, coherence: 6, lexical: 7, grammar: 5.5 },
        per100: { passives: 0.8, adverbs: 2 },
      });
      expect(aliceProgress.body.streak).toEqual({
        current: expect.any(Number),
        submittedDates: [older.toISOString()],
      });

      const bobProgress = await server()
        .get("/practice/progress")
        .set(bobAuth)
        .expect(200);
      expect(bobProgress.body.series).toHaveLength(1);
      expect(bobProgress.body.series[0].level).toBe("C1");
      expect(bobProgress.body.series[0].at).toBe(newer.toISOString());
    });

    it("DELETE /practice/attempts/:id xoá bài của mình, 404 với bài người khác, cascade revisions", async () => {
      const alice = await registerUser("practice-delete-alice@example.com");
      const bob = await registerUser("practice-delete-bob@example.com");
      const aliceAuth = { Authorization: `Bearer ${alice.accessToken}` };
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };
      const aliceUser = await prisma.user.findUniqueOrThrow({
        where: { email: "practice-delete-alice@example.com" },
      });

      const root = await prisma.practiceAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          taskType: "email",
          prompt: "Write to a friend.",
          ideas: [],
          vocabulary: [],
        },
      });
      const revision = await prisma.practiceAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          taskType: "email",
          prompt: "Write to a friend.",
          ideas: [],
          vocabulary: [],
          parentAttemptId: root.id,
          revisionRound: 1,
        },
      });

      await server().delete(`/practice/attempts/${root.id}`).expect(401);

      await server().delete(`/practice/attempts/${root.id}`).set(bobAuth).expect(404);
      expect(await prisma.practiceAttempt.findUnique({ where: { id: root.id } })).not.toBeNull();

      await server().delete(`/practice/attempts/${root.id}`).set(aliceAuth).expect(204);
      expect(await prisma.practiceAttempt.findUnique({ where: { id: root.id } })).toBeNull();
      expect(await prisma.practiceAttempt.findUnique({ where: { id: revision.id } })).toBeNull();

      await server().delete(`/practice/attempts/${root.id}`).set(aliceAuth).expect(404);
    });

    it("chặn hồ sơ lỗi khi chưa đăng nhập", async () => {
      await server().get("/practice/mistakes").expect(401);
    });

    it("trả hồ sơ rỗng khi chưa nộp bài nào", async () => {
      const { accessToken } = await registerUser("mistakes-empty@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const response = await server().get("/practice/mistakes").set(auth).expect(200);

      expect(response.body).toEqual({ tallies: [], attemptsConsidered: 0 });
    });

    it("đánh dấu lỗi khi nộp và gộp vào hồ sơ", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("mistakes-profile@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      const submitted = await server()
        .post(`/practice/attempts/${created.body.id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: {},
          plainText: "I went on a trip with a school group and it was memorable.",
          wordCount: 12,
        })
        .expect(201);

      expect(submitted.body.marks).toEqual([
        expect.objectContaining({ category: "article", severity: "error" }),
        expect.objectContaining({ category: "article", severity: "error" }),
      ]);

      const profile = await server().get("/practice/mistakes").set(auth).expect(200);

      expect(profile.body.attemptsConsidered).toBe(1);
      // Two marks reach MIN_OCCURRENCES; one paper is too few for a trend.
      expect(profile.body.tallies).toEqual([
        { category: "article", count: 2, trend: null },
      ]);
    });
  });

  describe("speaking", () => {
    const generatedCue = {
      topic: "Describe a festival you enjoyed",
      bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
    };

    const graded = {
      transcript: "Um, I went to a festival last year with my friends and we danced.",
      marks: [{ quote: "Um,", kind: "filler", note: "Filler word." }],
      scores: {
        fluencyCoherence: 6,
        lexicalResource: 6,
        grammaticalRange: 6,
        pronunciation: 5,
      },
      feedback: {
        fluencyCoherence: "Mostly steady.",
        lexicalResource: "Adequate words.",
        grammaticalRange: "Simple sentences.",
        pronunciation: "Clear enough.",
        overview: "A fair B1 talk.",
        nextFocus: "Cut fillers at the start.",
      },
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockSpeakingAi() {
      return jest.spyOn(global, "fetch").mockImplementation(async (_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as {
          response_format?: { json_schema?: { name?: string } };
          messages?: { content?: unknown }[];
        };
        const schemaName = body.response_format?.json_schema?.name;
        let content: string;
        if (schemaName === "speaking_grade") {
          content = JSON.stringify(graded);
        } else {
          content = JSON.stringify(generatedCue);
        }

        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ choices: [{ message: { content } }] }),
        } as Response;
      });
    }

    it("chặn khi chưa đăng nhập", async () => {
      await server().get("/speaking/attempts").expect(401);
      await server().post("/speaking/attempts").send({ level: "A2" }).expect(401);
    });

    it("tạo attempt với cueCard đúng cấu trúc", async () => {
      mockSpeakingAi();
      const { accessToken } = await registerUser("speaking-create@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/speaking/attempts")
        .set(auth)
        .send({ level: "B1" })
        .expect(201);

      expect(created.body.level).toBe("B1");
      expect(created.body.cueCard).toEqual(generatedCue);
      expect(created.body.submittedAt).toBeNull();
      expect(created.body.startedAt).toEqual(expect.any(String));
    });

    it("audio dưới 10 giây → 400 và không gọi AI chấm", async () => {
      const fetchSpy = mockSpeakingAi();
      const { accessToken } = await registerUser("speaking-short@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/speaking/attempts")
        .set(auth)
        .send({ level: "A2" })
        .expect(201);
      const generateCalls = fetchSpy.mock.calls.length;

      await server()
        .post(`/speaking/attempts/${created.body.id}/submit`)
        .set(auth)
        .send({ audioBase64: "AAAA", format: "wav", durationMs: 5_000 })
        .expect(400);

      expect(fetchSpy.mock.calls.length).toBe(generateCalls);
    });

    it("nộp đủ dài → transcript, marks, band; revise → 201 rồi 409", async () => {
      mockSpeakingAi();
      const { accessToken } = await registerUser("speaking-flow@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/speaking/attempts")
        .set(auth)
        .send({ level: "B1" })
        .expect(201);
      const id = created.body.id as string;

      const submitted = await server()
        .post(`/speaking/attempts/${id}/submit`)
        .set(auth)
        .send({ audioBase64: "QUFBQUFB", format: "wav", durationMs: 15_000 })
        .expect(201);

      expect(submitted.body.band).toBe(6);
      expect(submitted.body.transcript).toContain("festival");
      expect(submitted.body.marks).toEqual([
        { start: 0, end: 3, kind: "filler", note: "Filler word." },
      ]);
      expect(submitted.body.fluency).toEqual(
        expect.objectContaining({
          wordsPerMinute: expect.any(Number),
          fillerCount: expect.any(Number),
        }),
      );

      const listed = await server().get("/speaking/attempts").set(auth).expect(200);
      expect(listed.body.items).toHaveLength(1);
      expect(listed.body.items[0].cueCard).toBeUndefined();
      expect(listed.body.items[0].band).toBe(6);

      const revised = await server()
        .post(`/speaking/attempts/${id}/revise`)
        .set(auth)
        .expect(201);
      expect(revised.body.parentAttemptId).toBe(id);
      expect(revised.body.revisionRound).toBe(1);
      expect(revised.body.cueCard).toEqual(generatedCue);
      expect(revised.body.submittedAt).toBeNull();

      const root = await server().get(`/speaking/attempts/${id}`).set(auth).expect(200);
      expect(root.body.hasRevision).toBe(true);
      expect(root.body.pendingRevisionId).toBe(revised.body.id);

      await server().post(`/speaking/attempts/${id}/revise`).set(auth).expect(409);

      const listAfter = await server().get("/speaking/attempts").set(auth).expect(200);
      expect(listAfter.body.items).toHaveLength(1);
      expect(listAfter.body.items[0].revisionCount).toBe(1);
    });

    it("DELETE /speaking/attempts/:id xoá talk của mình, 404 với talk người khác, cascade re-recordings", async () => {
      const alice = await registerUser("speaking-delete-alice@example.com");
      const bob = await registerUser("speaking-delete-bob@example.com");
      const aliceAuth = { Authorization: `Bearer ${alice.accessToken}` };
      const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };
      const aliceUser = await prisma.user.findUniqueOrThrow({
        where: { email: "speaking-delete-alice@example.com" },
      });

      const cueCard = {
        topic: "Describe a festival you enjoyed",
        bullets: ["what it was", "who you went with", "why you enjoyed it"],
      };
      const root = await prisma.speakingAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          cueCard,
        },
      });
      const revision = await prisma.speakingAttempt.create({
        data: {
          userId: aliceUser.id,
          level: "B1",
          cueCard,
          parentAttemptId: root.id,
          revisionRound: 1,
        },
      });

      await server().delete(`/speaking/attempts/${root.id}`).expect(401);

      await server().delete(`/speaking/attempts/${root.id}`).set(bobAuth).expect(404);
      expect(await prisma.speakingAttempt.findUnique({ where: { id: root.id } })).not.toBeNull();

      await server().delete(`/speaking/attempts/${root.id}`).set(aliceAuth).expect(204);
      expect(await prisma.speakingAttempt.findUnique({ where: { id: root.id } })).toBeNull();
      expect(await prisma.speakingAttempt.findUnique({ where: { id: revision.id } })).toBeNull();
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

  describe("ops headers", () => {
    it("helmet gắn X-Content-Type-Options và X-Frame-Options", async () => {
      const response = await server().get("/health/live").expect(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
      // CSP tắt để không chặn GIS nếu process này từng serve HTML
      expect(response.headers["content-security-policy"]).toBeUndefined();
    });

    it("echo x-request-id từ client hoặc sinh mới", async () => {
      const echoed = await server()
        .get("/health/live")
        .set("x-request-id", "test-req-123")
        .expect(200);
      expect(echoed.headers["x-request-id"]).toBe("test-req-123");

      const generated = await server().get("/health/live").expect(200);
      expect(generated.headers["x-request-id"]).toEqual(expect.any(String));
      expect(generated.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
