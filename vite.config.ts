import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      viteEnvironment: { name: "server" },
      inspectorPort: false,
      config: {
        name: "ovflow",
        main: "./worker/index.ts",
        compatibility_date: "2026-05-15",
        assets: {
          binding: "ASSETS",
          not_found_handling: "single-page-application",
          run_worker_first: ["/api/*"],
        },
      },
    }),
    tailwind(),
    VitePWA({
      registerType: "autoUpdate",
      outDir: "dist/client",
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "data/delijn-stops.json",
      ],
      manifest: {
        name: "OVFlow — onderweg in België",
        short_name: "OVFlow",
        description:
          "Je vertrekbord, routeplanner en stationskaart voor België.",
        theme_color: "#176b58",
        background_color: "#f5f7f8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/server/**"],
        maximumFileSizeToCacheInBytes: 3500000,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
  environments: {
    client: {
      build: {
        rollupOptions: { output: { manualChunks: { map: ["maplibre-gl"] } } },
      },
    },
  },
});
