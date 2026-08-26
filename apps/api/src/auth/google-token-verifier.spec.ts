import { Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { OAuth2Client } from "google-auth-library";
import { GoogleTokenVerifier } from "./google-token-verifier";

const CLIENT_ID = "google-client-id.apps.googleusercontent.com";

function verifierWith(
  payload: Record<string, unknown> | undefined,
  options: { clientId?: string; configured?: boolean; verifyError?: Error } = {},
) {
  const verifyIdToken = jest.fn();
  if (options.verifyError) {
    verifyIdToken.mockRejectedValue(options.verifyError);
  } else {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload });
  }

  const googleClientId = options.configured === false ? undefined : (options.clientId ?? CLIENT_ID);
  const config = {
    get: jest.fn((key: string) => (key === "GOOGLE_CLIENT_ID" ? googleClientId : undefined)),
    getOrThrow: jest.fn(),
  };

  const verifier = new GoogleTokenVerifier(
    config as unknown as ConfigService,
    { verifyIdToken } as unknown as OAuth2Client,
  );

  return { verifier, verifyIdToken };
}

describe("GoogleTokenVerifier", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("verify", () => {
    it("calls verifyIdToken with the ID token and GOOGLE_CLIENT_ID audience", async () => {
      const { verifier, verifyIdToken } = verifierWith({
        sub: "google-user-123",
        email: "user@example.com",
        email_verified: true,
      });

      const result = await verifier.verify("raw-id-token");

      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: "raw-id-token",
        audience: CLIENT_ID,
      });
      expect(result.googleId).toBe("google-user-123");
    });

    it("normalizes email with trim and lowercase like register()", async () => {
      const { verifier } = verifierWith({
        sub: "google-user-123",
        email: "  Foo@Example.COM  ",
        email_verified: true,
      });

      const result = await verifier.verify("raw-id-token");

      expect(result.email).toBe("foo@example.com");
    });

    it("passes emailVerified true through without rejecting", async () => {
      const { verifier } = verifierWith({
        sub: "google-user-123",
        email: "user@example.com",
        email_verified: true,
      });

      const result = await verifier.verify("raw-id-token");

      expect(result.emailVerified).toBe(true);
    });

    it("passes emailVerified false through without rejecting", async () => {
      const { verifier } = verifierWith({
        sub: "google-user-123",
        email: "user@example.com",
        email_verified: false,
      });

      const result = await verifier.verify("raw-id-token");

      expect(result.emailVerified).toBe(false);
    });

    it("passes nonce through when present on the payload", async () => {
      const { verifier } = verifierWith({
        sub: "google-user-123",
        email: "user@example.com",
        email_verified: true,
        nonce: "server-issued-nonce",
      });

      const result = await verifier.verify("raw-id-token");

      expect(result.nonce).toBe("server-issued-nonce");
    });

    it("maps an invalid signature to a generic UnauthorizedException", async () => {
      await expectGenericUnauthorized("Invalid token signature");
    });

    it("maps a wrong audience to a generic UnauthorizedException", async () => {
      await expectGenericUnauthorized("Wrong recipient, payload audience != requiredAudience");
    });

    it("maps an expired token to a generic UnauthorizedException", async () => {
      await expectGenericUnauthorized("Token used too late, 1000 > 100");
    });

    it("throws 503 when GOOGLE_CLIENT_ID is only whitespace and does not call Google", async () => {
      const { verifier, verifyIdToken } = verifierWith(
        { sub: "google-user-123", email: "user@example.com" },
        { clientId: "   " },
      );

      const error = await verifier.verify("raw-id-token").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).message).toBe(
        "Google sign-in is not configured",
      );
      expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it("trims GOOGLE_CLIENT_ID before using it as the audience", async () => {
      const { verifier, verifyIdToken } = verifierWith(
        { sub: "google-user-123", email: "user@example.com", email_verified: true },
        { clientId: `  ${CLIENT_ID}  ` },
      );

      await verifier.verify("raw-id-token");

      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: "raw-id-token",
        audience: CLIENT_ID,
      });
    });

    it("throws 503 when GOOGLE_CLIENT_ID is missing and does not call Google", async () => {
      const { verifier, verifyIdToken } = verifierWith(
        { sub: "google-user-123", email: "user@example.com" },
        { configured: false },
      );

      const error = await verifier.verify("raw-id-token").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).message).toBe(
        "Google sign-in is not configured",
      );
      expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it("maps a payload missing sub to a generic UnauthorizedException", async () => {
      const { verifier } = verifierWith({
        email: "user@example.com",
        email_verified: true,
      });

      const error = await verifier.verify("raw-id-token").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe("Invalid Google credential");
    });

    it("maps a payload missing email to a generic UnauthorizedException", async () => {
      const { verifier } = verifierWith({
        sub: "google-user-123",
        email_verified: true,
      });

      const error = await verifier.verify("raw-id-token").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe("Invalid Google credential");
    });
  });
});

async function expectGenericUnauthorized(libraryMessage: string) {
  const { verifier } = verifierWith(undefined, { verifyError: new Error(libraryMessage) });

  const error = await verifier.verify("raw-id-token").catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(UnauthorizedException);
  expect((error as UnauthorizedException).message).toBe("Invalid Google credential");
  expect((error as UnauthorizedException).message).not.toContain(libraryMessage);
}
