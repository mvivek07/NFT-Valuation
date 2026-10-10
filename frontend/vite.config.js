import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build output goes to dist/, which the Flask backend serves directly.
// `npm run dev` proxies API + figure requests to the Flask server on :5000.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/figures": "http://localhost:5000",
    },
  },
});
