import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { AiService } from "./ai.service";

/** Chặn theo quota ngày (UTC) trước khi gọi OpenRouter. */
@Injectable()
export class DailyAiQuotaGuard implements CanActivate {
  constructor(private readonly ai: AiService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.ai.assertWithinDailyQuota(request.user.id);
    return true;
  }
}
