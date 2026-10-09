import { useHealth } from "@card-wallet/shared";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router";

import { Logo } from "./Logo";

type NavItem = { to: string; label: string; short: string; icon: ReactNode; tab: boolean };

const icon = (paths: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

// Sidebar (>= 768px) shows every item; bottom tabs (< 768px) show the four from Main.dc.html.
export const NAV: NavItem[] = [
  {
    to: "/app",
    label: "Home",
    short: "Home",
    tab: true,
    icon: icon(
      <>
        <path d="M4 11l8-7 8 7" />
        <path d="M6 10v9h12v-9" />
      </>,
    ),
  },
  {
    to: "/app/cards",
    label: "My cards",
    short: "Cards",
    tab: true,
    icon: icon(
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" />
      </>,
    ),
  },
  {
    to: "/app/offers",
    label: "Offers & coupons",
    short: "Offers",
    tab: true,
    icon: icon(
      <>
        <path d="M20.6 13.4 11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" />
        <circle cx="7.5" cy="7.5" r="1.3" />
      </>,
    ),
  },
  {
    to: "/app/catalog",
    label: "Card catalog",
    short: "Catalog",
    tab: false,
    icon: icon(
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </>,
    ),
  },
  {
    to: "/app/compare",
    label: "Compare",
    short: "Compare",
    tab: true,
    icon: icon(
      <>
        <rect x="3" y="4" width="7" height="16" rx="1.5" />
        <rect x="14" y="4" width="7" height="16" rx="1.5" />
      </>,
    ),
  },
];

function ApiStatus() {
  const { isSuccess, isError } = useHealth();
  const label = isSuccess ? "API connected" : isError ? "API offline" : "Checking API…";
  return (
    <span className={`api-status ${isSuccess ? "ok" : isError ? "down" : ""}`} role="status">
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function AppShell() {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <Link to="/" className="brand">
          <Logo />
          Card Wallet
        </Link>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/app"} className="side-link">
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <ApiStatus />
        </div>
      </aside>

      <div className="shell-main">
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="tabs" aria-label="Tabs">
        {NAV.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/app"} className="tab">
            {n.icon}
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
