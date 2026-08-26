import { apiFetch } from "./client";

export type AuthProviders = {
  google: { enabled: true; clientId: string } | { enabled: false };
};

export function getAuthProviders(): Promise<AuthProviders> {
  return apiFetch<AuthProviders>("/auth/providers");
}
