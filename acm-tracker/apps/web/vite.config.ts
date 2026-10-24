import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const apiTarget = process.env.API_PROXY_TARGET ?? `http://localhost:${process.env.API_PORT ?? 4000}`;

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/i18n/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
      manifest: {
        name: "ACM-TRACKER",
        short_name: "ACM",
        description: "Tracker de tiempo y costo para tu equipo.",
        lang: "es",
        theme_color: "#0B0D12",
        background_color: "#0B0D12",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Live-data tracker: never serve a cached SPA shell for /api, and never
        // runtime-cache API responses — stale time/cost data is worse than an error.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
});
