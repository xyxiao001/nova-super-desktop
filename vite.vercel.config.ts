import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
const mediaProxy = {
  "/books": { target: "https://nova-books.pages.dev", changeOrigin: true },
  "/music": { target: "https://nova-books.pages.dev", changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true, proxy: mediaProxy },
  preview: { port: 3000, strictPort: true, proxy: mediaProxy },
  build: {
    outDir: "dist-vercel",
    emptyOutDir: true,
  },
});
