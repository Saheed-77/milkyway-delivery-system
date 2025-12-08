import { Link } from "react-router-dom";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MilkType } from "@/services";

export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("h-9 w-9", className)}>
      <rect width="64" height="64" rx="18" className={inverted ? "fill-white/15" : "fill-primary"} />
      <path d="M24 12h16v6l4 8v24a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V26l4-8z" fill="hsl(48 40% 97%)" />
      <path d="M20 34c6-4 12 4 24 0v16a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="hsl(208 72% 86%)" />
      <rect x="23" y="10" width="18" height="5" rx="2" fill="hsl(150 30% 22%)" />
    </svg>
  );
}

export function Logo({
  to = "/",
  className,
  compact,
  inverted,
}: {
  to?: string;
  className?: string;
  compact?: boolean;
  /** For use on the primary-coloured brand panel. */
  inverted?: boolean;
}) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 font-bold tracking-tight", className)} aria-label="MilkyWay home">
      <LogoMark inverted={inverted} />
      {!compact && (
        <span className="text-lg leading-none">
          Milky<span className="text-primary">Way</span>
        </span>
      )}
    </Link>
  );
}

const AVATAR_TONES = [
  "bg-primary-soft text-primary",
  "bg-info-soft text-info",
  "bg-warning-soft text-[hsl(30_80%_32%)] dark:text-warning",
  "bg-destructive-soft text-destructive",
  "bg-success-soft text-success",
];

/** Local initials avatar (replaces the external dicebear service, which leaked names). */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <div
      className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold", tone, className)}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

const MILK_DOT: Record<MilkType, string> = {
  cow: "bg-chart-1",
  buffalo: "bg-chart-2",
  goat: "bg-chart-3",
};

export function MilkDot({ type, className }: { type: MilkType; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", MILK_DOT[type], className)} aria-hidden />;
}
