import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  LayoutDashboard,
  Map,
  Milk,
  Package,
  Repeat,
  Route,
  Settings,
  ShoppingBasket,
  Tag,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/services";

export interface NavItem {
  /** Path relative to /dashboard/:role ("" = index). */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  mobile?: boolean;
  group?: string;
}

export const NAV: Record<UserRole, NavItem[]> = {
  admin: [
    { path: "", label: "Overview", icon: LayoutDashboard, group: "Operations" },
    { path: "live", label: "Live Ops", icon: Map, group: "Operations" },
    { path: "orders", label: "Orders", icon: ShoppingBasket, group: "Operations" },
    { path: "slots", label: "Delivery slots", icon: CalendarClock, group: "Operations" },
    { path: "collections", label: "Collections", icon: Milk, group: "Supply" },
    { path: "farmers", label: "Farmers", icon: Users, group: "Supply" },
    { path: "payments", label: "Farmer payments", icon: IndianRupee, group: "Supply" },
    { path: "inventory", label: "Inventory", icon: Warehouse, group: "Supply" },
    { path: "pricing", label: "Pricing", icon: Tag, group: "Business" },
    { path: "reports", label: "Reports", icon: BarChart3, group: "Business" },
    { path: "settings", label: "Settings", icon: Settings, group: "Account" },
  ],
  farmer: [
    { path: "", label: "Overview", icon: LayoutDashboard, mobile: true },
    { path: "contributions", label: "My milk", icon: Milk, mobile: true },
    { path: "payments", label: "Payments", icon: IndianRupee, mobile: true },
    { path: "wallet", label: "Wallet", icon: Wallet },
    { path: "reports", label: "Reports", icon: BarChart3 },
    { path: "settings", label: "Settings", icon: Settings, mobile: true },
  ],
  customer: [
    { path: "", label: "Order milk", icon: ShoppingBasket, mobile: true },
    { path: "orders", label: "My orders", icon: Package, mobile: true },
    { path: "subscriptions", label: "Subscriptions", icon: Repeat, mobile: true },
    { path: "wallet", label: "Wallet", icon: Wallet, mobile: true },
    { path: "settings", label: "Settings", icon: Settings },
  ],
  delivery: [
    { path: "", label: "Today's route", icon: Route, mobile: true },
    { path: "pending", label: "Stops", icon: ClipboardList, mobile: true },
    { path: "completed", label: "Completed", icon: CheckCircle2, mobile: true },
    { path: "collections", label: "Milk collection", icon: Milk, mobile: true },
    { path: "settings", label: "Settings", icon: Settings },
  ],
};

export const navHref = (role: UserRole, path: string) => (path ? `/dashboard/${role}/${path}` : `/dashboard/${role}`);

export function activeNavItem(role: UserRole, pathname: string): NavItem | undefined {
  const rest = pathname.replace(`/dashboard/${role}`, "").replace(/^\//, "").split("/")[0] ?? "";
  // legacy delivery paths
  const alias: Record<string, string> = { schedule: "" };
  const key = alias[rest] ?? rest;
  return NAV[role].find((n) => n.path === key) ?? (key === "track" ? NAV[role].find((n) => n.path === "orders") : undefined);
}

