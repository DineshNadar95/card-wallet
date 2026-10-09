export { type ApiClient, type ApiClientOptions, createApiClient } from "./client";
export * from "./format";
export {
  type AddCardInput,
  ApiError,
  ApiProvider,
  type CatalogParams,
  queryKeys,
  useAddCard,
  useApi,
  useCatalog,
  useCatalogCard,
  useHealth,
  useMe,
  useMyCard,
  useMyCards,
  useRemoveCard,
} from "./hooks";
export type { components, operations, paths } from "./schema.gen";
export * from "./tokens";

import type { components } from "./schema.gen";

type S = components["schemas"];
export type Health = S["Health"];
export type CardSummary = S["CardSummary"];
export type CardDetail = S["CardDetail"];
export type EarnRate = S["EarnRateOut"];
export type UserCard = S["UserCardOut"];
export type UserCardDetail = S["UserCardDetail"];
export type Profile = S["Profile"];
