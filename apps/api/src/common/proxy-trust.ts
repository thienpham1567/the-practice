import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

/**
 * Trên Render, API đứng sau proxy: không đặt `trust proxy` thì `req.ip` là IP của
 * proxy, và mọi rate limit theo IP gộp toàn bộ người dùng vào một hạn mức.
 *
 * Số tầng phải khớp đúng hạ tầng — `true` hay số quá lớn cho client tự điền
 * X-Forwarded-For để né giới hạn. Vì vậy lấy từ env thay vì đoán trong code:
 * bật LOG_FORWARDED_IPS, đọc log một request thật, rồi đặt TRUST_PROXY_HOPS.
 */
export function parseTrustProxyHops(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1 || hops > 5) {
    throw new Error(`TRUST_PROXY_HOPS must be an integer from 1 to 5, got "${raw}"`);
  }
  return hops;
}

export function configureProxyTrust(
  app: Pick<NestExpressApplication, "set" | "use">,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const hops = parseTrustProxyHops(env.TRUST_PROXY_HOPS);
  if (hops !== null) app.set("trust proxy", hops);

  // Chỉ để xác minh chuỗi proxy — IP là dữ liệu cá nhân, tắt lại sau khi đọc xong.
  if (env.LOG_FORWARDED_IPS === "true") {
    const logger = new Logger("ProxyTrust");
    app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.log(
        [
          "event=forwarded",
          `path=${req.path}`,
          `remote=${req.socket.remoteAddress ?? "-"}`,
          `xff="${req.header("x-forwarded-for") ?? ""}"`,
          `cf=${req.header("cf-connecting-ip") ?? "-"}`,
          `true_client=${req.header("true-client-ip") ?? "-"}`,
          `ip=${req.ip ?? "-"}`,
          `hops=${hops ?? "unset"}`,
        ].join(" "),
      );
      next();
    });
  }
}
