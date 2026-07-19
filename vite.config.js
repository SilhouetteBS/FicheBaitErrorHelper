import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/FicheBaitErrorHelper/",
  plugins: [react()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/data/errors.js")) return "catalog-errors";
          if (id.includes("/src/data/reviewedSources.js")) return "catalog-sources";
          if (id.includes("/src/data/officialDocumentationErrors.js")) return "catalog-official-docs";
          if (id.includes("/node_modules/")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
