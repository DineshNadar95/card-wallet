import { createApiClient } from "@card-wallet/shared";

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
  // Supabase session token is wired in Phase 2.
  getAccessToken: () => null,
});
