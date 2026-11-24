// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages: the deploy workflow passes SITE (e.g. https://sk394.github.io)
// and BASE (e.g. /folio, or / for a <user>.github.io repo) from actions/configure-pages.
const site = process.env.SITE || "https://sk394.github.io";
const base = process.env.BASE || "/";

export default defineConfig({
  site,
  base,
  output: "static",
  // Blog posts live at /blog/<slug>/; the list of them is the wheel.
  redirects: { "/blog": `${base.replace(/\/$/, "")}/#/blog` },
  build: { inlineStylesheets: "always", assets: "_assets" },
  compressHTML: true,
  devToolbar: { enabled: false },
});
