import { afterEach, describe, expect, it, vi } from "vitest";

const fake = { captureException: vi.fn(), setUser: vi.fn() };
vi.mock("./instrument", () => ({ Sentry: fake }));

async function freshModule() {
  vi.resetModules();
  return import("./sentry");
}

describe("sentry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    fake.captureException.mockReset();
    fake.setUser.mockReset();
  });

  it("groups attempt URLs by route", async () => {
    const { routeName } = await freshModule();
    expect(routeName("/writing/cm1abc")).toBe("/writing/:id");
    expect(routeName("/speaking/cm1abc/")).toBe("/speaking/:id");
    expect(routeName("/doc/42")).toBe("/doc/:id");
    expect(routeName("/writing")).toBe("/writing");
    expect(routeName("/")).toBe("/");
  });

  it("does nothing without a DSN", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.useFakeTimers();
    const { startSentry, captureException } = await freshModule();
    startSentry();
    captureException(new Error("early"));
    await vi.runAllTimersAsync();
    expect(fake.captureException).not.toHaveBeenCalled();
  });

  it("queues errors and the user until the SDK loads, then sends them", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o0.ingest.sentry.io/0");
    vi.useFakeTimers();
    const { startSentry, captureException, setSentryUser } = await freshModule();

    startSentry();
    const boom = new Error("before load");
    window.dispatchEvent(new ErrorEvent("error", { error: boom }));
    captureException(new Error("from boundary"), "  at Page");
    setSentryUser("u1");
    expect(fake.captureException).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(fake.setUser).toHaveBeenCalledWith({ id: "u1" });
    expect(fake.captureException).toHaveBeenCalledWith(boom, undefined);
    expect(fake.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "from boundary" }),
      {
        contexts: { react: { componentStack: "  at Page" } },
      },
    );

    // Sau khi nạp: gửi thẳng, và bỏ user khi đăng xuất.
    captureException(new Error("after load"));
    setSentryUser(null);
    expect(fake.captureException).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "after load" }),
      undefined,
    );
    expect(fake.setUser).toHaveBeenLastCalledWith(null);
  });
});
