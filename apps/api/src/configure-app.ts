import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { RequestAwareLogger } from "./common/request-aware-logger";
import { requestIdMiddleware } from "./common/request-id.middleware";

/**
 * Shared HTTP middleware / pipes for Nest bootstrap and e2e.
 * CORS and shutdown hooks stay in main.ts (process concerns).
 */
export function configureApp(app: NestExpressApplication): void {
  app.useLogger(new RequestAwareLogger());
  app.use(requestIdMiddleware);
  // API returns JSON only; GIS loads on the separate web origin. Disable CSP so
  // a default helmet policy never blocks accounts.google.com if this process
  // ever serves HTML.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
