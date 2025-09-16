/**
 * Leaflet divIcons rendered as HTML so they follow the app's theme tokens.
 * (Default Leaflet PNG markers also break under bundlers.)
 */
import L from "leaflet";

const pin = (inner: string, bg: string, size = 34) =>
  L.divIcon({
    className: "mw-marker",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -size],
    html: `
      <div style="position:relative;width:${size}px;height:${size + 8}px">
        <div style="width:${size}px;height:${size}px;border-radius:999px 999px 999px 4px;transform:rotate(-45deg);
          background:${bg};box-shadow:0 4px 12px hsl(var(--shadow-color)/.25);border:2px solid hsl(var(--card));
          display:grid;place-items:center">
          <div style="transform:rotate(45deg);color:white;font:700 13px/1 'Plus Jakarta Sans',sans-serif;display:grid;place-items:center">${inner}</div>
        </div>
      </div>`,
  });

const svg = {
  home: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/></svg>`,
  depot: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>`,
  farm: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8v4l2 3v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V10l2-3z"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
};

export const homeIcon = pin(svg.home, "hsl(var(--info))");
export const depotIcon = pin(svg.depot, "hsl(var(--foreground))");
export const farmIcon = pin(svg.farm, "hsl(var(--primary))");

export type StopState = "next" | "upcoming" | "done" | "unassigned" | "selected";

const STOP_BG: Record<StopState, string> = {
  next: "hsl(var(--primary))",
  upcoming: "hsl(var(--info))",
  done: "hsl(var(--success))",
  unassigned: "hsl(var(--warning))",
  selected: "hsl(var(--destructive))",
};

export const stopIcon = (label: string | number, state: StopState = "upcoming") =>
  pin(state === "done" ? svg.check : String(label), STOP_BG[state], state === "selected" ? 40 : 34);

/** Rider: a scooter dot with a heading arrow and a pulse ring. */
export const riderIcon = (heading: number | null, color = "hsl(var(--primary))", label?: string) =>
  L.divIcon({
    className: "mw-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;width:44px;height:44px;display:grid;place-items:center">
        <span class="mw-rider-pulse" style="position:absolute;inset:8px;border-radius:999px;background:${color};opacity:.35"></span>
        ${
          heading == null
            ? ""
            : `<div style="position:absolute;inset:0;transform:rotate(${heading}deg)">
                <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:0;height:0;
                  border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${color}"></div>
              </div>`
        }
        <div style="position:relative;width:28px;height:28px;border-radius:999px;background:${color};border:3px solid hsl(var(--card));
          box-shadow:0 4px 14px hsl(var(--shadow-color)/.3);display:grid;place-items:center;color:white;font:700 11px/1 'Plus Jakarta Sans',sans-serif">
          ${label ?? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l3 8M5.5 17.5 9 8h6l3.5 9.5"/></svg>`}
        </div>
      </div>`,
  });

export const RIDER_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-3))",
];
