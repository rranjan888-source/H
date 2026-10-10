import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import DocumentList from "@/pages/DocumentList";
import DocumentDetail from "@/pages/DocumentDetail";
import Schedule from "@/pages/Schedule";
import People from "@/pages/People";
import Assets from "@/pages/Assets";
import Customers from "@/pages/Customers";
import Reports from "@/pages/Reports";
import Forms from "@/pages/Forms";
import TechMobile from "@/pages/TechMobile";
import Settings from "@/pages/Settings";
import PublicQuote from "@/pages/PublicQuote";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/public/quote/:id" element={<PublicQuote />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/quotes" element={<DocumentList kind="quote" />} />
          <Route path="/quotes/:id" element={<DocumentDetail kind="quote" />} />
          <Route path="/sales-orders" element={<DocumentList kind="sales_order" />} />
          <Route path="/sales-orders/:id" element={<DocumentDetail kind="sales_order" />} />
          <Route path="/invoices" element={<DocumentList kind="invoice" />} />
          <Route path="/invoices/:id" element={<DocumentDetail kind="invoice" />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/people" element={<People />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/tech" element={<TechMobile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </>
  );
}
