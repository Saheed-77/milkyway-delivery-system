import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className, lines = 4 }: { className?: string; lines?: number }) {
  return (
    <Card className={cn("space-y-4 p-6", className)}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <StatGridSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2" lines={6} />
        <CardSkeleton />
      </div>
    </div>
  );
}
