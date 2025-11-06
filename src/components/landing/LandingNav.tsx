import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Menu } from "lucide-react";
import { Logo } from "@/components/common/Brand";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

const LINKS = [
  ["#features", "Features"],
  ["#how", "How it works"],
  ["#portals", "Portals"],
] as const;

export function LandingNav() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const dashboard = profile ? `/dashboard/${profile.user_type}` : null;

  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {dashboard ? (
            <Button asChild className="hidden sm:inline-flex">
              <Link to={dashboard}>
                <LayoutDashboard /> Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth/customer">Sign in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link to="/auth/customer">Order milk</Link>
              </Button>
            </>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                {LINKS.map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-medium hover:bg-secondary">
                    {label}
                  </a>
                ))}
                <div className="mt-4 grid gap-2">
                  {dashboard ? (
                    <Button asChild>
                      <Link to={dashboard}>Go to dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild>
                        <Link to="/auth/customer">Order milk</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/auth/farmer">I'm a farmer</Link>
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
