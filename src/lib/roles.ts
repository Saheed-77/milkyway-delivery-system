import { Bike, ShieldCheck, ShoppingBasket, Tractor, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/services";

export interface RoleMeta {
  role: UserRole;
  label: string;
  noun: string;
  icon: LucideIcon;
  tagline: string;
  /** Tailwind classes for the role's accent chip. */
  tone: string;
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  customer: {
    role: "customer",
    label: "Customer",
    noun: "customer",
    icon: ShoppingBasket,
    tagline: "Order fresh milk, subscribe and track your delivery live.",
    tone: "bg-info-soft text-info",
  },
  farmer: {
    role: "farmer",
    label: "Farmer",
    noun: "farmer",
    icon: Tractor,
    tagline: "Log your milk, watch earnings grow and get paid fairly.",
    tone: "bg-primary-soft text-primary",
  },
  delivery: {
    role: "delivery",
    label: "Rider",
    noun: "delivery rider",
    icon: Bike,
    tagline: "Optimised routes, live navigation and OTP hand-offs.",
    tone: "bg-warning-soft text-[hsl(30_80%_32%)] dark:text-warning",
  },
  admin: {
    role: "admin",
    label: "Admin",
    noun: "admin",
    icon: ShieldCheck,
    tagline: "Dispatch, inventory, farmer payments and analytics.",
    tone: "bg-destructive-soft text-destructive",
  },
};

export const ROLES: UserRole[] = ["customer", "farmer", "delivery", "admin"];

export const isRole = (v: string | undefined): v is UserRole => !!v && (ROLES as string[]).includes(v);
