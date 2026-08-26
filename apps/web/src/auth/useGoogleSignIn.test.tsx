import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiJson, ApiError } from "../api/client";
import { useAuthStore } from "../api/auth-store";
import { loadGsi } from "./load-gsi";
import { useGoogleSignIn } from "./useGoogleSignIn";

vi.mock("./load-gsi", () => ({
  loadGsi: vi.fn(() => Promise.resolve()),
}));

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
    apiJson: vi.fn(),
  };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function Probe() {
  const google = useGoogleSignIn();
  return (
    <div>
      <span data-testid="status">{google.status}</span>
      <div data-testid="google-button" ref={google.containerRef} />
      {google.error ? <p role="alert">{google.error}</p> : null}
    </div>
  );
}

function Harness() {
  const [, setTick] = useState(0);
  return (
    <div>
      <button type="button" onClick={() => setTick((n) => n + 1)}>
        rerender
      </button>
      <Probe />
    </div>
  );
}

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function googleCredential(
  jwt = "header.payload.sig",
): google.accounts.id.CredentialResponse {
  return { credential: jwt, select_by: "btn" };
}

describe("useGoogleSignIn", () => {
  const initialize = vi.fn();
  const renderButton = vi.fn();
  let credentialCallback: ((response: google.accounts.id.CredentialResponse) => void) | undefined;

  beforeEach(() => {
    credentialCallback = undefined;
    initialize.mockImplementation((config: google.accounts.id.IdConfiguration) => {
      credentialCallback = config.callback;
    });
    renderButton.mockReset();
    initialize.mockClear();
    navigate.mockReset();
    vi.mocked(loadGsi).mockClear();
    vi.mocked(loadGsi).mockResolvedValue(undefined);
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiJson).mockReset();
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === "/auth/providers") {
        return { google: { enabled: true, clientId: "test-client-id" } };
      }
      if (path === "/auth/google/nonce") {
        return { nonce: "nonce-1" };
      }
      throw new Error(`unexpected apiFetch ${path}`);
    });
    vi.mocked(apiJson).mockResolvedValue({
      accessToken: "tok",
      user: { id: "u1", email: "a@b.c" },
    });
    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton,
        },
      },
    } as unknown as typeof window.google;
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("calls initialize once per mount", async () => {
    renderHarness();

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id",
        nonce: "nonce-1",
        use_fedcm_for_prompt: false,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "rerender" }));
    fireEvent.click(screen.getByRole("button", { name: "rerender" }));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"));
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("hides Google sign-in when the provider is disabled", async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === "/auth/providers") return { google: { enabled: false } };
      throw new Error(`unexpected apiFetch ${path}`);
    });

    renderHarness();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("hidden"));
    expect(loadGsi).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
  });

  it("hides Google sign-in when the GIS script fails to load", async () => {
    vi.mocked(loadGsi).mockRejectedValue(new Error("Failed to load Google Sign-In"));

    renderHarness();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("hidden"));
    expect(initialize).not.toHaveBeenCalled();
  });

  it("posts only the credential and ignores a second callback while submitting", async () => {
    let finish: ((value: { accessToken: string; user: { id: string; email: string } }) => void) | undefined;
    vi.mocked(apiJson).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    renderHarness();
    await waitFor(() => expect(credentialCallback).toBeDefined());

    credentialCallback!(googleCredential());
    credentialCallback!(googleCredential());

    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(1));
    expect(apiJson).toHaveBeenCalledWith(
      "/auth/google",
      "POST",
      { credential: "header.payload.sig" },
      expect.any(AbortSignal),
    );

    finish?.({ accessToken: "tok", user: { id: "u1", email: "a@b.c" } });
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().accessToken).toBe("tok");
  });

  it("does not set session after unmount aborts an in-flight sign-in", async () => {
    vi.mocked(apiJson).mockImplementation(
      (_path, _method, _body, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    const { unmount } = renderHarness();
    await waitFor(() => expect(credentialCallback).toBeDefined());

    credentialCallback!(googleCredential());
    await waitFor(() => expect(apiJson).toHaveBeenCalled());

    unmount();
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fetches a new nonce and initializes again after a 401", async () => {
    let nonceCalls = 0;
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === "/auth/providers") {
        return { google: { enabled: true, clientId: "test-client-id" } };
      }
      if (path === "/auth/google/nonce") {
        nonceCalls += 1;
        return { nonce: nonceCalls === 1 ? "nonce-1" : "nonce-2" };
      }
      throw new Error(`unexpected apiFetch ${path}`);
    });
    vi.mocked(apiJson).mockRejectedValue(
      new ApiError(401, "Sign-in session expired. Please try again."),
    );

    renderHarness();
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));

    credentialCallback!(googleCredential());

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
    expect(initialize.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ nonce: "nonce-2", client_id: "test-client-id" }),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Sign-in session expired. Please try again.",
    );
  });
});
