import { Logger, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService, DUMMY_PASSWORD_PLAINTEXT } from "./auth.service";

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.9.1",
  });
}

function googleService(options: { users?: StoredUser[]; createError?: Error } = {}) {
  const users = [...(options.users ?? [])];

  const prisma = {
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { googleId?: string; email?: string; id?: string } }) => {
          if (where.googleId !== undefined) {
            return users.find((user) => user.googleId === where.googleId) ?? null;
          }
          if (where.email !== undefined) {
            return users.find((user) => user.email === where.email) ?? null;
          }
          if (where.id !== undefined) {
            return users.find((user) => user.id === where.id) ?? null;
          }
          return null;
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: { email: string; googleId: string; passwordHash: string | null };
        }) => {
          if (options.createError) throw options.createError;
          const user: StoredUser = {
            id: "new-google-user",
            email: data.email,
            googleId: data.googleId,
            passwordHash: data.passwordHash,
          };
          users.push(user);
          return user;
        },
      ),
      update: jest.fn(),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; googleId: null };
          data: { googleId: string };
        }) => {
          const user = users.find(
            (candidate) => candidate.id === where.id && candidate.googleId === where.googleId,
          );
          if (!user) return { count: 0 };
          Object.assign(user, data);
          return { count: 1 };
        },
      ),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const jwt = {
    signAsync: jest.fn().mockResolvedValue("access-token"),
  };

  const config = {
    getOrThrow: jest.fn().mockReturnValue("test-secret"),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  return { service, prisma, users };
}

function verifiedProfile(
  overrides: Partial<{ googleId: string; email: string; emailVerified: boolean }> = {},
) {
  return {
    googleId: "google-sub-1",
    email: "writer@example.com",
    emailVerified: true,
    ...overrides,
  };
}

function loggedText(): string {
  return [
    ...(Logger.prototype.log as jest.Mock).mock.calls,
    ...(Logger.prototype.warn as jest.Mock).mock.calls,
  ]
    .flat()
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
}

function serviceWith(user: { id: string; email: string; passwordHash: string | null } | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const jwt = {
    signAsync: jest.fn().mockResolvedValue("access-token"),
  };

  const config = {
    getOrThrow: jest.fn().mockReturnValue("test-secret"),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  return { service, prisma };
}

async function loginRejection(service: AuthService, email: string, password: string) {
  try {
    await service.login(email, password);
  } catch (error) {
    return error;
  }
  throw new Error("expected login to reject");
}

async function elapsedMs(fn: () => Promise<unknown>): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

describe("AuthService", () => {
  describe("login", () => {
    it("rejects a Google-only account with the same message as a wrong password", async () => {
      const { service: googleOnly } = serviceWith({
        id: "g1",
        email: "google@example.com",
        passwordHash: null,
      });
      const { service: passwordUser } = serviceWith({
        id: "p1",
        email: "password@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 4),
      });

      const googleError = await loginRejection(googleOnly, "google@example.com", "any-password");
      const wrongPasswordError = await loginRejection(
        passwordUser,
        "password@example.com",
        "wrong-password",
      );

      expect(googleError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((googleError as UnauthorizedException).message).toBe(
        (wrongPasswordError as UnauthorizedException).message,
      );
      expect((googleError as UnauthorizedException).message).toBe("Invalid email or password");
    });

    it("rejects a Google-only account even when the dummy bcrypt hash matches", async () => {
      const { service } = serviceWith({
        id: "g1",
        email: "google@example.com",
        passwordHash: null,
      });

      const error = await loginRejection(service, "google@example.com", DUMMY_PASSWORD_PLAINTEXT);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe("Invalid email or password");
    });

    it("does not leak Google-only accounts through login timing", async () => {
      const { service: googleOnly } = serviceWith({
        id: "g1",
        email: "google@example.com",
        passwordHash: null,
      });
      const { service: passwordUser } = serviceWith({
        id: "p1",
        email: "password@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 12),
      });

      const samples = 7;
      const googleTimes: number[] = [];
      const wrongTimes: number[] = [];

      for (let i = 0; i < samples; i++) {
        googleTimes.push(
          await elapsedMs(() => loginRejection(googleOnly, "google@example.com", "any-password")),
        );
        wrongTimes.push(
          await elapsedMs(() =>
            loginRejection(passwordUser, "password@example.com", "wrong-password"),
          ),
        );
      }

      const googleMedian = median(googleTimes);
      const wrongMedian = median(wrongTimes);
      const slower = Math.max(googleMedian, wrongMedian);
      const faster = Math.min(googleMedian, wrongMedian);

      expect(faster).toBeGreaterThan(0);
      expect(slower / faster).toBeLessThan(10);
    }, 60_000);
  });

  describe("loginWithGoogle", () => {
    beforeEach(() => {
      jest.spyOn(Logger.prototype, "log").mockImplementation();
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("rejects an unverified email before any database access", async () => {
      const { service, prisma } = googleService();

      const error = await service
        .loginWithGoogle(verifiedProfile({ emailVerified: false }))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(
        "Your Google account's email is not verified.",
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(loggedText()).toContain("google_denied");
      expect(loggedText()).toContain("unverified_email");
      expect(loggedText()).toContain("writer@example.com");
      expect(loggedText()).not.toMatch(/passwordHash|credential|refresh/i);
    });

    it("creates a passwordless user and returns the same token pair as login", async () => {
      const { service, prisma } = googleService();

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "writer@example.com",
          googleId: "google-sub-1",
          passwordHash: null,
        },
      });
      expect(result.user).toEqual({ id: "new-google-user", email: "writer@example.com" });
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(loggedText()).toContain("google_signup");
      expect(loggedText()).toContain("new-google-user");
      expect(loggedText()).not.toMatch(/passwordHash|credential|nonce/i);
    });

    it("signs in an existing googleId without creating a second user", async () => {
      const existing: StoredUser = {
        id: "existing-id",
        email: "writer@example.com",
        passwordHash: null,
        googleId: "google-sub-1",
      };
      const { service, prisma } = googleService({ users: [existing] });

      const first = await service.loginWithGoogle(verifiedProfile());
      const second = await service.loginWithGoogle(verifiedProfile());

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(first.user.id).toBe("existing-id");
      expect(second.user.id).toBe("existing-id");
      expect(first.accessToken).toBe("access-token");
      expect(second.refreshToken).toEqual(expect.any(String));
      expect(loggedText()).toContain("google_signin");
      expect(loggedText()).toContain("existing-id");
    });

    it("links googleId onto an existing email user without changing id or passwordHash", async () => {
      const existing: StoredUser = {
        id: "password-user",
        email: "writer@example.com",
        passwordHash: "existing-bcrypt-hash",
        googleId: null,
      };
      const { service, prisma, users } = googleService({ users: [existing] });

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(result.user).toEqual({ id: "password-user", email: "writer@example.com" });
      expect(users[0]?.id).toBe("password-user");
      expect(users[0]?.passwordHash).toBe("existing-bcrypt-hash");
      expect(users[0]?.googleId).toBe("google-sub-1");
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "password-user", googleId: null },
        data: { googleId: "google-sub-1" },
      });
      expect(loggedText()).toContain("google_link");
      expect(loggedText()).toContain("password-user");
      expect(loggedText()).not.toContain("existing-bcrypt-hash");
    });

    it("does not steal an account that already has a different googleId", async () => {
      const existing: StoredUser = {
        id: "victim",
        email: "writer@example.com",
        passwordHash: "victim-hash",
        googleId: "original-google-sub",
      };
      const { service, prisma, users } = googleService({ users: [existing] });

      const error = await service
        .loginWithGoogle(verifiedProfile({ googleId: "attacker-sub" }))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe("Invalid Google credential");
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(users[0]?.googleId).toBe("original-google-sub");
      expect(loggedText()).toContain("google_denied");
    });

    it("recovers from a unique-constraint race and still returns a valid session", async () => {
      const raced: StoredUser = {
        id: "winner",
        email: "writer@example.com",
        passwordHash: null,
        googleId: "google-sub-1",
      };
      const { service, prisma } = googleService({
        users: [raced],
        createError: uniqueViolation(),
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(result.user).toEqual({ id: "winner", email: "writer@example.com" });
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(loggedText()).toContain("p2002_recovered");
      expect(loggedText()).toContain("winner");
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it("links googleId when P2002 recovery finds an email user without googleId", async () => {
      const raced: StoredUser = {
        id: "password-winner",
        email: "writer@example.com",
        passwordHash: "existing-bcrypt-hash",
        googleId: null,
      };
      const { service, prisma, users } = googleService({
        users: [raced],
        createError: uniqueViolation(),
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "password-winner", googleId: null },
        data: { googleId: "google-sub-1" },
      });
      expect(users[0]?.id).toBe("password-winner");
      expect(users[0]?.passwordHash).toBe("existing-bcrypt-hash");
      expect(users[0]?.googleId).toBe("google-sub-1");
      expect(result.user).toEqual({ id: "password-winner", email: "writer@example.com" });
      expect(loggedText()).toContain("google_link");
      expect(loggedText()).toContain("p2002_recovered");
    });

    it("signs in when email lookup finds this same googleId after a googleId miss", async () => {
      const existing: StoredUser = {
        id: "already-linked",
        email: "writer@example.com",
        passwordHash: "existing-bcrypt-hash",
        googleId: "google-sub-1",
      };
      const { service, prisma } = googleService({ users: [existing] });
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(result.user).toEqual({ id: "already-linked", email: "writer@example.com" });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(loggedText()).toContain("google_signin");
      expect(loggedText()).not.toContain("google_denied");
    });

    it("signs in when a concurrent link already set this same googleId", async () => {
      const existing: StoredUser = {
        id: "password-user",
        email: "writer@example.com",
        passwordHash: "existing-bcrypt-hash",
        googleId: null,
      };
      const { service, prisma, users } = googleService({ users: [existing] });
      prisma.user.updateMany.mockImplementation(async () => {
        users[0]!.googleId = "google-sub-1";
        return { count: 0 };
      });

      const result = await service.loginWithGoogle(verifiedProfile());

      expect(result.user).toEqual({ id: "password-user", email: "writer@example.com" });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(loggedText()).toContain("google_signin");
      expect(loggedText()).not.toContain("google_denied");
    });

    it("rejects a link when a concurrent write already set googleId", async () => {
      const existing: StoredUser = {
        id: "password-user",
        email: "writer@example.com",
        passwordHash: "existing-bcrypt-hash",
        googleId: null,
      };
      const { service, prisma, users } = googleService({ users: [existing] });
      prisma.user.updateMany.mockImplementation(async () => {
        users[0]!.googleId = "other-sub";
        return { count: 0 };
      });

      const error = await service
        .loginWithGoogle(verifiedProfile())
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe("Invalid Google credential");
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(users[0]?.googleId).toBe("other-sub");
      expect(loggedText()).toContain("google_denied");
    });
  });
});
