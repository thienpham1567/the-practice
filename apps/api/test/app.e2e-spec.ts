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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Document", "RefreshToken", "User" CASCADE');
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

  describe("health", () => {
    it("trả về ok", async () => {
      await server().get("/health").expect(200, { status: "ok" });
    });
  });
});
