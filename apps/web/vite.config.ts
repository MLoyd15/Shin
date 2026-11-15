import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  resolve: { alias: { "@": path.resolve(webDirectory, "src") } },
  server: { port: 5173, strictPort: true },
});
