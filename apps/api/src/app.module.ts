import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Ngưỡng mặc định rộng rãi; route auth siết riêng bằng @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      // Bộ e2e chính dùng chung một IP nên sẽ tự chặn mình sau 10 lần gọi auth.
      // Giới hạn thật được kiểm chứng riêng ở throttle.e2e-spec.
      skipIf: () => process.env.DISABLE_RATE_LIMIT === "true",
    }),
    PrismaModule,
    AuthModule,
    DocumentsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
