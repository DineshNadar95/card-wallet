import { ApiProvider, createApiClient } from "@card-wallet/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
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

function mockApi() {
  walletCards = [];
  posted = [];
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
