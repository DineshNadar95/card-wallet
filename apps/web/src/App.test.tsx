import { ApiProvider, createApiClient } from "@card-wallet/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("./lib/image", () => ({
  prepareImage: async (f: File) => new Blob([await f.arrayBuffer()], { type: "image/jpeg" }),
}));
import { AuthProvider } from "./auth";

const CARD = {
  id: 1,
  issuer: "Demo Bank",
  name: "Demo Card A",
  network: "Visa",
  annual_fee: 0,
  fx_fee: 3,
  purchase_apr_min: 19.9,
  purchase_apr_max: 28.9,
  rewards_types: "Cashback rewards",
  credit_tiers: null,
  secured: false,
  source: "CFPB TCCP Jul–Dec 2025",
  as_of: "2025-12-31",
  earn_rates: [],
};

let walletCards: unknown[] = [];
let posted: unknown[] = [];
let picks: unknown[] = [];
let requested: string[] = [];
let pointValue = 1;
let offers: Record<string, unknown>[] = [];
let offerPosts: unknown[] = [];
let offerPatches: unknown[] = [];
let deleted: number[] = [];
let parseResult: { status: number; body: unknown } = { status: 200, body: {} };
let parseUploads = 0;

const OFFER = (id: number, merchant: string, status: string, extra = {}) => ({
  id, user_card_id: null, card: null, merchant, kind: "amount_off", value: 100, max_back: null, min_spend: null,
  code: null, expires_at: "2026-10-13", category: null, notes: null, source: "typed", remind_days: 3,
  reminded_at: null, created_at: "", status, days_left: status === "expired" ? -2 : 4, ...extra,
});
const guess = (value: unknown, confidence = 0.9) => ({ value, confidence });

const RATE = { category: "dining", rate: 4, unit: "points", annual_cap: null, conditions: null,
  source_url: "https://demo-bank.test/a", checked_at: "2026-10-04T00:00:00Z" };
const pick = (id: number, name: string, extra = {}) => ({
  user_card_id: id, card_id: id, name, issuer: "Demo Bank", last4: "1234", nickname: null,
  rate: RATE, effective_cents: 4, matched_category: true, reason: `${name} reason`, offers: [], ...extra,
});

function mockApi() {
  walletCards = [];
  posted = [];
  picks = [];
  requested = [];
  pointValue = 1;
  offers = [];
  offerPosts = [];
  offerPatches = [];
  deleted = [];
  parseUploads = 0;
  parseResult = { status: 200, body: {} };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      if (url.pathname === "/health") return Response.json({ status: "ok", version: "0.1.0" });
      if (url.pathname === "/catalog/cards") return Response.json({ items: [CARD], total: 1 });
      if (url.pathname === "/me/cards" && input.method === "POST") {
        const body = await input.json();
        posted.push(body);
        walletCards.push({ id: 7, card_id: 1, last4: body.last4, nickname: null, created_at: "", card: CARD });
        return Response.json(walletCards.at(-1), { status: 201 });
      }
      if (url.pathname === "/me/cards") return Response.json(walletCards);
      if (url.pathname === "/me/offers/parse-image") {
        parseUploads++;
        return Response.json(parseResult.body, { status: parseResult.status });
      }
      const offerMatch = url.pathname.match(/^\/me\/offers\/(\d+)$/);
      if (offerMatch) {
        const id = Number(offerMatch[1]);
        if (input.method === "DELETE") {
          deleted.push(id);
          return new Response(null, { status: 204 });
        }
        if (input.method === "PATCH") {
          offerPatches.push(await input.json());
          return Response.json(offers.find((o) => o.id === id));
        }
        const found = offers.find((o) => o.id === id);
        return found ? Response.json(found) : Response.json({ detail: "Offer not found" }, { status: 404 });
      }
      if (url.pathname === "/me/offers" && input.method === "POST") {
        const b = await input.json();
        offerPosts.push(b);
        return Response.json(OFFER(99, b.merchant, "active"), { status: 201 });
      }
      if (url.pathname === "/me/offers") {
        const st = url.searchParams.get("status");
        return Response.json(offers.filter((o) => !st || (st === "active" ? o.status !== "expired" : o.status === st)));
      }
      if (url.pathname === "/me/recommend") {
        requested.push(url.searchParams.get("category")!);
        return Response.json({ category: url.searchParams.get("category"), merchant: null, point_value_cents: pointValue, picks });
      }
      if (url.pathname === "/me" && input.method === "PATCH") {
        pointValue = (await input.json()).point_value_cents;
        return Response.json({ user_id: "u", email: null, display_name: null, point_value_cents: pointValue });
      }
      if (url.pathname === "/me") return Response.json({ user_id: "u", email: null, display_name: null, point_value_cents: pointValue });
      return new Response(null, { status: 404 });
    }),
  );
}

function fakeSupabase(signedIn: boolean): SupabaseClient {
  const session = signedIn
    ? { access_token: "t", user: { email: "demo@example.test", user_metadata: { full_name: "Demo User" } } }
    : null;
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  } as unknown as SupabaseClient;
}

function renderAt(path: string, { signedIn = false } = {}) {
  const client = createApiClient({ baseUrl: "http://api.test" });
  return render(
    <ApiProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider client={fakeSupabase(signedIn)}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ApiProvider>,
  );
}

beforeEach(() => {
  mockApi();
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

describe("landing", () => {
  it("shows the headline, demo CTA and Google sign-in", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Know which card to use.");
    expect(screen.getByRole("link", { name: /try the demo/i })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});

describe("app shell", () => {
  it("renders sidebar with all sections and four bottom tabs", () => {
    renderAt("/app");
    const sidebar = within(screen.getByRole("complementary", { name: "Main" }));
    for (const label of ["Home", "My cards", "Offers & coupons", "Card catalog", "Compare"]) {
      expect(sidebar.getByRole("link", { name: label })).toBeInTheDocument();
    }
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Cards", "Offers", "Compare"]);
  });

  it("marks the current route active", () => {
    renderAt("/app/offers");
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("shows API health and the signed-in user", async () => {
    renderAt("/app", { signedIn: true });
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(await screen.findByText("demo@example.test")).toBeInTheDocument();
  });
});

describe("my cards", () => {
  it("asks signed-out visitors to sign in", async () => {
    renderAt("/app/cards");
    expect(await screen.findByText("Sign in to see your cards")).toBeInTheDocument();
  });

  it("lists the wallet with source and disclaimer", async () => {
    walletCards = [{ id: 7, card_id: 1, last4: "1234", nickname: null, created_at: "", card: CARD }];
    renderAt("/app/cards", { signedIn: true });
    expect(await screen.findByText("Demo Card A")).toBeInTheDocument();
    expect(screen.getByText(/•••• 1234/)).toBeInTheDocument();
    expect(screen.getByText(/CFPB TCCP Jul–Dec 2025.*Not financial advice\./)).toBeInTheDocument();
  });
});

describe("catalog", () => {
  it("shows terms from the API, with source", async () => {
    renderAt("/app/catalog");
    const row = (await screen.findByText("Demo Card A")).closest("tr")!;
    expect(within(row).getByText("$0")).toBeInTheDocument();
    expect(within(row).getByText("3%")).toBeInTheDocument();
    expect(within(row).getByText("19.9%–28.9%")).toBeInTheDocument();
    expect(screen.getByText(/1 US cards · fees from CFPB TCCP Jul–Dec 2025/)).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Add to wallet" })).not.toBeInTheDocument();
  });

  it("adds a card with last 4 digits only", async () => {
    renderAt("/app/catalog", { signedIn: true });
    fireEvent.click(await screen.findByRole("button", { name: "Add to wallet" }));
    const input = screen.getByLabelText("Last 4 digits (optional)");
    fireEvent.change(input, { target: { value: "4111 1111 1111 1234" } });
    expect(input).toHaveValue("4111"); // digits only, capped at four
    fireEvent.click(screen.getByRole("button", { name: "Add card" }));
    expect(await screen.findByText("Added to your wallet")).toBeInTheDocument();
    expect(posted).toEqual([{ card_id: 1, last4: "4111", nickname: null }]);
  });
});

describe("home", () => {
  it("asks signed-out visitors to sign in", async () => {
    renderAt("/app");
    expect(await screen.findByText("Sign in to see your cards")).toBeInTheDocument();
  });

  it("shows the top pick, two alternatives, and the sourcing line", async () => {
    picks = [pick(1, "Demo Card A"), pick(2, "Demo Card B", { rate: { ...RATE, rate: 3, unit: "percent" } }), pick(3, "Demo Card C")];
    renderAt("/app", { signedIn: true });
    const best = await screen.findByRole("region", { name: "Best card" });
    expect(within(best).getByText("Demo Card A")).toBeInTheDocument();
    expect(within(best).getByText("4x")).toBeInTheDocument();
    expect(within(best).getByText("points on dining")).toBeInTheDocument();
    expect(within(best).getByText("Demo Card A reason")).toBeInTheDocument();
    expect(screen.getByText("Demo Card B").closest("a")).toHaveAttribute("href", "/app/cards/2");
    expect(screen.getByText("3%")).toBeInTheDocument();
    const note = screen.getByRole("button", { name: "change" }).closest("p")!;
    expect(note).toHaveTextContent(
      "Rewards checked Oct 4, 2026 from issuer pages · Fees: CFPB TCCP · Points valued at 1¢ (change) · Not financial advice.",
    );
  });

  it("re-ranks when the category changes, and remembers it in the URL", async () => {
    picks = [pick(1, "Demo Card A")];
    renderAt("/app?for=gas", { signedIn: true });
    expect(await screen.findByText("Best for gas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Online" }));
    expect(await screen.findByText("Best for online shopping")).toBeInTheDocument();
    expect(requested).toEqual(["gas", "online"]);
    expect(screen.getByRole("button", { name: "Online" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains when no reward rates are on file yet", async () => {
    picks = [pick(1, "Demo Card A", { rate: null, effective_cents: null })];
    renderAt("/app", { signedIn: true });
    expect(await screen.findByText("No reward rates on file yet")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Best card" })).not.toBeInTheDocument();
  });

  it("prompts to add cards when the wallet is empty", async () => {
    renderAt("/app", { signedIn: true });
    expect(await screen.findByText("Add the cards you own")).toBeInTheDocument();
  });

  it("lets the user change the point value", async () => {
    picks = [pick(1, "Demo Card A")];
    renderAt("/app", { signedIn: true });
    fireEvent.click(await screen.findByRole("button", { name: "change" }));
    fireEvent.change(screen.getByLabelText("Cents per point or mile"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText((_, el) => el?.tagName === "P" && /Points valued at 1\.5¢/.test(el.textContent ?? ""));
    expect(requested.length).toBeGreaterThan(1); // ranking refetched with the new value
  });
});

describe("offers", () => {
  it("lists offers by tab, with the design's wording", async () => {
    offers = [
      OFFER(1, "Demo Phone Co.", "ending_soon", { notes: "Upgrade coupon" }),
      OFFER(2, "Demo Shoes", "active", { kind: "percent_back", value: 25, expires_at: "2026-11-30", days_left: 52 }),
      OFFER(3, "Demo Old", "expired"),
    ];
    renderAt("/app/offers", { signedIn: true });
    const first = (await screen.findByText("Demo Phone Co.")).closest("a")!;
    expect(first).toHaveAttribute("href", "/app/offers/1");
    expect(within(first).getByText("$100 off")).toBeInTheDocument();
    expect(within(first).getByText("Ends in 4 days")).toHaveClass("urgent");
    expect(within(first).getByText(/Coupon · no card/)).toBeInTheDocument();
    expect(screen.getByText("Ends Nov 30, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Demo Old")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Expired" }));
    expect(await screen.findByText("Demo Old")).toBeInTheDocument();
    expect(screen.queryByText("Demo Shoes")).not.toBeInTheDocument();
  });

  it("adds a typed store coupon", async () => {
    renderAt("/app/offers/new", { signedIn: true });
    fireEvent.click(await screen.findByRole("tab", { name: "Type it in" }));
    fireEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(await screen.findByText("Add the merchant or store")).toBeInTheDocument();
    expect(offerPosts).toEqual([]);

    fireEvent.change(screen.getByLabelText("Merchant or store"), { target: { value: "Demo Shoes" } });
    fireEvent.click(screen.getByRole("button", { name: "$ off" }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Expires"), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: "1 week" }));
    fireEvent.click(screen.getByRole("button", { name: "Save offer" }));

    await waitFor(() => expect(offerPosts).toHaveLength(1));
    expect(offerPosts[0]).toEqual({
      user_card_id: null, merchant: "Demo Shoes", kind: "amount_off", value: 20, max_back: null, min_spend: null,
      expires_at: "2026-10-31", code: null, category: null, notes: null, source: "typed", remind_days: 7,
    });
  });

  it("reads a photo into a draft the user confirms", async () => {
    parseResult = {
      status: 200,
      body: {
        is_offer: true, merchant: guess("Demo Bistro"), kind: guess("percent_back"), value: guess(10),
        max_back: guess(15, 0.4), min_spend: guess(50), expires_at: guess("2026-10-31"),
        code: guess(null, 0), category: guess("dining"), notes: guess(null, 0),
      },
    };
    renderAt("/app/offers/new", { signedIn: true });
    const file = new File(["fake-bytes"], "shot.png", { type: "image/png" });
    fireEvent.change(await screen.findByLabelText(/Choose a photo/), { target: { files: [file] } });

    expect(await screen.findByText("Read 6 details from your screenshot")).toBeInTheDocument();
    expect(screen.getByLabelText("Merchant or store")).toHaveValue("Demo Bistro");
    expect(screen.getByLabelText("Value")).toHaveValue("10");
    // Low-confidence fields are flagged for a second look.
    const maxBack = screen.getByLabelText("Max back").closest(".field")!;
    expect(within(maxBack as HTMLElement).getByText("Check this")).toBeInTheDocument();
    expect(parseUploads).toBe(1);
    expect(offerPosts).toEqual([]); // nothing saved until the user confirms

    fireEvent.click(screen.getByRole("button", { name: "Save offer" }));
    await waitFor(() => expect(offerPosts).toHaveLength(1));
    expect(offerPosts[0]).toMatchObject({ merchant: "Demo Bistro", kind: "percent_back", value: 10, source: "screenshot" });
  });

  it("explains when a photo can't be read", async () => {
    parseResult = { status: 422, body: { detail: "We couldn't read that image. Try a clearer photo, or type it in." } };
    renderAt("/app/offers/new", { signedIn: true });
    const file = new File(["x"], "shot.png", { type: "image/png" });
    fireEvent.change(await screen.findByLabelText(/Choose a photo/), { target: { files: [file] } });
    expect(await screen.findByText(/couldn't read that image/)).toBeInTheDocument();
  });

  it("edits and deletes an offer", async () => {
    offers = [OFFER(5, "Demo Bistro", "active")];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/app/offers/5", { signedIn: true });
    const merchant = await screen.findByLabelText("Merchant or store");
    expect(merchant).toHaveValue("Demo Bistro");
    fireEvent.change(merchant, { target: { value: "Demo Cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(offerPatches).toHaveLength(1));
    expect(offerPatches[0]).toMatchObject({ merchant: "Demo Cafe" });
    expect(offerPatches[0]).not.toHaveProperty("source");
  });

  it("deletes after confirming", async () => {
    offers = [OFFER(6, "Demo Bistro", "active")];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/app/offers/6", { signedIn: true });
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleted).toEqual([6]));
  });
});
