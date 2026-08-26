import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthTokens {
  accessToken: string;
  /** Chuỗi thô, chỉ trả về một lần để đặt vào cookie. DB chỉ giữ hash. */
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string };
}

const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
/**
 * Chuỗi khớp `DUMMY_PASSWORD_HASH`. Chỉ để compare giả trên tài khoản không
 * mật khẩu — không phải mật khẩu đăng nhập.
 */
export const DUMMY_PASSWORD_PLAINTEXT =
  "db9de9360de62933e7b97748121682b672eeccbf44c1a6c14d6f47417b6329d4";
/** Hash bcrypt 12 vòng có sẵn — compare giả trên tài khoản không mật khẩu. */
const DUMMY_PASSWORD_HASH = "$2b$12$NXX.aAVdMUS6dzfbpjqg..L7YTdOtGpq1SXmH.755v4rpH456moE2";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string): Promise<AuthResult> {
    const normalized = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException("Email already registered");

    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      },
    });

    return { user: { id: user.id, email: user.email }, ...(await this.issueTokens(user.id)) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Cùng một thông báo cho email sai, mật khẩu sai, và tài khoản chỉ có
    // Google — để không tiết lộ email nào đã đăng ký hay dùng Google.
    // Email chưa đăng ký vẫn trả về ngay (như trước). Nhánh hash null chạy
    // bcrypt.compare giả để thời gian phản hồi không lộ tài khoản Google.
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const matches = await bcrypt.compare(password, user.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (user.passwordHash === null || !matches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return { user: { id: user.id, email: user.email }, ...(await this.issueTokens(user.id)) };
  }

  /**
   * Đổi refresh token lấy cặp mới; token cũ bị thu hồi ngay (rotation).
   *
   * Trả về cả `user` vì đây cũng là lúc web khôi phục phiên sau khi tải lại
   * trang: chỉ có token thì app biết mình đã đăng nhập mà không biết là ai.
   */
  async refresh(rawToken: string | undefined): Promise<AuthResult> {
    const stored = await this.findValidRefreshToken(rawToken);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException("Invalid refresh token");

    return { user: { id: user.id, email: user.email }, ...(await this.issueTokens(user.id)) };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async findValidRefreshToken(rawToken: string | undefined) {
    if (!rawToken) throw new UnauthorizedException("Missing refresh token");

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return stored;
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const refreshToken = randomBytes(32).toString("hex");

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    return { accessToken, refreshToken };
  }
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
