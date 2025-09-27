import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo } from "@/components/common/Brand";
import { PageSkeleton } from "@/components/common/Skeletons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveUpdates } from "@/hooks/api/core";
import { fullName } from "@/lib/format";
import { ROLE_META } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/services";
import { DemoBanner } from "./DemoBanner";
import { activeNavItem, NAV, navHref, type NavItem } from "./nav";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

function SidebarNav({ role }: { role: UserRole }) {
  const { pathname } = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const active = activeNavItem(role, pathname);

  const groups = NAV[role].reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? "Menu";
    (acc[g] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([group, items]) => (
        <SidebarGroup key={group}>
          <SidebarGroupLabel>{group}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={active?.path === item.path}
                      tooltip={item.label}
                      className="h-10 rounded-xl font-medium data-[active=true]:bg-primary-soft data-[active=true]:text-primary"
                    >
                      <NavLink to={navHref(role, item.path)} end onClick={() => isMobile && setOpenMobile(false)}>
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function MobileBottomNav({ role }: { role: UserRole }) {
  const { pathname } = useLocation();
  const items = NAV[role].filter((n) => n.mobile);
  const active = activeNavItem(role, pathname);
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pt-1.5 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active?.path === item.path;
          return (
            <li key={item.path}>
              <NavLink
                to={navHref(role, item.path)}
                end
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", isActive && "bg-primary-soft")}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Shared dashboard chrome for every role. */
export function AppShell({ role }: { role: UserRole }) {
  const { profile, isDemo } = useAuth();
  const { pathname } = useLocation();
  const active = activeNavItem(role, pathname);
  const meta = ROLE_META[role];
  const RoleIcon = meta.icon;
  const hasBottomNav = NAV[role].some((n) => n.mobile);

  useLiveUpdates();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="px-3 py-4">
          <Logo to={`/dashboard/${role}`} className="group-data-[collapsible=icon]:[&>span]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav role={role} />
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-2 rounded-xl bg-secondary p-2 group-data-[collapsible=icon]:hidden">
            <span className={cn("grid h-8 w-8 place-items-center rounded-lg", meta.tone)}>
              <RoleIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold">{fullName(profile)}</p>
              <p className="truncate text-muted-foreground">{meta.label} account</p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        {isDemo && <DemoBanner />}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
          <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{active?.label ?? meta.label}</p>
          </div>
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className={cn("flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8", hasBottomNav && "pb-28 md:pb-8")}>
          <div className="mx-auto w-full max-w-7xl animate-fade-in">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </SidebarInset>

      {hasBottomNav && <MobileBottomNav role={role} />}
    </SidebarProvider>
  );
}
