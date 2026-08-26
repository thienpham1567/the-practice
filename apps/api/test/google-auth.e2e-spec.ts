import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GoogleTokenVerifier } from "../src/auth/google-token-verifier";
import { PrismaService } from "../src/prisma/prisma.service";

/** JWT đủ để vượt `@IsJWT()` — verifier giả, không cần chữ ký Google. */
const VALID_CREDENTIAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("Google sign-in HTTP (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const googleVerifier = { verify: jest.fn() };

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "true";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleTokenVerifier)
      .useValue(googleVerifier)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    googleVerifier.verify.mockReset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "AiUsage", "AuthNonce", "PracticeAttempt", "Document", "RefreshToken", "User" CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  async function issueNonce(): Promise<string> {
    const response = await server().get("/auth/google/nonce").expect(200);
    return response.body.nonce as string;
  }

  it("đăng nhập Google trả access token, user, và refresh cookie HttpOnly", async () => {
    const nonce = await issueNonce();
    googleVerifier.verify.mockResolvedValue({
      googleId: "google-sub-e2e",
      email: "google-e2e@example.com",
      emailVerified: true,
      nonce,
    });

    const response = await server()
      .post("/auth/google")
      .send({ credential: VALID_CREDENTIAL })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email: "google-e2e@example.com" });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(String(response.headers["set-cookie"])).toContain("refresh_token=");
    expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
    expect(googleVerifier.verify).toHaveBeenCalledWith(VALID_CREDENTIAL);
  });

  it("từ chối credential rỗng hoặc không phải JWT", async () => {
    await server().post("/auth/google").send({ credential: "" }).expect(400);
    await server().post("/auth/google").send({ credential: "not-a-jwt" }).expect(400);
    await server().post("/auth/google").send({}).expect(400);
    expect(googleVerifier.verify).not.toHaveBeenCalled();
  });

  it("từ chối phát lại cùng credential sau khi nonce đã dùng", async () => {
    const nonce = await issueNonce();
    googleVerifier.verify.mockResolvedValue({
      googleId: "google-sub-replay",
      email: "replay@example.com",
      emailVerified: true,
      nonce,
    });

    await server().post("/auth/google").send({ credential: VALID_CREDENTIAL }).expect(200);

    const replay = await server()
      .post("/auth/google")
      .send({ credential: VALID_CREDENTIAL })
      .expect(401);

    expect(replay.body.message).toBe("Sign-in session expired. Please try again.");
  });

  it("từ chối email chưa xác minh mà không đốt nonce", async () => {
    const nonce = await issueNonce();
    googleVerifier.verify.mockResolvedValueOnce({
      googleId: "google-sub-unverified",
      email: "unverified@example.com",
      emailVerified: false,
      nonce,
    });

    const denied = await server()
      .post("/auth/google")
      .send({ credential: VALID_CREDENTIAL })
      .expect(401);
    expect(denied.body.message).toBe("Your Google account's email is not verified.");

    googleVerifier.verify.mockResolvedValueOnce({
      googleId: "google-sub-unverified",
      email: "unverified@example.com",
      emailVerified: true,
      nonce,
    });

    const allowed = await server()
      .post("/auth/google")
      .send({ credential: VALID_CREDENTIAL })
      .expect(200);
    expect(allowed.body.user).toMatchObject({ email: "unverified@example.com" });
    expect(String(allowed.headers["set-cookie"])).toContain("HttpOnly");
  });
});

describe("GET /auth/providers when Google is configured (e2e)", () => {
  let app: INestApplication;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const clientId = "test-google-client-id.apps.googleusercontent.com";

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "true";
    process.env.GOOGLE_CLIENT_ID = clientId;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
  });

  it("trả enabled kèm clientId khi chưa đăng nhập", async () => {
    const response = await request(app.getHttpServer()).get("/auth/providers").expect(200);

    expect(response.body).toEqual({ google: { enabled: true, clientId } });
  });
});

describe("GET /auth/providers when Google is not configured (e2e)", () => {
  let app: INestApplication;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "true";
    process.env.GOOGLE_CLIENT_ID = "";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
  });

  it("trả enabled false và không lộ clientId", async () => {
    const response = await request(app.getHttpServer()).get("/auth/providers").expect(200);

    expect(response.body).toEqual({ google: { enabled: false } });
    expect(response.body.google).not.toHaveProperty("clientId");
  });
});

describe("GET /auth/providers when GOOGLE_CLIENT_ID is whitespace (e2e)", () => {
  let app: INestApplication;
  const previousClientId = process.env.GOOGLE_CLIENT_ID;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = "true";
    process.env.GOOGLE_CLIENT_ID = "   ";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
  });

  it("trả enabled false và không lộ clientId", async () => {
    const response = await request(app.getHttpServer()).get("/auth/providers").expect(200);

    expect(response.body).toEqual({ google: { enabled: false } });
    expect(response.body.google).not.toHaveProperty("clientId");
  });
});
