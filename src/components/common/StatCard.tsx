import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "warning" | "success" | "danger" | "muted";

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-destructive-soft text-destructive",
  muted: "bg-muted text-muted-foreground",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  /** Percent change vs previous period; null = no baseline. */
  trend?: number | null;
  /** Whether a decrease is good (e.g. leftover milk). */
  invertTrend?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  trend,
  invertTrend,
  loading,
  className,
  onClick,
}: StatCardProps) {
  const up = (trend ?? 0) > 0;
  const flat = trend === 0 || trend === undefined;
  const good = invertTrend ? !up : up;
  const Interactive = onClick ? "button" : "div";

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 sm:p-5",
        onClick && "transition-shadow hover:shadow-lift",
        className
      )}
    >
      <Interactive
        onClick={onClick}
        className={cn("flex w-full items-start justify-between gap-3 text-left", onClick && "cursor-pointer")}
      >
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-[13px] sm:normal-case sm:tracking-normal">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl xl:text-[26px]">{value}</p>
          )}
          {(hint || trend !== undefined) && !loading && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {trend !== undefined && trend !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                    flat ? "bg-muted" : good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
                  )}
                >
                  {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend).toFixed(0)}%
                </span>
              )}
              {trend === null && <span className="rounded-full bg-muted px-1.5 py-0.5 font-semibold">new</span>}
              {hint && <span className="truncate">{hint}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11", toneStyles[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </Interactive>
    </Card>
  );
}
