import { configureProxyTrust, parseTrustProxyHops } from "./proxy-trust";

describe("parseTrustProxyHops", () => {
  it("is off when unset or blank", () => {
    expect(parseTrustProxyHops(undefined)).toBeNull();
    expect(parseTrustProxyHops("  ")).toBeNull();
  });

  it("accepts a small hop count", () => {
    expect(parseTrustProxyHops("1")).toBe(1);
    expect(parseTrustProxyHops("2")).toBe(2);
  });

  it("refuses values that would trust client-supplied headers", () => {
    // "true" tin cả chuỗi X-Forwarded-For do client tự điền.
    expect(() => parseTrustProxyHops("true")).toThrow();
    expect(() => parseTrustProxyHops("0")).toThrow();
    expect(() => parseTrustProxyHops("1.5")).toThrow();
    expect(() => parseTrustProxyHops("99")).toThrow();
  });
});

describe("configureProxyTrust", () => {
  function fakeApp() {
    return { set: jest.fn(), use: jest.fn() };
  }

  it("changes nothing by default", () => {
    const app = fakeApp();
    configureProxyTrust(app as never, {});
    expect(app.set).not.toHaveBeenCalled();
    expect(app.use).not.toHaveBeenCalled();
  });

  it("sets trust proxy to the configured hop count", () => {
    const app = fakeApp();
    configureProxyTrust(app as never, { TRUST_PROXY_HOPS: "2" });
    expect(app.set).toHaveBeenCalledWith("trust proxy", 2);
  });

  it("adds the forwarded-IP log only when asked", () => {
    const app = fakeApp();
    configureProxyTrust(app as never, { LOG_FORWARDED_IPS: "true" });
    expect(app.use).toHaveBeenCalledTimes(1);
  });
});
