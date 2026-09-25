import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

/**
 * Trên Render, API đứng sau nhiều tầng proxy: không đặt `trust proxy` thì
 * `req.ip` là `::1` (proxy nội bộ trên instance) cho mọi request, và mọi rate
 * limit theo IP gộp toàn bộ người dùng vào một hạn mức.
 *
 * Không dùng số tầng: log production (2026-09-25) cho thấy đường qua web
 * (`/api/*` rewrite) có 6 tầng trước IP thật, gọi thẳng domain API chỉ có 3 —
 * số nào cũng sai một đường, và số lớn cho client tự điền X-Forwarded-For. Thay
 * vào đó tin đúng các địa chỉ là proxy; Express đi ngược chuỗi và dừng ở địa
 * chỉ đầu tiên không được tin — đó là IP người dùng, dù trước nó có gì.
 */
export const RENDER_TRUSTED_PROXIES = [
  // Proxy chạy cùng instance (remote luôn là ::1) và mạng nội bộ Render.
  "loopback",
  "10.0.0.0/8",
  // Proxy rewrite /api/* của static site (whois: Render, 74.220.48.0/20).
  // Chỉ /24 này: 74.220.52.0/24 và 74.220.60.0/24 là IP gửi ra của mọi service
  // khách hàng ở Singapore — tin chúng là để service lạ giả được header.
  "74.220.48.0/24",
  // Cloudflare đứng trước cả static site lẫn API — https://www.cloudflare.com/ips/
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

/**
 * `TRUST_PROXY=render` → RENDER_TRUSTED_PROXIES; hoặc danh sách địa chỉ/CIDR
 * cách nhau bởi dấu phẩy. Từ chối mọi thứ khiến Express tin cả chuỗi do client
 * gửi: `true`, số tầng, `0.0.0.0/0`, `::/0`.
 */
export function parseTrustProxy(raw: string | undefined): string[] | null {
  if (raw === undefined || raw.trim() === "") return null;
  if (raw.trim() === "render") return RENDER_TRUSTED_PROXIES;

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  for (const entry of entries) {
    if (entry === "true" || /^\d+$/.test(entry) || entry === "0.0.0.0/0" || entry === "::/0") {
      throw new Error(`TRUST_PROXY must list proxy addresses or CIDRs, got "${entry}"`);
    }
  }
  return entries;
}

export function configureProxyTrust(
  app: Pick<NestExpressApplication, "set" | "use">,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const trusted = parseTrustProxy(env.TRUST_PROXY);
  // Express kiểm từng địa chỉ ngay lúc set — sai định dạng thì API không khởi động.
  if (trusted !== null) app.set("trust proxy", trusted);

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
          `trust=${trusted === null ? "unset" : trusted === RENDER_TRUSTED_PROXIES ? "render" : "custom"}`,
        ].join(" "),
      );
      next();
    });
  }
}
