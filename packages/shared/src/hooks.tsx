import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";

import type { ApiClient } from "./client";
import type { operations } from "./schema.gen";

type ApiCtx = { client: ApiClient; demo: boolean };
const ApiContext = createContext<ApiCtx | null>(null);

/**
 * `demo`: read the user's data from the public, read-only /demo/* endpoints instead of /me/*
 * (landing page "Try the demo"). Writes are refused in demo mode.
 */
export function ApiProvider({ client, demo = false, children }: { client: ApiClient; demo?: boolean; children: ReactNode }) {
  return <ApiContext.Provider value={{ client, demo }}>{children}</ApiContext.Provider>;
}

function useCtx(): ApiCtx {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside <ApiProvider>");
  return ctx;
}

export function useApi(): ApiClient {
  return useCtx().client;
}

export function useIsDemo(): boolean {
  return useCtx().demo;
}

export const DEMO_READ_ONLY = "Demo mode is read-only. Sign in to save changes.";
function assertNotDemo(demo: boolean) {
  if (demo) throw new ApiError(403, DEMO_READ_ONLY);
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
  /** Demo data lives under its own key so it never mixes with a signed-in user's cache. */
  demo: ["demo"] as const,
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
  const { client: api, demo } = useCtx();
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "me"] : queryKeys.me,
    queryFn: async () => unwrap(demo ? await api.GET("/demo/me") : await api.GET("/me")),
    enabled,
  });
}

export function useMyCards(enabled = true) {
  const { client: api, demo } = useCtx();
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "cards"] : queryKeys.myCards,
    queryFn: async () => unwrap(demo ? await api.GET("/demo/cards") : await api.GET("/me/cards")),
    enabled: enabled || demo,
  });
}

export function useMyCard(id: number) {
  const { client: api, demo } = useCtx();
  const params = { path: { user_card_id: id } };
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "cards", id] : queryKeys.myCard(id),
    queryFn: async () =>
      unwrap(
        demo
          ? await api.GET("/demo/cards/{user_card_id}", { params })
          : await api.GET("/me/cards/{user_card_id}", { params }),
      ),
  });
}

export type AddCardInput = operations["add_my_card"]["requestBody"]["content"]["application/json"];

export function useAddCard() {
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddCardInput) => {
      assertNotDemo(demo);
      return unwrap(await api.POST("/me/cards", { body }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useRemoveCard() {
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      assertNotDemo(demo);
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
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ProfileUpdate) => {
      assertNotDemo(demo);
      return unwrap(await api.PATCH("/me", { body }));
    },
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.me, profile);
      // Point value changes the ranking.
      qc.invalidateQueries({ queryKey: ["me", "recommend"] });
    },
  });
}

export type RecommendCategory = operations["recommend_card"]["parameters"]["query"]["category"];

export function useRecommend(category: RecommendCategory, merchant?: string, enabled = true) {
  const { client: api, demo } = useCtx();
  const params = { query: { category, merchant } };
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "recommend", category, merchant ?? null] : queryKeys.recommend(category, merchant),
    queryFn: async () =>
      unwrap(demo ? await api.GET("/demo/recommend", { params }) : await api.GET("/me/recommend", { params })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ---------------------------------------------------------------- offers

export type OfferStatusFilter = NonNullable<
  NonNullable<operations["list_offers"]["parameters"]["query"]>["status"]
>;
export type OfferInput = operations["create_offer"]["requestBody"]["content"]["application/json"];
export type OfferPatch = operations["update_offer"]["requestBody"]["content"]["application/json"];

const offersKey = ["me", "offers"] as const;

export function useOffers(params: { status?: OfferStatusFilter; user_card_id?: number } = {}, enabled = true) {
  const { client: api, demo } = useCtx();
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "offers", params] : [...offersKey, params],
    queryFn: async () =>
      unwrap(
        demo
          ? await api.GET("/demo/offers", { params: { query: params } })
          : await api.GET("/me/offers", { params: { query: params } }),
      ),
    enabled: enabled || demo,
  });
}

export function useOffer(id: number | null) {
  const { client: api, demo } = useCtx();
  return useQuery({
    queryKey: demo ? [...queryKeys.demo, "offers", "one", id] : [...offersKey, "one", id],
    queryFn: async () => {
      const params = { path: { offer_id: id! } };
      return unwrap(
        demo ? await api.GET("/demo/offers/{offer_id}", { params }) : await api.GET("/me/offers/{offer_id}", { params }),
      );
    },
    enabled: id != null,
  });
}

/** Offers feed the recommendation reasons too, so refresh everything under "me". */
const refreshMe = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ["me"] });

export function useCreateOffer() {
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: OfferInput) => {
      assertNotDemo(demo);
      return unwrap(await api.POST("/me/offers", { body }));
    },
    onSuccess: () => refreshMe(qc),
  });
}

export function useUpdateOffer(id: number) {
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: OfferPatch) => {
      assertNotDemo(demo);
      return unwrap(await api.PATCH("/me/offers/{offer_id}", { params: { path: { offer_id: id } }, body }));
    },
    onSuccess: () => refreshMe(qc),
  });
}

export function useDeleteOffer() {
  const { client: api, demo } = useCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      assertNotDemo(demo);
      const res = await api.DELETE("/me/offers/{offer_id}", { params: { path: { offer_id: id } } });
      if (!res.response.ok) throw new ApiError(res.response.status, "Could not delete offer");
    },
    onSuccess: () => refreshMe(qc),
  });
}

/**
 * Photo -> draft offer. `form` must hold the image under "image"
 * (a File/Blob on web; `{ uri, name, type }` on React Native).
 */
export function useParseOfferImage() {
  const { client: api, demo } = useCtx();
  return useMutation({
    mutationFn: async (form: FormData) => {
      assertNotDemo(demo);
      return unwrap(
        await api.POST("/me/offers/parse-image", {
          // The generated type describes the multipart fields; we send the FormData as-is.
          body: form as unknown as { image: string },
          bodySerializer: (b) => b as unknown as FormData,
        }),
      );
    },
  });
}

export async function registerPushToken(api: ApiClient, token: string, platform: "ios" | "android" | "web") {
  await api.POST("/me/push-tokens", { body: { token, platform } });
}

export async function unregisterPushToken(api: ApiClient, token: string) {
  await api.DELETE("/me/push-tokens", { body: { token } });
}
