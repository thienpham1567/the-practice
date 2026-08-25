import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

interface RequestWithOptionalUser {
  ip?: string;
  user?: { id: string };
}

/**
 * ThrottlerGuard mặc định đếm theo IP — hợp cho route auth (chưa có user để
 * đếm theo), nhưng AI rewrite đã yêu cầu đăng nhập, và giới hạn theo IP sẽ gộp
 * nhầm nhiều người dùng sau cùng một NAT/proxy vào một hạn mức.
 *
 * Đặt sau `JwtAuthGuard` trong `@UseGuards` để `req.user` đã có sẵn khi guard
 * này chạy.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: RequestWithOptionalUser): Promise<string> {
    return Promise.resolve(req.user?.id ?? req.ip ?? "unknown");
  }
}
