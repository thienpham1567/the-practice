import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiService } from "./ai.service";
import { DailyAiQuotaGuard } from "./daily-ai-quota.guard";
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

  @Get("usage")
  @UseGuards(JwtAuthGuard)
  usage(@CurrentUserId() userId: string) {
    return this.ai.usageSummary(userId);
  }

  @Post("rewrite")
  @UseGuards(JwtAuthGuard, UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  rewrite(
    @CurrentUserId() userId: string,
    @Body() dto: RewriteDto,
  ): Promise<{ suggestions: string[] }> {
    return this.ai.rewrite(userId, dto);
  }
}
