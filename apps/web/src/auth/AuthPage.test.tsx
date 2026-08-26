import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "../api/client";
import { useAuthStore } from "../api/auth-store";
import { AuthPage } from "./AuthPage";
import type { GoogleSignInStatus } from "./useGoogleSignIn";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiJson: vi.fn() };
});

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const googleSignIn = {
  containerRef: { current: null },
  status: "hidden" as GoogleSignInStatus,
  error: null as string | null,
};

let lastFormPending = false;

vi.mock("./useGoogleSignIn", () => ({
  useGoogleSignIn: (options?: { formPending?: boolean }) => {
    lastFormPending = options?.formPending === true;
    return googleSignIn;
  },
}));

function renderAuth(mode: "login" | "register" = "login") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AuthPage", () => {
  beforeEach(() => {
    googleSignIn.status = "hidden";
    googleSignIn.error = null;
    lastFormPending = false;
    navigate.mockReset();
    vi.mocked(apiJson).mockReset();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("sends Back to the editor to /write", () => {
    renderAuth();
    expect(screen.getByRole("link", { name: "Back to the editor" }).getAttribute("href")).toBe(
      "/write",
    );
  });

  it("hides the Google button when the provider is disabled", () => {
    googleSignIn.status = "hidden";
    renderAuth();
    expect(screen.queryByTestId("google-sign-in")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("shows the Google button under the form on login and register", () => {
    googleSignIn.status = "ready";
    renderAuth("login");
    expect(screen.getByTestId("google-sign-in")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    cleanup();

    renderAuth("register");
    expect(screen.getByTestId("google-sign-in")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("surfaces a Google sign-in error in the existing alert", () => {
    googleSignIn.status = "ready";
    googleSignIn.error = "Sign-in session expired. Please try again.";
    renderAuth();
    expect(screen.getByRole("alert").textContent).toContain(
      "Sign-in session expired. Please try again.",
    );
  });

  it("disables the password form while Google is submitting", () => {
    googleSignIn.status = "submitting";
    renderAuth();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByTestId("google-sign-in").querySelector(".pointer-events-none")).toBeTruthy();
  });

  it("keeps the password form locked after a successful sign-in", async () => {
    vi.mocked(apiJson).mockResolvedValue({
      accessToken: "tok",
      user: { id: "u1", email: "a@b.c" },
    });
    googleSignIn.status = "ready";
    renderAuth();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(lastFormPending).toBe(true);
    expect((screen.getByRole("button", { name: "Working…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
