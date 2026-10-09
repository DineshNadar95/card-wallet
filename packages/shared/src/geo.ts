/**
 * Location logic for "near a saved offer". Pure functions, run on the device: the user's own
 * position never goes to the server, only the store pins they chose to save.
 *
 * Platform limits (checked 2026-10, see README → Location alerts):
 * - iOS: at most 20 monitored regions per app, of any type. We use 19 for offers and 1
 *   "refresh" region around the user; leaving it means re-pick the nearest offers.
 * - Android: 100 geofences, but this app doesn't use background location on Android (Google
 *   Play generally rejects it for offers/convenience); nearby offers show in the foreground.
 * - Radius: Android recommends at least 100-150 m; we default to 150 m.
 */
import { offerValue } from "./format";
import type { components } from "./schema.gen";

type Offer = components["schemas"]["OfferOut"];

export type LatLng = { lat: number; lng: number };

export const IOS_REGION_LIMIT = 20;
export const DEFAULT_PIN_RADIUS_M = 150;
export const NEARBY_M = 400; // "near you" in the foreground
const MIN_REFRESH_RADIUS_M = 1000;
const EARTH_M = 6_371_000;

export function distanceM(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type PinnedOffer = Offer & { place_lat: number; place_lng: number };

export const isPinned = (o: Offer): o is PinnedOffer => o.place_lat != null && o.place_lng != null;

/** Offers worth alerting about: pinned and not expired. */
export const alertable = (offers: Offer[]): PinnedOffer[] =>
  offers.filter((o): o is PinnedOffer => isPinned(o) && o.status !== "expired");

export const pinOf = (o: PinnedOffer): LatLng => ({ lat: o.place_lat, lng: o.place_lng });

/** Pinned, live offers within `withinM` of `here`, nearest first, with their distance. */
export function nearbyOffers(offers: Offer[], here: LatLng, withinM = NEARBY_M) {
  return alertable(offers)
    .map((o) => ({ offer: o, distanceM: distanceM(here, pinOf(o)) }))
    .filter((x) => x.distanceM <= Math.max(withinM, x.offer.place_radius_m ?? DEFAULT_PIN_RADIUS_M))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export type Region = { identifier: string; latitude: number; longitude: number; radius: number };

export const REFRESH_REGION_ID = "refresh";
export const offerRegionId = (offerId: number) => `offer:${offerId}`;
export const offerIdFromRegion = (id: string): number | null =>
  id.startsWith("offer:") ? Number(id.slice(6)) || null : null;

/**
 * Choose what to monitor on iOS: the nearest pinned offers (one slot left for the refresh
 * region), and a refresh region around `here` reaching to the farthest chosen offer, so leaving
 * it means the user moved far enough to need a new set.
 */
export function pickRegions(offers: Offer[], here: LatLng, limit = IOS_REGION_LIMIT): Region[] {
  const ranked = alertable(offers)
    .map((o) => ({ o, d: distanceM(here, pinOf(o)) }))
    .sort((a, b) => a.d - b.d);
  if (ranked.length === 0) return [];
  const chosen = ranked.slice(0, limit - 1);
  const regions: Region[] = chosen.map(({ o }) => ({
    identifier: offerRegionId(o.id),
    latitude: o.place_lat,
    longitude: o.place_lng,
    radius: o.place_radius_m ?? DEFAULT_PIN_RADIUS_M,
  }));
  if (ranked.length > chosen.length) {
    // Only needed when some offers didn't fit; otherwise every offer is already watched.
    const reach = Math.max(MIN_REFRESH_RADIUS_M, chosen[chosen.length - 1].d);
    regions.push({ identifier: REFRESH_REGION_ID, latitude: here.lat, longitude: here.lng, radius: Math.round(reach) });
  }
  return regions;
}

/** Notification for arriving near an offer's store. */
export function nearbyAlert(o: Offer, today: Date = new Date()): { title: string; body: string } {
  const parts = [offerValue(o)];
  if (o.expires_at) {
    const days = Math.round((Date.parse(`${o.expires_at}T00:00:00Z`) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
    parts.push(days <= 0 ? "ends today" : days === 1 ? "ends tomorrow" : `ends in ${days} days`);
  }
  if (o.card) parts.push(`use ${o.card.nickname || o.card.name}${o.card.last4 ? ` •••• ${o.card.last4}` : ""}`);
  return { title: `You're near ${o.place_label || o.merchant}`, body: `${o.merchant}: ${parts.join(" · ")}` };
}

/** Don't repeat an alert for the same offer within this window. */
export const ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000;
