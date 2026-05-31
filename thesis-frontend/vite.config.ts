import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Must come BEFORE /api so Vite matches /api/hubs first.
      // Student browser sends hub requests to /api/hubs/... (due to how SignalR
      // resolves relative hub URLs inside the /api-prefixed app). Strip /api so
      // the backend sees /hubs/chat and /hubs/notifications as expected.
      "/api/hubs": {
        target: "http://localhost:5180",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/api": {
        target: "http://localhost:5180",
        changeOrigin: true,
      },
      "/hubs": {
        target: "http://localhost:5180",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
