import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { DailyAiQuotaGuard } from "./daily-ai-quota.guard";
import { UserThrottlerGuard } from "./user-throttler.guard";

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, UserThrottlerGuard, DailyAiQuotaGuard],
  exports: [AiService, UserThrottlerGuard, DailyAiQuotaGuard],
})
export class AiModule {}
