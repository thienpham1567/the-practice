import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

const READY_TIMEOUT_MS = 2_000;

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Tiến trình còn sống — không chạm DB. */
  @Get("live")
  live(): { status: string } {
    return { status: "ok" };
  }

  /** Sẵn sàng nhận traffic — `SELECT 1` với timeout 2s. */
  @Get("ready")
  async ready(): Promise<{ status: string }> {
    await this.pingDb();
    return { status: "ok" };
  }

  /** Alias của `ready` — giữ tương thích health check cũ. */
  @Get()
  check(): Promise<{ status: string }> {
    return this.ready();
  }

  private async pingDb(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("health check timeout")), READY_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
    } catch {
      throw new ServiceUnavailableException({ status: "error" });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
