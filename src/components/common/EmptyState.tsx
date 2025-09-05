import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/hooks/api/core";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load this"
      description={errorMessage(error)}
      className={cn("border-destructive/30 bg-destructive-soft/40", className)}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )
      }
    />
  );
}
