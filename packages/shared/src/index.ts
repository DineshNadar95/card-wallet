export { type ApiClient, type ApiClientOptions, createApiClient } from "./client";
export { ApiProvider, queryKeys, useApi, useHealth } from "./hooks";
export type { components, paths } from "./schema.gen";
export * from "./tokens";

import type { components } from "./schema.gen";

export type Health = components["schemas"]["Health"];
