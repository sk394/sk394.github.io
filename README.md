# Portfolio: selection-wheel portfolio

A personal portfolio whose navigation is a radial selection wheel: a smoked-glass ring over a
blurred night skyline, angle-based selection, drill-down rings per category, and a detail panel.
Under the wheel, the whole résumé is rendered as plain semantic HTML. That's what you get with
JavaScript off, with **Plain view**, and what search engines index.

- **Stack:** Astro (static) · vanilla TypeScript · GSAP · plain CSS. About 37 KB of JS gzipped.
- **Content:** Notion (fetched at build time, so no token or API calls in the browser), with a local seed file as the fallback.
- **Hosting:** GitHub Pages via GitHub Actions (free).

See [DESIGN.md](DESIGN.md) for the full spec.

## Run locally

```sh
npm install
npm run dev          # http://localhost:4321
npm run build        # → dist/
npm run preview
```

Requires Node 22.18+ (scripts are TypeScript run natively by Node; 24 recommended).

| Script | What it does |
|---|---|
| `npm run content` | Notion → validated `src/content/content.json` (skips if Notion isn't configured) |
| `npm run logos` | Fetches missing logos for items with a `logoDomain` into `public/logos/` |
| `npm run assets` | Regenerates the background, grain, OG image and favicon |
| `npm run notion:setup` | One-time: creates and seeds the Notion databases |

Content resolution: `src/content/content.json` if present, otherwise `src/content/content.seed.json`.

## Customizing the background

Drop a royalty-free photo at `assets/bg-source.jpg` and run `npm run assets`. It generates the sharp
and pre-blurred AVIF/WebP pairs, then commit them and credit the photo in `CREDITS.md`. Without a photo, an
original night skyline with tower cranes is drawn procedurally.
