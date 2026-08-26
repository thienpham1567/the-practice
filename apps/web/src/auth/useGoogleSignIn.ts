import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthProviders } from "../api/auth-providers";
import { apiFetch, apiJson, ApiError } from "../api/client";
import { useAuthStore, type SessionUser } from "../api/auth-store";
import { afterAuthPath } from "../folio/after-auth-path";
import { loadGsi } from "./load-gsi";

export type GoogleSignInStatus = "hidden" | "loading" | "ready" | "submitting";

export function useGoogleSignIn(options?: { formPending?: boolean }): {
  containerRef: RefObject<HTMLDivElement>;
  status: GoogleSignInStatus;
  error: string | null;
} {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<GoogleSignInStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const submittingRef = useRef(false);
  const formPendingRef = useRef(false);
  formPendingRef.current = options?.formPending === true;
  const abortRef = useRef<AbortController | null>(null);
  const clientIdRef = useRef<string | undefined>(undefined);
  const needsButtonRef = useRef(false);

  const { data, isError, isSuccess, isPending } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: getAuthProviders,
    staleTime: Infinity,
  });

  const enabled = data?.google.enabled === true;
  const clientId = data?.google.enabled === true ? data.google.clientId : undefined;
  clientIdRef.current = clientId;

  useEffect(() => {
    cancelledRef.current = false;
    const abort = new AbortController();
    abortRef.current = abort;
    // Prefetch GIS song song với /auth/providers — script công khai, không cần clientId.
    void loadGsi().catch(() => undefined);

    return () => {
      cancelledRef.current = true;
      abort.abort();
    };
  }, []);

  useEffect(() => {
    if (isError || (isSuccess && !enabled)) {
      setStatus("hidden");
      return;
    }
    if (isPending) {
      setStatus("loading");
      return;
    }
    if (!enabled || !clientId) return;

    const id = clientId;
    let cancelled = false;
    const signal = abortRef.current?.signal;

    async function boot() {
      setStatus("loading");
      setError(null);
      try {
        const [, { nonce }] = await Promise.all([
          loadGsi(),
          apiFetch<{ nonce: string }>("/auth/google/nonce", { signal }),
        ]);
        if (cancelled || cancelledRef.current) return;
        initializeGis(id, nonce);
        needsButtonRef.current = true;
        setStatus("ready");
      } catch (caught) {
        if (cancelled || cancelledRef.current || isAbortError(caught)) return;
        setStatus("hidden");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [enabled, clientId, isError, isSuccess, isPending]);

  useLayoutEffect(() => {
    if (status === "hidden" || !needsButtonRef.current) return;
    const container = containerRef.current;
    if (!container || !window.google?.accounts?.id) return;
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: container.offsetWidth || 320,
    });
    needsButtonRef.current = false;
  }, [status]);

  function initializeGis(id: string, nonce: string) {
    window.google.accounts.id.initialize({
      client_id: id,
      nonce,
      callback: (response) => {
        void handleCredential(response);
      },
      use_fedcm_for_prompt: false,
    });
  }

  async function handleCredential(response: google.accounts.id.CredentialResponse) {
    if (submittingRef.current || cancelledRef.current || formPendingRef.current) return;
    if (!response.credential) return;

    submittingRef.current = true;
    setStatus("submitting");
    setError(null);

    try {
      const result = await apiJson<{ accessToken: string; user: SessionUser }>(
        "/auth/google",
        "POST",
        { credential: response.credential },
        abortRef.current?.signal,
      );
      if (cancelledRef.current) return;
      useAuthStore.getState().setSession(result.accessToken, result.user);
      void navigate(afterAuthPath());
    } catch (caught) {
      submittingRef.current = false;
      if (cancelledRef.current || isAbortError(caught)) return;
      setError(caught instanceof ApiError ? caught.message : "Something went wrong");
      if (caught instanceof ApiError && caught.status === 401 && clientIdRef.current) {
        try {
          const { nonce } = await apiFetch<{ nonce: string }>("/auth/google/nonce", {
            signal: abortRef.current?.signal,
          });
          if (cancelledRef.current) return;
          initializeGis(clientIdRef.current, nonce);
        } catch (retryError) {
          if (cancelledRef.current || isAbortError(retryError)) return;
        }
      }
      if (!cancelledRef.current) setStatus("ready");
    }
  }

  return { containerRef, status, error };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
