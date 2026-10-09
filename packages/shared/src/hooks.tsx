import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import type { ApiClient } from "./client";
import type { operations } from "./schema.gen";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside <ApiProvider>");
  return client;
}

export type CatalogParams = NonNullable<operations["list_catalog_cards"]["parameters"]["query"]>;

export const queryKeys = {
  health: ["health"] as const,
  catalog: (p: CatalogParams) => ["catalog", p] as const,
  catalogCard: (id: number) => ["catalog", "card", id] as const,
  me: ["me"] as const,
  myCards: ["me", "cards"] as const,
  myCard: (id: number) => ["me", "cards", id] as const,
  recommend: (category: string, merchant?: string) => ["me", "recommend", category, merchant ?? null] as const,
};

/** Status code carried on errors so screens can tell "signed out" from "broken". */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function unwrap<T>(res: { data?: T; error?: unknown; response: Response }): T {
  if (res.error !== undefined || res.data === undefined) {
    const detail = (res.error as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(
      res.response.status,
      typeof detail === "string" ? detail : `Request failed (${res.response.status})`,
    );
  }
  return res.data;
}

export function useHealth() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => unwrap(await api.GET("/health")),
    retry: false,
  });
}

export function useCatalog(params: CatalogParams) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalog(params),
    queryFn: async () => unwrap(await api.GET("/catalog/cards", { params: { query: params } })),
    placeholderData: keepPreviousData,
  });
}

export function useCatalogCard(id: number) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.catalogCard(id),
    queryFn: async () =>
      unwrap(await api.GET("/catalog/cards/{card_id}", { params: { path: { card_id: id } } })),
  });
}

export function useMe(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => unwrap(await api.GET("/me")),
    enabled,
  });
}

export function useMyCards(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myCards,
    queryFn: async () => unwrap(await api.GET("/me/cards")),
    enabled,
  });
}

export function useMyCard(id: number) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.myCard(id),
    queryFn: async () =>
      unwrap(await api.GET("/me/cards/{user_card_id}", { params: { path: { user_card_id: id } } })),
  });
}

export type AddCardInput = operations["add_my_card"]["requestBody"]["content"]["application/json"];

export function useAddCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddCardInput) => unwrap(await api.POST("/me/cards", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useRemoveCard() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.DELETE("/me/cards/{user_card_id}", {
        params: { path: { user_card_id: id } },
      });
      if (!res.response.ok) throw new ApiError(res.response.status, "Could not remove card");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export type ProfileUpdate = operations["update_me"]["requestBody"]["content"]["application/json"];

export function useUpdateMe() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProfileUpdate) => unwrap(await api.PATCH("/me", { body })),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.me, profile);
      // Point value changes the ranking.
      qc.invalidateQueries({ queryKey: ["me", "recommend"] });
    },
  });
}

export type RecommendCategory = operations["recommend_card"]["parameters"]["query"]["category"];

export function useRecommend(category: RecommendCategory, merchant?: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.recommend(category, merchant),
    queryFn: async () =>
      unwrap(await api.GET("/me/recommend", { params: { query: { category, merchant } } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}
