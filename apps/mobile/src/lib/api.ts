import { createApiClient } from "@card-wallet/shared";

import { getAccessToken } from "./supabase";

export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
  getAccessToken,
});
