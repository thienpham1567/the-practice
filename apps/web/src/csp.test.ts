import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CSP trong render.yaml chỉ cho phép script inline có đúng hash. Sửa script chọn
 * theme trong index.html mà quên cập nhật hash thì trang sẽ mất theme lúc tải
 * (khi CSP chuyển sang chặn thật) — test này bắt lỗi đó từ sớm.
 */
const root = resolve(__dirname, "../../..");
const indexHtml = readFileSync(resolve(root, "apps/web/index.html"), "utf8");
const renderYaml = readFileSync(resolve(root, "render.yaml"), "utf8");

function cspValue(): string {
  const match = renderYaml.match(
    /name: Content-Security-Policy(?:-Report-Only)?\s+value: "([^"]+)"/,
  );
  if (!match?.[1]) throw new Error("CSP header not found in render.yaml");
  return match[1];
}

describe("web CSP", () => {
  it("allows every inline script in index.html by hash", () => {
    const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(inline.length).toBeGreaterThan(0);
    for (const script of inline) {
      const hash = createHash("sha256").update(script).digest("base64");
      expect(cspValue()).toContain(`'sha256-${hash}'`);
    }
  });

  it("never allows unsafe inline or eval scripts", () => {
    const scriptSrc = cspValue()
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("enforces the policy rather than only reporting it", () => {
    expect(renderYaml).toMatch(/name: Content-Security-Policy\s+value:/);
    expect(renderYaml).not.toContain("Content-Security-Policy-Report-Only");
  });

  it("forbids framing the app", () => {
    expect(cspValue()).toContain("frame-ancestors 'none'");
    expect(renderYaml).toMatch(/name: X-Frame-Options\s+value: DENY/);
  });
});
