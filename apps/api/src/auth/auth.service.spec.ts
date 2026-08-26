import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

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
});
