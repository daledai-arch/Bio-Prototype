import { defineConfig } from "vite";

// Built by Netlify (see netlify.toml): `npm run build` → dist/
export default defineConfig({
  build: { target: "es2020" }
});
