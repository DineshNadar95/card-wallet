import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "./layout/AppShell";
import { CardDetail } from "./pages/CardDetail";
import { Catalog } from "./pages/Catalog";
import { Landing } from "./pages/Landing";
import { MyCards } from "./pages/MyCards";
import { Placeholder } from "./pages/Placeholder";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Placeholder title="Which card should you use?" phase={3} />} />
        <Route path="cards" element={<MyCards />} />
        <Route path="cards/:id" element={<CardDetail />} />
        <Route path="offers" element={<Placeholder title="Offers & coupons" phase={4} />} />
        <Route path="offers/new" element={<Placeholder title="Add an offer" phase={4} />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="compare" element={<Placeholder title="Compare" phase={6} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
