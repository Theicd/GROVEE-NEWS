import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fetchProxyPlugin } from "./vite/fetchProxyPlugin";

export default defineConfig({
  plugins: [react(), fetchProxyPlugin()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5190,
    strictPort: true,
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "onnxruntime-web"],
  },
});
