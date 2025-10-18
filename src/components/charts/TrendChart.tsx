import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Point } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface TrendChartProps {
  data: Point[];
  config: ChartConfig;
  type?: "area" | "bar";
  stacked?: boolean;
  className?: string;
  /** Formats values in the tooltip (e.g. currency). */
  valueFormatter?: (value: number, key: string) => string;
  yWidth?: number;
  legend?: boolean;
}

/**
 * Thin wrapper over shadcn/recharts with the app's palette. Series colours come
 * from `config` (use var(--color-<key>)), so light/dark themes just work.
 */
export function TrendChart({ data, config, type = "area", stacked, className, valueFormatter, yWidth = 40, legend }: TrendChartProps) {
  const keys = Object.keys(config);
  const tooltip = (
    <ChartTooltip
      cursor={type === "bar" ? { fill: "hsl(var(--muted))" } : true}
      content={
        <ChartTooltipContent
          indicator={type === "bar" ? "dot" : "line"}
          formatter={
            valueFormatter
              ? (value, name, item) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                      {config[String(name)]?.label ?? name}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">{valueFormatter(Number(value), String(name))}</span>
                  </div>
                )
              : undefined
          }
        />
      }
    />
  );
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} fontSize={12} />
      <YAxis tickLine={false} axisLine={false} width={yWidth} fontSize={12} />
    </>
  );

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-64 w-full", className)}>
      {type === "bar" ? (
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          {axes}
          {tooltip}
          {legend && <ChartLegend content={<ChartLegendContent />} />}
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={`var(--color-${k})`}
              radius={stacked ? (i === keys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]) : [6, 6, 0, 0]}
              stackId={stacked ? "a" : undefined}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            {keys.map((k) => (
              <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
                <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {axes}
          {tooltip}
          {legend && <ChartLegend content={<ChartLegendContent />} />}
          {keys.map((k) => (
            <Area
              key={k}
              dataKey={k}
              type="monotone"
              stroke={`var(--color-${k})`}
              strokeWidth={2.2}
              fill={`url(#fill-${k})`}
              stackId={stacked ? "a" : undefined}
            />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  );
}
