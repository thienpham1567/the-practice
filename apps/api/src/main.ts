import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

/** Editor state có thể lớn, nhưng 1MB là trần hợp lý cho một document. */
const BODY_LIMIT = "1mb";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });

  app.useBodyParser("json", { limit: BODY_LIMIT });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
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
