/**
 * "Remind me when I'm near a saved offer" (iOS only, opt-in).
 *
 * iOS monitors at most 20 regions per app; `pickRegions` keeps the 19 nearest pinned offers plus
 * a refresh region around the user, re-picked when the user leaves it. Android doesn't use
 * background location here (Google Play generally rejects it for offers); Android users get
 * nearby offers in the foreground via "Scan where I am".
 *
 * The task runs even after iOS relaunches a terminated app, so it reads offers from a local
 * cache (no network). The user's location never leaves the device.
 */
import {
  ALERT_COOLDOWN_MS,
  alertable,
  nearbyAlert,
  type Offer,
  offerIdFromRegion,
  pickRegions,
  REFRESH_REGION_ID,
} from "@card-wallet/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

export const GEOFENCE_TASK = "card-wallet-geofence";
const ENABLED_KEY = "card-wallet.geo.enabled";
const OFFERS_KEY = "card-wallet.geo.offers";
const ALERTED_KEY = "card-wallet.geo.alerted";

export const geofencingSupported = Platform.OS === "ios";

type GeofenceEvent = { eventType: Location.GeofencingEventType; region: Location.LocationRegion };

async function cachedOffers(): Promise<Offer[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(OFFERS_KEY)) ?? "[]") as Offer[];
  } catch {
    return [];
  }
}

async function alertOnce(offer: Offer): Promise<void> {
  const raw = await AsyncStorage.getItem(ALERTED_KEY);
  const alerted: Record<string, number> = raw ? JSON.parse(raw) : {};
  const now = Date.now();
  if (now - (alerted[offer.id] ?? 0) < ALERT_COOLDOWN_MS) return;
  const { title, body } = nearbyAlert(offer);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { offerId: offer.id } },
    trigger: null, // now
  });
  alerted[offer.id] = now;
  // Keep only recent entries.
  for (const [k, t] of Object.entries(alerted)) if (now - t > ALERT_COOLDOWN_MS) delete alerted[k];
  await AsyncStorage.setItem(ALERTED_KEY, JSON.stringify(alerted));
}

async function restart(offers: Offer[], here: { lat: number; lng: number }): Promise<void> {
  const regions = pickRegions(offers, here);
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (regions.length === 0) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return;
  }
  // Calling start again replaces the monitored set.
  await Location.startGeofencingAsync(
    GEOFENCE_TASK,
    regions.map((r) => ({
      identifier: r.identifier,
      latitude: r.latitude,
      longitude: r.longitude,
      radius: r.radius,
      notifyOnEnter: r.identifier !== REFRESH_REGION_ID,
      notifyOnExit: r.identifier === REFRESH_REGION_ID,
    })),
  );
}

// Must be defined at module scope so iOS can run it after relaunching the app in the background.
TaskManager.defineTask<GeofenceEvent>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { eventType, region } = data;
  const offers = await cachedOffers();
  const id = region.identifier ?? "";

  if (eventType === Location.GeofencingEventType.Exit && id === REFRESH_REGION_ID) {
    // Moved far enough: watch the offers nearest to where the user is now.
    const pos = await Location.getLastKnownPositionAsync();
    if (pos) await restart(offers, { lat: pos.coords.latitude, lng: pos.coords.longitude });
    return;
  }
  if (eventType === Location.GeofencingEventType.Enter) {
    const offerId = offerIdFromRegion(id);
    const offer = offers.find((o) => o.id === offerId);
    if (offer) await alertOnce(offer);
  }
});

export async function alertsEnabled(): Promise<boolean> {
  return geofencingSupported && (await AsyncStorage.getItem(ENABLED_KEY)) === "1";
}

/** Re-pick monitored regions from the current offers. Safe to call often. */
export async function syncGeofences(offers: Offer[]): Promise<void> {
  if (!(await alertsEnabled())) return;
  const live = alertable(offers);
  await AsyncStorage.setItem(OFFERS_KEY, JSON.stringify(live));
  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) return; // user downgraded to "While Using" in Settings
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  await restart(live, { lat: pos.coords.latitude, lng: pos.coords.longitude });
}

export type EnableResult = "on" | "unsupported" | "foreground-denied" | "always-denied";

/** Turn alerts on: asks for location (While Using, then Always) and notifications. */
export async function enableAlerts(offers: Offer[]): Promise<EnableResult> {
  if (!geofencingSupported) return "unsupported";
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return "foreground-denied";
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return "always-denied";
  await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(ENABLED_KEY, "1");
  await syncGeofences(offers);
  return "on";
}

export async function disableAlerts(): Promise<void> {
  await AsyncStorage.multiRemove([ENABLED_KEY, OFFERS_KEY, ALERTED_KEY]);
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
}
