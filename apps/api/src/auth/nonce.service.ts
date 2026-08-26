import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

const NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * Nonce một lần cho Google Sign-In. Lưu hash chứ không lưu chuỗi gốc —
 * cùng lý do với RefreshToken: rò rỉ DB không cho phát lại phiên.
 */
@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issue(): Promise<string> {
    const raw = randomBytes(32).toString("hex");

    await this.prisma.authNonce.create({
      data: {
        nonceHash: hashNonce(raw),
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      },
    });

    // Cleanup không chặn phát hành nonce — một round-trip DB trên đường nóng.
    void this.prisma.authNonce
      .deleteMany({
        where: { expiresAt: { lte: new Date() } },
      })
      .catch(() => undefined);

    return raw;
  }

  async consume(nonce: string): Promise<void> {
    const now = new Date();
    const result = await this.prisma.authNonce.updateMany({
      where: {
        nonceHash: hashNonce(nonce),
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (result.count === 0) {
      this.logger.warn("event=google_denied reason=nonce_invalid");
      throw new UnauthorizedException("Sign-in session expired. Please try again.");
    }
  }
}

function hashNonce(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
