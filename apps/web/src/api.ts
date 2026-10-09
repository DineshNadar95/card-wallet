import { createApiClient } from "@card-wallet/shared";

import { getAccessToken } from "./auth";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  getAccessToken,
});
