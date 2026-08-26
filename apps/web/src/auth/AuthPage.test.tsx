import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";
import type { GoogleSignInStatus } from "./useGoogleSignIn";

const googleSignIn = {
  containerRef: { current: null },
  status: "hidden" as GoogleSignInStatus,
  error: null as string | null,
};

vi.mock("./useGoogleSignIn", () => ({
  useGoogleSignIn: () => googleSignIn,
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
  });

  afterEach(() => {
    cleanup();
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
});
