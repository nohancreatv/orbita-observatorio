import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: {
      NASA_API_KEY: process.env.NASA_API_KEY ?? "DEMO_KEY",
      VITE_ADSENSE_PUBLISHER_ID: process.env.VITE_ADSENSE_PUBLISHER_ID ?? "ca-pub-5884730150482896",
    },
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/**/*.test.ts", "client/src/**/*.spec.ts"],
  },
});
