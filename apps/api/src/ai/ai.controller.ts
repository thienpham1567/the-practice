import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiService } from "./ai.service";
import { RewriteDto } from "./dto/rewrite.dto";
import { UserThrottlerGuard } from "./user-throttler.guard";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Không cần đăng nhập: web đọc route này lúc khởi động để quyết định có hiện nút "Fix with AI" hay không. */
  @Get("status")
  status(): { enabled: boolean } {
    return { enabled: this.ai.isEnabled() };
  }

  @Post("rewrite")
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  rewrite(@Body() dto: RewriteDto): Promise<{ suggestions: string[] }> {
    return this.ai.rewrite(dto);
  }
}
