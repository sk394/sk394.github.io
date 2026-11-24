# Folio: selection-wheel portfolio

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

## Deploy to GitHub Pages

1. Create a GitHub repo and push:
   ```sh
   git init -b main
   git add .
   git commit -m "Initial portfolio"
   git remote add origin https://github.com/sk394/<repo>.git
   git push -u origin main
   ```
   - Repo named **`sk394.github.io`** → site at `https://sk394.github.io/`
   - Any other name (e.g. `folio`) → `https://sk394.github.io/folio/`. The base path is detected automatically.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The push triggers **Deploy to GitHub Pages** (`.github/workflows/deploy.yml`). Done.

The site works right away from the seed content. Notion is optional and can be added any time.

## Notion as the CMS

### One-time setup (about 5 minutes)

1. **Create an integration:** go to <https://www.notion.so/profile/integrations>, choose **New integration** (Internal), and copy the secret (`ntn_…`).
   The integration only needs **Read content**, plus **Insert content** for the setup script.
2. **Create a page** in Notion, e.g. "Portfolio". On that page choose **••• → Connections → add your integration**.
3. **Create and seed the tables** from your current content:
   ```sh
   cp .env.example .env      # fill in NOTION_TOKEN and NOTION_PAGE_ID (the page URL works)
   npm run notion:setup
   ```
   This creates four inline databases on the page: **Profile**, **Categories**, **Items** and **Blog**.
   Re-running it only adds the ones that are missing.
4. **Add the same two values as GitHub secrets:** go to Settings → Secrets and variables → Actions and add `NOTION_TOKEN` and `NOTION_PAGE_ID`.
5. Run the workflow once (Actions → Deploy → Run workflow), or just wait.

### How updates go live

- Every **15 minutes** the workflow fetches Notion and compares a content hash with the live site's
  `/content-version.txt`. It only builds and deploys when something changed, so an edit in Notion
  is usually live within about 15–20 minutes.
- A **daily** forced rebuild keeps durations like "1 yr 3 mo" current.
- Every **push** to `main` deploys too.
- If a row is invalid, the build fails with a message such as
  `items (row 3: "Software Application Developer") → column "Start": use "YYYY-MM"…`,
  and **the live site stays up**. If Notion is unreachable, the last committed `content.json` is used.

> GitHub pauses scheduled workflows in repos with no activity for 60 days. If that happens,
> re-enable it from the Actions tab (any push also resets the clock).

### Editing the tables

**Profile**: one row per key (`Key` → `Value`): `name`, `title`, `tagline`, `about`, `email`,
`linkedin`, `github`, `phone` (optional), `location`, `resumePdf` (e.g. `/resume.pdf` with the file in `public/`).

**Categories**: these are the root wedges.

| Column | Notes |
|---|---|
| Label | Wedge / section name |
| ID | Slug used in URLs and by Items → `Category` (`experience`, `projects`, …). `about`, `contact` and `blog` are special |
| Short Label | ≤ 14 chars, used when the ring is crowded |
| Icon | `briefcase`, `blueprint`, `chip`, `cap`, `trophy`, `badge`, `envelope`, `user`, `code`, `layers`, `wrench`, … |
| Order / Visible | Sorting; untick to hide. Categories with no visible items are hidden automatically |

**Items**: one row per school, role, project or skill group.

| Column | Notes |
|---|---|
| Title, Organization | Role/degree/project name, and org |
| ID | URL slug (`#/experience/<id>`); auto-generated from the title if empty |
| Category | Must match a Category ID |
| Short Label | Wedge label (≤ 14 chars) |
| Start, End, Current | Dates (only month/year are used). Tick **Current** for "Present" |
| Summary, Bullets | Bullets: one per line |
| Tags | Tech/skills chips |
| Links | One per line: `Repo=https://github.com/…` |
| Logo | Upload an image (it's downloaded at build time, never hotlinked), **or** set **Logo Domain** (e.g. `pile.com`) to auto-fetch |
| Meter Label / Meter Value | Optional hub meter (0–100%). Defaults: time in role, skill count, or position `2 / 5` |
| Order / Visible | Sorting and hiding |

**Blog**: one row per post. Open the row and write the article in its page body.

| Column | Notes |
|---|---|
| Title | Post title |
| Category | Each category is a wedge on the Blog ring. Type a new name to add one; drag the options to reorder them. Empty = `General` |
| Published | Unticked rows are drafts: never fetched into the site, and editing them doesn't redeploy |
| Date | Shown on the post; newest first. Empty = the day the row was created |
| Summary, Tags | Optional. The summary is also the link-preview text |
| Short Label | Wedge label (≤ 14 chars). Empty = the title, shortened |
| Icon | Wedge icon, `document` if empty |
| ID | URL slug: `/blog/<id>/`. Empty = made from the title, so set it to keep the URL when you rename a post |

The row's page cover becomes the post's cover and link-preview image. Supported in the body: text and
headings, lists, to-dos, toggles, quotes, callouts, code (highlighted), equations, tables, columns, tabs,
images, video, audio, files, bookmarks, embeds (YouTube, Vimeo, Loom, CodePen, Figma, …), synced blocks,
table of contents, and `/html` blocks (run in a sandboxed frame). Anything else is skipped with a warning
in the build log. Files are copied to the site at build time, up to 25 MB each.

The **Categories** row with the ID `blog` is the root wedge; it appears once a post is published.

More than 8 items in a category automatically pages as 7 plus a **More ›** wedge.

## Controls

| | |
|---|---|
| Mouse | Point anywhere (selection by angle); click to open; right-click or click the hub to go back |
| Touch | Drag a thumb around the wheel and lift to open; tap works too; two-finger tap or swipe down from the hub goes back |
| Keyboard | Hold `Tab`/`Q` to open; `← →` / `A D` select; `1–8` jump; `Enter` open; `Esc`/`Backspace` back; `PageUp/PageDown` page |
| Gamepad | Left stick selects, A opens, B goes back, bumpers page |

Every state has a URL (`#/experience/pile-dynamics`) and the browser back button works.
Sound is off by default (speaker button, top right).

## Project layout

```
docs/            resume.md (source), content-questions.md (gaps to confirm)
scripts/         fetch-content.ts, notion.ts, notion-blocks.ts (page → HTML), media.ts, notion-setup.ts, fetch-logos.ts, build-assets.ts
public/          bg/ (generated), logos/ (+ SOURCES.md), media/blog/ (from Notion), og.png, favicon.svg
src/content/     schema.ts (zod), load.ts, content.seed.json, content.json (from Notion)
src/wheel/       geometry, state (routing), render, anim (GSAP), input, panel, sound, main
src/pages/       index.astro (wheel + plain view), blog/[slug].astro (a post)
src/styles/      tokens, wheel, panel, plain, post
.github/workflows/deploy.yml
```

## Customizing the background

Drop a royalty-free photo at `assets/bg-source.jpg` and run `npm run assets`. It generates the sharp
and pre-blurred AVIF/WebP pairs, then commit them and credit the photo in `CREDITS.md`. Without a photo, an
original night skyline with tower cranes is drawn procedurally.
