import { Logger, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";
import type { GoogleTokenVerifier } from "./google-token-verifier";
import type { NonceService } from "./nonce.service";

function loggedText(): string {
  return [...(Logger.prototype.warn as jest.Mock).mock.calls]
    .flat()
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
}

describe("AuthController", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("google", () => {
    it("rejects an unverified email without loginWithGoogle or nonce consume", async () => {
      const auth = {
        loginWithGoogle: jest.fn().mockResolvedValue({
          accessToken: "access",
          refreshToken: "refresh",
          user: { id: "1", email: "writer@example.com" },
        }),
      };
      const nonce = { consume: jest.fn(), issue: jest.fn() };
      const config = { get: jest.fn() };
      const googleVerifier = {
        verify: jest.fn().mockResolvedValue({
          googleId: "google-sub-1",
          email: "writer@example.com",
          emailVerified: false,
          nonce: "issued-nonce",
        }),
      };
      const controller = new AuthController(
        auth as unknown as AuthService,
        nonce as unknown as NonceService,
        config as unknown as ConfigService,
        googleVerifier as unknown as GoogleTokenVerifier,
      );

      const error = await controller
        .google({ credential: "jwt" }, { cookie: jest.fn() } as unknown as Response)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(
        "Your Google account's email is not verified.",
      );
      expect(auth.loginWithGoogle).not.toHaveBeenCalled();
      expect(nonce.consume).not.toHaveBeenCalled();
      expect(loggedText()).toContain("google_denied");
      expect(loggedText()).toContain("unverified_email");
      expect(loggedText()).toContain("writer@example.com");
      expect(loggedText()).not.toMatch(/issued-nonce|credential|jwt/i);
    });
  });

  describe("providers", () => {
    function controllerWithClientId(clientId: string | undefined) {
      return new AuthController(
        {} as AuthService,
        {} as NonceService,
        { get: jest.fn().mockReturnValue(clientId) } as unknown as ConfigService,
        {} as GoogleTokenVerifier,
      );
    }

    it("treats a whitespace-only client id as disabled and omits clientId", () => {
      expect(controllerWithClientId("   ").providers()).toEqual({ google: { enabled: false } });
    });

    it("trims a configured client id", () => {
      expect(controllerWithClientId("  real-client-id  ").providers()).toEqual({
        google: { enabled: true, clientId: "real-client-id" },
      });
    });
  });
});
