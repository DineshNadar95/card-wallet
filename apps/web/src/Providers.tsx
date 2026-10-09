import { ApiProvider, type ApiClient } from "@card-wallet/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AuthProvider, supabase, useAuth } from "./auth";

function ApiBridge({ client, children }: { client: ApiClient; children: ReactNode }) {
  const { demo } = useAuth();
  return (
    <ApiProvider client={client} demo={demo}>
      {children}
    </ApiProvider>
  );
}

/** Query cache, auth (incl. demo mode) and the API client, in the order they depend on each other. */
export function Providers({
  api,
  queryClient,
  auth = supabase,
  children,
}: {
  api: ApiClient;
  queryClient: QueryClient;
  auth?: SupabaseClient | null;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={auth}>
        <ApiBridge client={api}>{children}</ApiBridge>
      </AuthProvider>
    </QueryClientProvider>
  );
}
