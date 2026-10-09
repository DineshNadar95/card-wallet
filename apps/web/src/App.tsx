import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "./layout/AppShell";
import { AddOffer } from "./pages/AddOffer";
import { CardDetail } from "./pages/CardDetail";
import { Catalog } from "./pages/Catalog";
import { EditOffer } from "./pages/EditOffer";
import { Home } from "./pages/Home";
import { Landing } from "./pages/Landing";
import { MyCards } from "./pages/MyCards";
import { Offers } from "./pages/Offers";
import { Placeholder } from "./pages/Placeholder";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="cards" element={<MyCards />} />
        <Route path="cards/:id" element={<CardDetail />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/new" element={<AddOffer />} />
        <Route path="offers/:id" element={<EditOffer />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="compare" element={<Placeholder title="Compare" phase={6} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
