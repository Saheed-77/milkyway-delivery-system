import { Milk } from "lucide-react";
import { MilkDot } from "@/components/common/Brand";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatLiters } from "@/lib/format";
import type { Contribution } from "@/services";

const QUALITY_BADGE = {
  1: <Badge variant="success">Good</Badge>,
  2: <Badge variant="warning">Average</Badge>,
  3: <Badge variant="danger">Rejected</Badge>,
} as const;

interface ContributionsTableProps {
  rows: Contribution[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  showFarmer?: boolean;
  emptyHint?: string;
}

export function ContributionsTable({ rows = [], isLoading, error, onRetry, showFarmer, emptyHint }: ContributionsTableProps) {
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (rows.length === 0)
    return <EmptyState icon={Milk} title="No collections in this period" description={emptyHint ?? "Try a wider date range."} compact />;

  return (
    <ResponsiveTable>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showFarmer && <TableHead>Farmer</TableHead>}
            <TableHead>Milk</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="whitespace-nowrap">{formatDate(c.contribution_date)}</TableCell>
              {showFarmer && (
                <TableCell>
                  <span className="font-medium">{c.farmer_name}</span>
                  {c.farmer_code && <span className="ml-1.5 font-mono text-xs text-muted-foreground">#{c.farmer_code}</span>}
                </TableCell>
              )}
              <TableCell>
                <span className="flex items-center gap-1.5 capitalize">
                  <MilkDot type={c.milk_type} /> {c.milk_type}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatLiters(c.quantity)}</TableCell>
              <TableCell>{c.quality_rating ? QUALITY_BADGE[c.quality_rating] : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-right tabular-nums">{c.quantity > 0 ? formatCurrency(c.value) : "—"}</TableCell>
              <TableCell>
                {c.quantity === 0 ? (
                  <span className="text-xs text-muted-foreground">n/a</span>
                ) : c.payment_status ? (
                  <StatusBadge status={c.payment_status} label={c.payment_status === "approved" ? "Paid" : c.payment_status === "pending" ? "Requested" : undefined} />
                ) : (
                  <Badge variant="muted">Unpaid</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}
