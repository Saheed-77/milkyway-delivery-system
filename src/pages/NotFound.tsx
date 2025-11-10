import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, MilkOff } from "lucide-react";
import { Logo } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="container flex h-16 items-center">
        <Logo />
      </header>
      <main className="container flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <MilkOff className="h-8 w-8" />
        </span>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="text-3xl font-extrabold">This page spilled</h1>
          <p className="max-w-md text-muted-foreground">
            We couldn't find <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{pathname}</code>.
          </p>
        </div>
        <Button asChild>
          <Link to="/">
            <ArrowLeft /> Back home
          </Link>
        </Button>
      </main>
    </div>
  );
};

export default NotFound;
