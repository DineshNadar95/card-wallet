import { ApiProvider, createApiClient } from "@card-wallet/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

function renderAt(path: string) {
  const client = createApiClient({ baseUrl: "http://api.test" });
  return render(
    <ApiProvider client={client}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ApiProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ status: "ok", version: "0.1.0" })),
  );
});

describe("landing", () => {
  it("shows the headline and the demo CTA", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Know which card to use.");
    expect(screen.getByRole("link", { name: /try the demo/i })).toHaveAttribute("href", "/app");
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
    expect(tabs.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Home",
      "Cards",
      "Offers",
      "Compare",
    ]);
  });

  it("marks the current route active", () => {
    renderAt("/app/offers");
    const tabs = within(screen.getByRole("navigation", { name: "Tabs" }));
    expect(tabs.getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("shows API health from /health", async () => {
    renderAt("/app");
    expect(await screen.findByText("API connected")).toBeInTheDocument();
  });
});
