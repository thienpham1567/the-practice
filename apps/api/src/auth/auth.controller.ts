import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, REFRESH_TOKEN_TTL_MS, type AuthTokens } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto/credentials.dto";

const REFRESH_COOKIE = "refresh_token";

/** 10 request mỗi phút cho mọi route auth. */
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
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
  ): Promise<{ accessToken: string }> {
    const tokens: AuthTokens = await this.auth.refresh(readRefreshCookie(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      // Cookie chỉ được gửi tới các route auth, không kèm theo mọi request khác.
      path: "/auth",
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }
}

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}
