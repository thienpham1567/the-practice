import express from "express";
import request from "supertest";
import { configureProxyTrust, parseTrustProxy, RENDER_TRUSTED_PROXIES } from "./proxy-trust";

describe("parseTrustProxy", () => {
  it("is off when unset or blank", () => {
    expect(parseTrustProxy(undefined)).toBeNull();
    expect(parseTrustProxy("  ")).toBeNull();
  });

  it("expands the render preset", () => {
    expect(parseTrustProxy("render")).toBe(RENDER_TRUSTED_PROXIES);
  });

  it("accepts an explicit list", () => {
    expect(parseTrustProxy("loopback, 10.0.0.0/8")).toEqual(["loopback", "10.0.0.0/8"]);
  });

  it("refuses anything that trusts client-supplied X-Forwarded-For", () => {
    expect(() => parseTrustProxy("true")).toThrow();
    expect(() => parseTrustProxy("2")).toThrow();
    expect(() => parseTrustProxy("loopback, 0.0.0.0/0")).toThrow();
    expect(() => parseTrustProxy("::/0")).toThrow();
  });

  it("never trusts the ranges every Render customer service egresses from", () => {
    expect(RENDER_TRUSTED_PROXIES).not.toContain("74.220.48.0/20");
    expect(RENDER_TRUSTED_PROXIES).not.toContain("74.220.52.0/24");
    expect(RENDER_TRUSTED_PROXIES).not.toContain("74.220.60.0/24");
  });
});

/**
 * Chuỗi X-Forwarded-For thật, chép từ log production ngày 2026-09-25 (remote
 * luôn là ::1). IP người dùng là 115.78.5.187.
 */
describe("configureProxyTrust with the render preset", () => {
  function appWithTrust(env: NodeJS.ProcessEnv) {
    const app = express();
    configureProxyTrust(app as never, env);
    app.get("/ip", (req, res) => {
      res.json({ ip: req.ip });
    });
    return app;
  }

  const client = "115.78.5.187";
  const chains = {
    viaWebRewrite:
      "115.78.5.187, 162.159.120.170, 162.159.120.170,74.220.48.250, 104.22.66.166, 10.24.101.1",
    viaWebRewriteOtherEdges:
      "115.78.5.187, 104.22.160.34, 104.22.160.34,74.220.48.251, 162.158.170.236, 10.24.101.1",
    directToApi: "115.78.5.187, 172.70.143.199, 10.24.101.1",
    spoofedByClient:
      "6.6.6.6,115.78.5.187, 104.22.160.34, 104.22.160.34,74.220.48.251, 104.22.66.166, 10.24.101.1",
  };

  it.each(Object.entries(chains))("finds the real client on %s", async (_name, xff) => {
    const response = await request(appWithTrust({ TRUST_PROXY: "render" }))
      .get("/ip")
      .set("X-Forwarded-For", xff);
    expect(response.body.ip).toBe(client);
  });

  it("does not let a Render customer's service forge the client", async () => {
    // Service khác trên Render (74.220.52.x) tự gửi header giả qua Cloudflare.
    const response = await request(appWithTrust({ TRUST_PROXY: "render" }))
      .get("/ip")
      .set("X-Forwarded-For", "6.6.6.6, 74.220.52.9, 172.70.143.199, 10.24.101.1");
    expect(response.body.ip).toBe("74.220.52.9");
  });

  it("changes nothing when unset: every request is the local proxy", async () => {
    const response = await request(appWithTrust({}))
      .get("/ip")
      .set("X-Forwarded-For", chains.directToApi);
    expect(response.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});
