import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
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
        'TRUNCATE TABLE "AiUsage", "AuthNonce", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
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
        'TRUNCATE TABLE "AiUsage", "AuthNonce", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
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
