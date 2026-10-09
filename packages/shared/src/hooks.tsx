import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import type { ApiClient } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside <ApiProvider>");
  return client;
}

export const queryKeys = {
  health: ["health"] as const,
};

export function useHealth() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error || !data) throw new Error("API unreachable");
      return data;
    },
    retry: false,
  });
}
