import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "./layout/AppShell";
import { Landing } from "./pages/Landing";
import { Placeholder } from "./pages/Placeholder";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Placeholder title="Which card should you use?" phase={3} />} />
        <Route path="cards" element={<Placeholder title="My cards" phase={2} />} />
        <Route path="cards/:id" element={<Placeholder title="Card detail" phase={2} />} />
        <Route path="offers" element={<Placeholder title="Offers & coupons" phase={4} />} />
        <Route path="offers/new" element={<Placeholder title="Add an offer" phase={4} />} />
        <Route path="catalog" element={<Placeholder title="Card catalog" phase={2} />} />
        <Route path="compare" element={<Placeholder title="Compare" phase={6} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
