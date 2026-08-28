import type { NestExpressApplication } from "@nestjs/platform-express";
import { json, type NextFunction, type Request, type Response } from "express";

/** Default JSON limit for ordinary routes (editor state, practice text, …). */
export const DEFAULT_BODY_LIMIT = "1mb";
/** Speaking submit sends WAV base64 (~5 MB); leave headroom. */
export const SPEAKING_SUBMIT_BODY_LIMIT = "8mb";

const SPEAKING_SUBMIT_PATH = /^\/speaking\/attempts\/[^/]+\/submit\/?$/;

export function isSpeakingSubmitPath(method: string, path: string): boolean {
  return method === "POST" && SPEAKING_SUBMIT_PATH.test(path);
}

/**
 * Path-specific JSON limits: speaking audio submit gets 8mb; everything else 1mb.
 * Call with `bodyParser: false` on NestFactory.create so Nest does not install
 * its own parser first.
 */
export function configureBodyParser(app: NestExpressApplication): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const limit = isSpeakingSubmitPath(req.method, req.path)
      ? SPEAKING_SUBMIT_BODY_LIMIT
      : DEFAULT_BODY_LIMIT;
    return json({ limit })(req, res, next);
  });
}
