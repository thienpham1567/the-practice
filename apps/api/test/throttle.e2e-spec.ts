import { ValidationPipe, type INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/configure-app";
import { PrismaService } from "../src/prisma/prisma.service";

/** Bộ này giữ nguyên ThrottlerGuard thật để kiểm chứng giới hạn route auth. */
describe("Rate limiting (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "false";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await app
      .get(PrismaService)
      .$executeRawUnsafe(
        'TRUNCATE TABLE "AiUsage", "AuthNonce", "SpeakingAttempt", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
      );
  });

  afterAll(async () => {
    await app.close();
  });

  it("chặn sau 10 lần gọi route auth trong một phút", async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });

    for (let i = 0; i < 10; i++) {
      const response = await attempt();
      expect(response.status).toBe(401);
    }

    await attempt().expect(429);
  });
});

describe("Rate limiting Google nonce (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "false";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await app
      .get(PrismaService)
      .$executeRawUnsafe(
        'TRUNCATE TABLE "AiUsage", "AuthNonce", "SpeakingAttempt", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
      );
  });

  afterAll(async () => {
    await app.close();
  });

  it("cho phép 10 lần GET nonce rồi chặn lần 11", async () => {
    const attempt = () => request(app.getHttpServer()).get("/auth/google/nonce");

    for (let i = 0; i < 10; i++) {
      const response = await attempt();
      expect(response.status).toBe(200);
      expect(response.body.nonce).toEqual(expect.any(String));
    }

    await attempt().expect(429);
  });
});

describe("Rate limiting sau proxy (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "false";
    process.env.TRUST_PROXY_HOPS = "1";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.TRUST_PROXY_HOPS;
    await app.close();
  });

  const login = (clientIp: string) =>
    request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Forwarded-For", clientIp)
      .send({ email: "nobody@example.com", password: "wrong-password" });

  it("đếm hạn mức theo IP người dùng, không theo IP proxy", async () => {
    for (let i = 0; i < 10; i++) {
      await login("203.0.113.10").expect(401);
    }
    await login("203.0.113.10").expect(429);

    // Người khác sau cùng proxy không bị vạ lây.
    await login("198.51.100.7").expect(401);
  });

  it("không bao giờ chặn /auth/refresh — lượt tải trang nào cũng gọi nó", async () => {
    for (let i = 0; i < 25; i++) {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("X-Forwarded-For", "203.0.113.20")
        .expect(204);
    }
  });
});
