import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";
import { configureBodyParser } from "./configure-body-parser";

async function bootstrap(): Promise<void> {
  // bodyParser: false — we install path-specific JSON limits in configureBodyParser.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureBodyParser(app);
  configureApp(app);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  // Cho phép PrismaService.onModuleDestroy chạy khi SIGTERM (Render restart).
  app.enableShutdownHooks();

  // Cố tình không dùng tên `PORT`: tiến trình cha (vd dev server của web) hay
  // đặt sẵn biến đó, mà dotenv không ghi đè biến môi trường đã tồn tại — API sẽ
  // im lặng chiếm nhầm cổng của web.
  await app.listen(Number(process.env.API_PORT ?? 3000));
}

void bootstrap();
