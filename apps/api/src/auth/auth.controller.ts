import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, REFRESH_TOKEN_TTL_MS } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto/credentials.dto";
import { NonceService } from "./nonce.service";

const REFRESH_COOKIE = "refresh_token";

/**
 * Phạm vi hẹp hơn (ví dụ "/auth") nghe có vẻ chặt hơn, nhưng nó giả định API
 * nằm ngay gốc domain. Ở dev, web gọi qua proxy tại "/api/auth/..." nên đường
 * dẫn không khớp và trình duyệt lặng lẽ không gửi cookie — phiên đăng nhập mất
 * sau mỗi lần tải lại trang. Sau reverse proxy ở production cũng vậy.
 * httpOnly + sameSite mới là thứ thật sự bảo vệ cookie này.
 */
const COOKIE_PATH = "/";

/** 10 request mỗi phút cho mọi route auth. */
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly nonce: NonceService,
    private readonly config: ConfigService,
  ) {}

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const { refreshToken, ...rest } = await this.auth.register(dto.email, dto.password);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const { refreshToken, ...rest } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const { refreshToken, ...rest } = await this.auth.refresh(readRefreshCookie(req));
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  @Get("google/nonce")
  async issueGoogleNonce(): Promise<{ nonce: string }> {
    return { nonce: await this.nonce.issue() };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }
}

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}
