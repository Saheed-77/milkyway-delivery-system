import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FullPageLoader, ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/contexts/AuthContext";
import { IS_DEMO } from "@/config/env";
import type { UserRole } from "@/services";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Route-level code splitting: dashboards (and Leaflet) load only when visited.
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/shared/SettingsPage"));

const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const LiveOps = lazy(() => import("./pages/admin/LiveOps"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminFarmers = lazy(() => import("./pages/admin/AdminFarmers"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));

const FarmerOverview = lazy(() => import("./pages/farmer/FarmerOverview"));
const FarmerContributions = lazy(() => import("./pages/farmer/FarmerContributions"));
const FarmerPayments = lazy(() => import("./pages/farmer/FarmerPayments"));
const FarmerWallet = lazy(() => import("./pages/farmer/FarmerWallet"));
const FarmerReports = lazy(() => import("./pages/farmer/FarmerReports"));

const OrderMilk = lazy(() => import("./pages/customer/OrderMilk"));
const MyOrders = lazy(() => import("./pages/customer/MyOrders"));
const TrackOrder = lazy(() => import("./pages/customer/TrackOrder"));
const Subscriptions = lazy(() => import("./pages/customer/Subscriptions"));
const WalletPage = lazy(() => import("./pages/customer/WalletPage"));

const RiderRoute = lazy(() => import("./pages/delivery/RiderRoute"));
const Stops = lazy(() => import("./pages/delivery/Stops"));
const Completed = lazy(() => import("./pages/delivery/Completed"));
const Collections = lazy(() => import("./pages/delivery/Collections"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const shell = (role: UserRole) => (
  <ProtectedRoute role={role}>
    <AppShell role={role} />
  </ProtectedRoute>
);

function DemoSimulator() {
  useEffect(() => {
    if (!IS_DEMO) return;
    let stop: (() => void) | undefined;
    void import("@/services/mock/simulator").then((m) => {
      m.startSimulator();
      stop = m.stopSimulator;
    });
    return () => stop?.();
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={200}>
      <Toaster closeButton position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <DemoSimulator />
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Navigate to="/auth/customer" replace />} />
              <Route path="/auth/:userType" element={<Auth />} />

              <Route path="/dashboard/admin" element={shell("admin")}>
                <Route index element={<AdminOverview />} />
                <Route path="live" element={<LiveOps />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="collections" element={<AdminCollections />} />
                <Route path="farmers" element={<AdminFarmers />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="inventory" element={<AdminInventory />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard/admin" replace />} />
              </Route>

              <Route path="/dashboard/farmer" element={shell("farmer")}>
                <Route index element={<FarmerOverview />} />
                <Route path="contributions" element={<FarmerContributions />} />
                <Route path="payments" element={<FarmerPayments />} />
                <Route path="wallet" element={<FarmerWallet />} />
                <Route path="reports" element={<FarmerReports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard/farmer" replace />} />
              </Route>

              <Route path="/dashboard/customer" element={shell("customer")}>
                <Route index element={<OrderMilk />} />
                <Route path="orders" element={<MyOrders />} />
                <Route path="track/:orderId" element={<TrackOrder />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="wallet" element={<WalletPage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard/customer" replace />} />
              </Route>

              <Route path="/dashboard/delivery" element={shell("delivery")}>
                <Route index element={<RiderRoute />} />
                <Route path="schedule" element={<Navigate to="/dashboard/delivery" replace />} />
                <Route path="pending" element={<Stops />} />
                <Route path="completed" element={<Completed />} />
                <Route path="collections" element={<Collections />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard/delivery" replace />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
