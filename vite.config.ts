/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // Long-lived vendor chunks so app deploys don't bust the whole cache.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) return "radix";
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) return "motion";
          if (id.includes("leaflet")) return "leaflet";
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "charts";
          if (id.includes("@tanstack")) return "query";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
