// vite.config.js
// Run: npm install vite-plugin-pwa
// Then uncomment the PWA section below.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import { VitePWA } from "vite-plugin-pwa"; // uncomment after: npm install vite-plugin-pwa

export default defineConfig({
  plugins: [
    react(),

    // ── PWA (uncomment after installing vite-plugin-pwa) ──
    // VitePWA({
    //   registerType: "autoUpdate",
    //   manifest: {
    //     name: "Shroom Log",
    //     short_name: "ShroomLog",
    //     description: "Pikmin Bloom mushroom battle tracker",
    //     theme_color: "#0d0820",
    //     background_color: "#0d0820",
    //     display: "standalone",
    //     orientation: "portrait",
    //     start_url: "/",
    //     icons: [
    //       { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    //       { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    //       { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    //     ],
    //   },
    //   workbox: {
    //     globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
    //   },
    // }),
  ],
});
