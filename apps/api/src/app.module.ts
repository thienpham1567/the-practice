import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { DocumentsModule } from "./documents/documents.module";
import { HealthController } from "./health.controller";
import { PracticeModule } from "./practice/practice.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Ngưỡng mặc định rộng rãi; route auth và AI rewrite siết riêng bằng @Throttle.
    // `global: true`: forRoot() không tự global hóa provider của nó, mà
    // AiModule cần ThrottlerStorage để dựng UserThrottlerGuard riêng theo user
    // thay vì theo IP — không muốn import lại ThrottlerModule (và cấu hình)
    // ở từng module dùng tới nó.
    {
      ...ThrottlerModule.forRoot({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        // Bộ e2e chính dùng chung một IP nên sẽ tự chặn mình. Giới hạn thật
        // được kiểm chứng riêng ở throttle.e2e-spec.
        skipIf: () => process.env.DISABLE_RATE_LIMIT === "true",
      }),
      global: true,
    },
    PrismaModule,
    AuthModule,
    DocumentsModule,
    PracticeModule,
    AiModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
