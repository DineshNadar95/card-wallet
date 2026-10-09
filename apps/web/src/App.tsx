import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";

import { useAuth } from "./auth";

import { AppShell } from "./layout/AppShell";
import { AddOffer } from "./pages/AddOffer";
import { CardDetail } from "./pages/CardDetail";
import { Catalog } from "./pages/Catalog";
import { Compare } from "./pages/Compare";
import { EditOffer } from "./pages/EditOffer";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { MyCards } from "./pages/MyCards";
import { Offers } from "./pages/Offers";

/** "Try the demo": turn on read-only demo data for this tab, then go to the app. */
function StartDemo() {
  const { startDemo, session } = useAuth();
  useEffect(() => {
    if (!session) startDemo();
  }, [session, startDemo]);
  return <Navigate to="/app" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<StartDemo />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="cards" element={<MyCards />} />
        <Route path="cards/:id" element={<CardDetail />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/new" element={<AddOffer />} />
        <Route path="offers/:id" element={<EditOffer />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="compare" element={<Compare />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
