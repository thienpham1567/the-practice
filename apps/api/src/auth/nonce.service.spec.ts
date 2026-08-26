import { Logger, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PrismaService } from "../prisma/prisma.service";
import { NonceService } from "./nonce.service";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function serviceWith() {
  const prisma = {
    authNonce: {
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const service = new NonceService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe("NonceService", () => {
  describe("issue", () => {
    it("returns a different raw nonce on each call", async () => {
      const { service } = serviceWith();

      const first = await service.issue();
      const second = await service.issue();

      expect(first).not.toBe(second);
    });

    it("stores a hash of the nonce, not the raw string", async () => {
      const { service, prisma } = serviceWith();

      const raw = await service.issue();

      expect(prisma.authNonce.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nonceHash: hashToken(raw),
          }),
        }),
      );
      expect(prisma.authNonce.create.mock.calls[0]?.[0].data.nonceHash).not.toBe(raw);
    });

    it("sets expiry five minutes from now", async () => {
      const { service, prisma } = serviceWith();
      const before = Date.now();

      await service.issue();

      const after = Date.now();
      const expiresAt = prisma.authNonce.create.mock.calls[0]?.[0].data.expiresAt as Date;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    });

    it("deletes expired nonces before creating a new one", async () => {
      const { service, prisma } = serviceWith();
      const before = Date.now();

      await service.issue();

      const after = Date.now();
      expect(prisma.authNonce.deleteMany).toHaveBeenCalledTimes(1);
      const where = prisma.authNonce.deleteMany.mock.calls[0]?.[0].where as {
        expiresAt: { lte: Date };
      };
      expect(where.expiresAt.lte.getTime()).toBeGreaterThanOrEqual(before);
      expect(where.expiresAt.lte.getTime()).toBeLessThanOrEqual(after);
      expect(prisma.authNonce.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.authNonce.create.mock.invocationCallOrder[0]!,
      );
    });
  });

  describe("consume", () => {
    const SESSION_EXPIRED = "Sign-in session expired. Please try again.";

    beforeEach(() => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("rejects a second consume of the same nonce", async () => {
      const { service, prisma } = serviceWith();
      prisma.authNonce.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.consume("raw-nonce-value")).resolves.toBeUndefined();

      const replay = await service.consume("raw-nonce-value").catch((error: unknown) => error);
      expect(replay).toBeInstanceOf(UnauthorizedException);
      expect((replay as UnauthorizedException).message).toBe(SESSION_EXPIRED);
      const logged = (Logger.prototype.warn as jest.Mock).mock.calls
        .flat()
        .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
        .join(" ");
      expect(logged).toContain("google_denied");
      expect(logged).toContain("nonce_invalid");
      expect(logged).not.toContain("raw-nonce-value");
    });

    it("rejects an expired nonce", async () => {
      const { service, prisma } = serviceWith();
      prisma.authNonce.updateMany.mockResolvedValue({ count: 0 });

      const error = await service.consume("stale").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(SESSION_EXPIRED);
      expect(prisma.authNonce.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            usedAt: null,
            expiresAt: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it("rejects a nonce that does not exist", async () => {
      const { service, prisma } = serviceWith();
      prisma.authNonce.updateMany.mockResolvedValue({ count: 0 });

      const error = await service.consume("missing").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(SESSION_EXPIRED);
      expect(prisma.authNonce.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nonceHash: hashToken("missing"),
          }),
        }),
      );
    });
  });
});
