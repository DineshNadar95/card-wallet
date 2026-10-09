import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema.gen";

export type ApiClient = ReturnType<typeof createClient<paths>>;

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current Supabase access token, or null when signed out / in demo mode. */
  getAccessToken?: () => Promise<string | null> | string | null;
}

/** Typed client for the Card Wallet API. Types come from the backend's OpenAPI schema. */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl });

  if (getAccessToken) {
    const auth: Middleware = {
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    };
    client.use(auth);
  }

  return client;
}
