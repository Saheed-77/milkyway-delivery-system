import { motion } from "framer-motion";

/**
 * Lightweight animated "live map" for the hero — pure SVG so the landing page
 * doesn't pay for Leaflet. A scooter follows a dashed route from the farm to a
 * home while ETA chips float over the map.
 */
export function RouteIllustration() {
  const route = "M60 300 C 140 300, 150 200, 230 190 S 330 120, 400 110 S 470 60, 520 60";
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-xl">
      <div className="absolute inset-0 rounded-[2rem] border bg-card shadow-lift" />
      <svg viewBox="0 0 580 440" className="relative h-full w-full" role="img" aria-label="Rider travelling from farm to home on a map">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
          </pattern>
          <clipPath id="frame">
            <rect x="0" y="0" width="580" height="440" rx="32" />
          </clipPath>
        </defs>
        <g clipPath="url(#frame)">
          <rect width="580" height="440" fill="url(#grid)" opacity="0.7" />
          {/* blocks & greenery */}
          <rect x="300" y="210" width="120" height="80" rx="14" fill="hsl(var(--primary-soft))" />
          <rect x="90" y="70" width="110" height="70" rx="14" fill="hsl(var(--accent))" />
          <circle cx="470" cy="320" r="46" fill="hsl(var(--primary-soft))" />
          <path d="M0 380 C 120 350, 260 420, 580 360 L 580 440 L 0 440 Z" fill="hsl(var(--info-soft))" />
          {/* roads */}
          <path d={route} fill="none" stroke="hsl(var(--card))" strokeWidth="22" strokeLinecap="round" />
          <path d={route} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" strokeLinecap="round" />
          <path d={route} fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 12" className="animate-dash-move" />
        </g>
        {/* farm */}
        <g transform="translate(60 300)">
          <circle r="22" fill="hsl(var(--primary))" />
          <path d="M-8 6 V-4 L0 -10 L8 -4 V6 Z" fill="white" />
        </g>
        {/* home */}
        <g transform="translate(520 60)">
          <circle r="22" fill="hsl(var(--info))" />
          <path d="M-9 2 L0 -8 L9 2 V9 H-9 Z" fill="white" />
        </g>
        {/* rider */}
        <motion.g
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
          style={{ offsetPath: `path("${route}")`, offsetRotate: "0deg" }}
        >
          <circle r="20" fill="hsl(var(--primary))" opacity="0.2" />
          <circle r="13" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="4" />
        </motion.g>
      </svg>

      <motion.div
        className="absolute -left-2 top-10 rounded-2xl border bg-card px-4 py-3 shadow-lift sm:-left-6"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <p className="text-xs text-muted-foreground">Arriving in</p>
        <p className="text-lg font-bold">6 min</p>
      </motion.div>
      <motion.div
        className="absolute -right-2 bottom-12 rounded-2xl border bg-card px-4 py-3 shadow-lift sm:-right-6"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <p className="text-xs text-muted-foreground">Delivery code</p>
        <p className="font-mono text-lg font-extrabold tracking-[0.25em]">4 8 2 7</p>
      </motion.div>
    </div>
  );
}
