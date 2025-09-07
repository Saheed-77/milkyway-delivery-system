import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal-scroll wrapper so wide tables never break the page on phones.
 * Pair with <Table> from ui/table.
 */
export function ResponsiveTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("scrollbar-thin -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6", className)}>
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}
