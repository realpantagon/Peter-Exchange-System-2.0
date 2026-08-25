import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    hmr: {
      clientPort: 5173,
    },
    // Keeps the API on the same '/api' path in dev as it is in production,
    // where the Worker serves both the app and the API. Run `pnpm dev:worker`
    // alongside `pnpm dev`.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  plugins: [
    tailwindcss(),
    react()
  ],
});
