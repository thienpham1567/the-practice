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

const apiReady = {
  status: "ready" as "checking" | "ready" | "failed",
  retry: vi.fn(),
};

vi.mock("./useApiReady", () => ({
  useApiReady: () => apiReady,
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
    apiReady.status = "ready";
    apiReady.retry.mockReset();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("opens as a Folio title page with a large brand lockup", () => {
    renderAuth();
    const brand = screen.getByRole("link", { name: /The Practice/ });
    expect(brand.getAttribute("href")).toBe("/");
    expect(brand.className).toContain("text-2xl");
    expect(brand.closest("main")?.classList.contains("auth-desk")).toBe(true);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByText("Your papers and talks are waiting.")).toBeTruthy();
    expect(document.querySelector("[data-ambient='desk']")).toBeTruthy();
    expect(document.querySelector("header.border-b")).toBeNull();
  });

  it("shows the ambient backdrop on register as well", () => {
    renderAuth("register");
    expect(screen.getByRole("heading", { name: "Begin practice" })).toBeTruthy();
    expect(screen.getByText("An account keeps your papers and talks.")).toBeTruthy();
    expect(document.querySelector("[data-ambient='desk']")).toBeTruthy();
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

  it("shows a visible loading placeholder while Google Sign-In boots", () => {
    googleSignIn.status = "loading";
    renderAuth();
    expect(screen.getByTestId("google-sign-in")).toBeTruthy();
    expect(screen.getByTestId("google-sign-in-skeleton")).toBeTruthy();
    expect(screen.getByTestId("google-sign-in-slot").className).toContain("h-10");
  });

  it("keeps a fixed-height Google slot when the button is ready", () => {
    googleSignIn.status = "ready";
    renderAuth();
    expect(screen.getByTestId("google-sign-in-slot").className).toContain("h-10");
    expect(screen.queryByTestId("google-sign-in-skeleton")).toBeNull();
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

  it("covers the page with the wake overlay while the API is checking", () => {
    apiReady.status = "checking";
    renderAuth("register");
    const overlay = screen.getByTestId("auth-wake-overlay");
    expect(overlay.className).toMatch(/\bfixed\b/);
    expect(overlay.closest(".auth-sheet")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("One moment…");
    expect(screen.getByRole("heading", { name: "Begin practice" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Day|Night/ }).closest("[inert]")).toBeNull();
    expect(screen.getByTestId("auth-form-block").hasAttribute("inert")).toBe(true);
    expect(screen.getByTestId("auth-form-block").className).not.toMatch(/opacity-40/);
    expect(screen.getByRole("button", { name: "Create account" }).closest("[inert]")).toBeTruthy();
  });

  it("does not submit while the overlay is up", () => {
    apiReady.status = "checking";
    renderAuth();
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(apiJson).not.toHaveBeenCalled();
  });

  it("hides the overlay once the API is ready", () => {
    apiReady.status = "ready";
    renderAuth();
    expect(screen.queryByTestId("auth-wake-overlay")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" }).closest("[inert]")).toBeNull();
  });

  it("keeps the form blocked on failed and retries from Try again", () => {
    apiReady.status = "failed";
    renderAuth();
    expect(screen.getByRole("status").textContent).toBe("The desk isn't answering.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(apiReady.retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign in" }).closest("[inert]")).toBeTruthy();
  });

  it("sets aria-busy on the sheet only while checking", () => {
    apiReady.status = "checking";
    const { container } = renderAuth();
    expect(container.querySelector(".auth-sheet")?.getAttribute("aria-busy")).toBe("true");
    cleanup();
    apiReady.status = "failed";
    const failed = renderAuth();
    expect(failed.container.querySelector(".auth-sheet")?.getAttribute("aria-busy")).toBeNull();
  });
});
