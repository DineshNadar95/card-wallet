import {
  distanceM,
  nearbyAlert,
  nearbyOffers,
  type Offer,
  offerIdFromRegion,
  pickRegions,
  REFRESH_REGION_ID,
} from "@card-wallet/shared";
import { describe, expect, it } from "vitest";

const HERE = { lat: 40.7411, lng: -73.9897 };

// Points roughly `m` meters north of HERE (1° latitude ≈ 111,195 m).
const north = (m: number) => ({ lat: HERE.lat + m / 111_195, lng: HERE.lng });

const offer = (id: number, at: { lat: number; lng: number } | null, extra: Partial<Offer> = {}) =>
  ({
    id, user_card_id: null, card: null, merchant: `Demo Shop ${id}`, kind: "percent_back", value: 10,
    max_back: null, min_spend: null, code: null, expires_at: "2026-10-12", category: null, notes: null,
    source: "typed", remind_days: 3, reminded_at: null, created_at: "", status: "ending_soon", days_left: 3,
    place_lat: at?.lat ?? null, place_lng: at?.lng ?? null, place_radius_m: null, place_label: null, ...extra,
  }) as Offer;

describe("distanceM", () => {
  it("is close to known distances", () => {
    expect(distanceM(HERE, HERE)).toBe(0);
    expect(distanceM(HERE, north(1000))).toBeCloseTo(1000, -1);
    // New York to Los Angeles ≈ 3,936 km
    expect(distanceM({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 }) / 1000).toBeCloseTo(3936, -1);
  });
});

describe("nearbyOffers", () => {
  it("returns pinned, unexpired offers within range, nearest first", () => {
    const offers = [
      offer(1, north(300)),
      offer(2, north(50)),
      offer(3, north(5000)), // too far
      offer(4, null), // no pin
      offer(5, north(10), { status: "expired" }),
    ];
    expect(nearbyOffers(offers, HERE).map((x) => x.offer.id)).toEqual([2, 1]);
  });

  it("a large store radius counts as near", () => {
    const big = offer(6, north(700), { place_radius_m: 800 });
    expect(nearbyOffers([big], HERE).map((x) => x.offer.id)).toEqual([6]);
  });
});

describe("pickRegions (iOS: max 20 monitored regions)", () => {
  it("watches every offer when they fit, with no refresh region", () => {
    const regions = pickRegions([offer(1, north(100)), offer(2, north(200))], HERE);
    expect(regions.map((r) => r.identifier)).toEqual(["offer:1", "offer:2"]);
    expect(regions[0].radius).toBe(150); // default radius
  });

  it("caps at 19 nearest offers plus one refresh region around the user", () => {
    const offers = Array.from({ length: 30 }, (_, i) => offer(i + 1, north((i + 1) * 500)));
    const regions = pickRegions(offers, HERE);
    expect(regions).toHaveLength(20);
    expect(regions.slice(0, 19).map((r) => offerIdFromRegion(r.identifier))).toEqual(
      Array.from({ length: 19 }, (_, i) => i + 1),
    );
    const refresh = regions[19];
    expect(refresh.identifier).toBe(REFRESH_REGION_ID);
    expect(refresh.latitude).toBe(HERE.lat);
    expect(refresh.radius).toBeCloseTo(19 * 500, -1); // reaches the farthest watched offer
  });

  it("never watches expired or unpinned offers, and returns nothing when none qualify", () => {
    expect(pickRegions([offer(1, null), offer(2, north(10), { status: "expired" })], HERE)).toEqual([]);
  });

  it("parses region ids back to offers", () => {
    expect(offerIdFromRegion("offer:42")).toBe(42);
    expect(offerIdFromRegion(REFRESH_REGION_ID)).toBeNull();
  });
});

describe("nearbyAlert", () => {
  it("says what the offer is, when it ends, and which card to use", () => {
    const o = offer(1, north(10), {
      merchant: "Demo Bistro",
      place_label: "Demo Bistro, 5th Ave",
      card: { user_card_id: 1, card_id: 1, name: "Demo Card A", nickname: null, last4: "1234" },
    });
    expect(nearbyAlert(o, new Date("2026-10-09T15:00:00Z"))).toEqual({
      title: "You're near Demo Bistro, 5th Ave",
      body: "Demo Bistro: 10% back · ends in 3 days · use Demo Card A •••• 1234",
    });
  });

  it("handles store coupons without expiry", () => {
    const o = offer(2, north(10), { merchant: "Demo Shoes", kind: "amount_off", value: 20, expires_at: null });
    expect(nearbyAlert(o).body).toBe("Demo Shoes: $20 off");
  });
});
