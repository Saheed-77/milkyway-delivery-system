import { describe, expect, it } from "vitest";
import { dailyBuckets, weekStart, windowSum } from "./analytics";
import { addDays, formatLiters, parseLocalDate, percentChange, round2, toLocalISODate } from "./format";
import { haversine, pathLength, pointAlong } from "./geo";
import { estimateRoute, optimizeStops } from "./routing";

describe("format", () => {
  it("uses local calendar dates, not UTC", () => {
    // 00:30 local time must stay on the same day (toISOString would shift it in IST)
    const d = new Date(2025, 9, 3, 0, 30);
    expect(toLocalISODate(d)).toBe("2025-10-03");
    expect(toLocalISODate(parseLocalDate("2025-10-03"))).toBe("2025-10-03");
  });

  it("rounds fractional subscription demand for display", () => {
    expect(formatLiters(1 / 7)).toBe("0.14 L");
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("has a well-defined percent change when the baseline is zero", () => {
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull(); // shown as "new", not a fake +100%
    expect(percentChange(150, 100)).toBe(50);
  });
});

describe("analytics", () => {
  it("zero-fills every day in the window", () => {
    const end = new Date(2025, 9, 10);
    const rows = [{ d: "2025-10-10", v: 2 }, { d: "2025-10-08", v: 3 }, { d: "2025-09-01", v: 99 }];
    const series = dailyBuckets(3, rows, (r) => r.d, { v: (r) => r.v }, end);
    expect(series.map((p) => [p.key, p.v])).toEqual([
      ["2025-10-08", 3],
      ["2025-10-09", 0],
      ["2025-10-10", 2],
    ]);
  });

  it("starts weeks on Monday", () => {
    expect(toLocalISODate(weekStart(new Date(2025, 9, 5)))).toBe("2025-09-29"); // Sunday → previous Monday
  });

  it("sums a trailing window", () => {
    const today = toLocalISODate();
    const yesterday = toLocalISODate(addDays(new Date(), -1));
    const rows = [{ d: today, v: 1 }, { d: yesterday, v: 10 }];
    expect(windowSum(rows, (r) => r.d, (r) => r.v, 1, 0)).toBe(1);
    expect(windowSum(rows, (r) => r.d, (r) => r.v, 2, 1)).toBe(10);
  });
});

describe("geo & routing", () => {
  const depot = { lat: 9.9971, lng: 76.2996 };

  it("computes plausible distances", () => {
    // Kaloor → Edappally is roughly 3.3 km as the crow flies
    const d = haversine(depot, { lat: 10.0261, lng: 76.3086 });
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(3800);
  });

  it("walks along a path and clamps at the end", () => {
    const path = [depot, { lat: 10.0, lng: 76.2996 }];
    const len = pathLength(path);
    expect(pointAlong(path, len / 2).done).toBe(false);
    expect(pointAlong(path, len * 2)).toMatchObject({ done: true, point: path[1] });
  });

  it("orders stops to avoid zig-zagging", () => {
    const near = { id: "near", lat: 10.0, lng: 76.3 };
    const mid = { id: "mid", lat: 10.02, lng: 76.3 };
    const far = { id: "far", lat: 10.05, lng: 76.3 };
    expect(optimizeStops(depot, [far, near, mid]).map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("falls back to a straight-line estimate with per-leg data", () => {
    const r = estimateRoute([depot, { lat: 10.0, lng: 76.31 }, { lat: 10.01, lng: 76.32 }]);
    expect(r.source).toBe("estimate");
    expect(r.legs).toHaveLength(2);
    expect(r.distance).toBeGreaterThan(0);
    expect(r.duration).toBeGreaterThan(0);
  });
});
