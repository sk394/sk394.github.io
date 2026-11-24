# design.md — "Selection Wheel" Portfolio

A personal portfolio for **Suman** whose entire navigation is a radial selection wheel inspired by the weapon wheel in GTA V. The visitor opens the wheel, points at a wedge (Education, Experience, Skills, Projects…), and the wheel **drills down** into a new ring of wedges, one per item. Selecting an item shows its details in the wheel's center and in a detail panel.

This document is the spec for Claude Code. Build it in the phases listed at the end, and treat every **MUST** as a requirement.

---

## 1. Goals and non-goals

**Goals**
- Feel like the in-game wheel: smoked glass ring, slow-motion blurred world behind it, crisp white highlight on the hovered wedge, satisfying snap and tick when selection changes.
- Look physically real (glass, depth, light), not flat UI.
- Be very fast: first meaningful paint under 1.0 s on 4G, total JS under ~90 KB gzipped (GSAP included), Lighthouse performance 95+ on mobile.
- Work equally well with mouse, touch, keyboard, and gamepad.
- Content is data-driven: editing a Google Sheet updates the site without touching code.

**Non-goals**
- No WebGL or Three.js for the wheel itself. SVG + CSS + GSAP gets the look at a fraction of the weight.
- No reuse of Rockstar assets. See section 12.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro** (static output) with one client island in **vanilla TypeScript** | Ships zero JS except the wheel; content can be fetched at build time |
| Animation | **GSAP 3** core plus `Draggable` and `InertiaPlugin` only if used (all GSAP plugins are free now) | Timelines, precise easing, tiny when tree-shaken |
| Wheel rendering | Inline **SVG** wedges, HTML overlay for text | Crisp at any DPR, hit-testing is free, styleable |
| Styling | Plain CSS with custom properties (no Tailwind runtime) | Smallest output, full control over glass effects |
| Data | Google Sheet → build-time fetch → `content.json`; local `content.seed.json` fallback | No runtime dependency on Google, instant loads |
| Hosting | Cloudflare Pages, Netlify, or Vercel (static) | Deploy hooks for content rebuilds |
| Fonts | Self-hosted WOFF2, subset to Latin plus digits | No layout shift, no third-party requests |

Do not add React, a UI kit, or a CSS framework. If a library is tempting, check its gzipped size against the budget first.

---

## 3. Information architecture

```
Wheel L0 (root)          → up to 8 wedges: categories
  ├─ Education           → L1 ring: one wedge per school
  ├─ Experience          → L1 ring: one wedge per role
  ├─ Projects            → L1 ring: one wedge per project
  ├─ Skills              → L1 ring: one wedge per skill group (Languages, Cloud, AI…)
  ├─ Extracurricular     → L1 ring: one wedge per activity
  ├─ Certifications      (optional, appears only if sheet has rows)
  ├─ Contact             → action wedges: Email, LinkedIn, GitHub, Résumé PDF
  └─ About               → no drill-down; center shows bio
L1 item selected         → center hub + detail panel show the item
```

Rules:
- Wedge count is dynamic: **2 to 8** per ring. Angles are computed, never hard-coded.
- More than 8 items in a category: show 7 items plus a **"More ›"** wedge that pages to the next set (mirrors cycling weapons inside one slot in the game).
- A category with zero visible rows is hidden.
- Back navigation: center hub click, right-click, `Esc`, `Backspace`, the browser back button, or a two-finger tap / swipe-down on mobile. Use the History API so every level has a URL: `/#/experience/acme-construction`. Deep links MUST open the wheel directly at that state.

---

## 4. Visual design

### 4.1 Mood
Night-time city, slow motion. When the wheel opens, the background drops to roughly 30% saturation, blurs, darkens, and shows a faint vignette, the same way the game desaturates the world while you choose a weapon.

### 4.2 Background
- A full-bleed photo or short looping video of a city at dusk (Claude Code: use a royalty-free source such as Pexels or Unsplash and record the credit in `CREDITS.md`). A construction skyline with cranes fits Suman's profession.
- Two versions: sharp (wheel closed) and pre-blurred (wheel open). Crossfade between them with GSAP rather than animating `filter: blur()` live, which is expensive on mobile.
- Serve as AVIF with WebP fallback, under 180 KB for the mobile size. Video, if used, is muted, under 1.5 MB, `preload="none"` on mobile, and poster-first.

### 4.3 The wheel (photo-real recipe)
Build in layers, back to front:

1. **Shadow plate**: soft radial drop shadow under the whole ring (`filter: drop-shadow` on a static layer, not animated).
2. **Glass ring body**: annulus with inner radius about 38% and outer radius 100% of the wheel radius. Fill `rgba(10,10,12,0.55)` with `backdrop-filter: blur(14px) saturate(120%)` on an HTML element clipped to the ring shape (`clip-path: path(...)` generated from the same geometry as the SVG). Provide a solid `rgba(10,10,12,0.82)` fallback when `backdrop-filter` is unsupported.
3. **Wedge separators**: 1.5 px gaps between wedges (achieved with a small angular padding, not strokes), so the background glints through like real separate glass segments.
4. **Surface lighting**:
   - Subtle top-left specular highlight: a radial gradient overlay (white at 8% opacity fading to 0) masked to the ring.
   - Inner bevel: 1 px inner stroke `rgba(255,255,255,0.10)` on the outer edge, `rgba(0,0,0,0.5)` on the inner edge.
   - Film-grain noise: a tiny tiling PNG (or SVG `feTurbulence` baked to PNG at build time) at 4% opacity. This is what sells "real" over "flat".
5. **Hover/selected state** for a wedge:
   - Wedge fill brightens to `rgba(255,255,255,0.14)`.
   - Outer arc gets a 3 px solid white highlight band, the signature look of the game's selected slot.
   - Icon scales to 1.08 and goes from 70% to 100% opacity.
   - Soft outer glow `0 0 24px rgba(255,255,255,0.25)` on that wedge only.
6. **Center hub**: dark glass disc showing the hovered or selected label (large), a sub-label (dates, role, or count of items), and a thin progress or "ammo"-style meter repurposed as something meaningful (years at a role, proficiency for a skill group, or item index such as `2 / 5`).
7. **Pointer needle** (optional, subtle): a thin white arc segment just inside the ring that follows the pointer angle continuously with a short lag, giving analog feel.

### 4.4 Icons
- Category icons: custom monochrome line icons drawn as original SVG (graduation cap, briefcase, wrench/blueprint, chip, trophy, envelope). White, 2 px stroke, rounded caps. Do not trace or copy game weapon silhouettes.
- Item wedges (L1) show the organization's **logo** in monochrome white by default (CSS `filter: brightness(0) invert(1)` or a pre-processed white SVG), switching to full color when hovered. Fallback when no logo: a monogram in the display font.

### 4.5 Typography
- **Display/labels**: a condensed, bold, all-caps sans with an urban feel. Good free options: *Oswald*, *Bebas Neue*, or *Barlow Condensed* (OFL). Use for wedge labels, hub title, section headers.
- **Body**: *Inter* or *Barlow* for detail text.
- Do not use Rockstar's logo lettering or any font distributed as a GTA asset.

### 4.6 Color tokens
```css
:root {
  --glass: rgba(10, 10, 12, 0.55);
  --glass-solid: rgba(10, 10, 12, 0.82);
  --hl: #ffffff;
  --hl-soft: rgba(255, 255, 255, 0.14);
  --text: #f2f2f2;
  --text-dim: rgba(242, 242, 242, 0.62);
  --accent: #6fbf5a;   /* money-green accent, used sparingly: meters, links */
  --danger: #e05a4f;
  --radius-wheel: min(44vmin, 360px);
}
```

### 4.7 Detail panel
When an L1 item is selected:
- **Desktop (≥ 1024 px)**: the wheel slides left (GSAP `x` plus a slight `scale: 0.82`), and a glass panel slides in from the right holding full details.
- **Tablet/mobile**: the panel rises as a bottom sheet (draggable to dismiss) covering about 70% of the viewport; the wheel stays visible, dimmed, above it.
- Panel contents: logo, title, organization, location, dates, bullets, tech tags as chips, links (repo, demo, certificate), optional image gallery with lazy loading.

---

## 5. Interaction

### 5.1 Opening the wheel
- Landing state: Suman's name and one-line title over the city background, plus a prompt such as "Hold **Tab** / Tap to open". The wheel opens automatically after 1.2 s on first visit so no one misses it.
- Desktop: hold `Tab` (or `Q`) to open, release to confirm hovered wedge, mirroring the game. Also support a simple click-to-open for people who don't play games. Holding is a bonus, not the only path.
- Mobile: the wheel is open by default after the intro; there is no "hold" requirement.

### 5.2 Selecting
- **Angle-based selection**, not element hover: compute `atan2` from the wheel center to the pointer, map to a wedge index. Ignore inputs inside a dead zone (radius under 18% of the wheel) so the hub stays clickable. This is how the game feels: you never have to land precisely on a wedge.
- **Mouse**: moving the cursor anywhere on screen selects by angle; click or release confirms.
- **Touch**: put a thumb anywhere on the wheel and drag around it; the wedge under the angle highlights; lifting the finger confirms. A quick tap on a wedge also works.
- **Keyboard**: arrows or `A`/`D` rotate selection, `Enter`/`Space` confirms, `Esc`/`Backspace` goes back, number keys `1–8` jump to wedges.
- **Gamepad** (progressive enhancement via the Gamepad API): left stick selects by angle, `A` confirms, `B` back, bumpers page "More".
- Haptics: `navigator.vibrate(8)` on wedge change on supported Android devices.
- Sound (off by default, toggle in a corner): short soft tick on wedge change, a low whoosh on drill-down. Each under 10 KB, original or CC0, loaded only when sound is enabled.

### 5.3 Drill-down transition (the hero animation)
GSAP timeline, about 550 ms total, `power3.inOut`:
1. Selected wedge flashes brighter (60 ms).
2. Other wedges fade and collapse toward the center (`scale: 0.6, opacity: 0`, stagger 20 ms from the selected wedge outward).
3. Ring rotates 30° and briefly scales to 0.92.
4. New ring's wedges expand out from the center (`scale 0.6 → 1`, stagger outward from the angle of the previous selection), with labels typing in.
5. Hub label crossfades to the category name, sub-label shows item count.

Going back plays the reverse. Every transition MUST be interruptible: a new input kills the running timeline and starts from the current state (`timeline.kill()` plus `gsap.to` from current values), never queuing animations.

### 5.4 Reduced motion
Under `prefers-reduced-motion: reduce`: replace all motion with 120 ms opacity crossfades, disable the needle, the background video, and the rotation.

---

## 6. Geometry (implementation notes)

- Single source of truth: `buildRing(count, innerR, outerR, gapDeg)` returns, per wedge, the SVG `path` d-string, the centroid for label and icon placement, and the start/end angles.
- Start angle: first wedge centered at the top (−90°), going clockwise, like the game.
- Label placement: at about 72% radius, kept upright (never rotated with the wedge).
- For counts of 2 or 3, use larger icons and allow two-line labels; for 7 to 8, use icon plus short label (max 14 characters, use `shortLabel` from the data).
- The wheel scales with `--radius-wheel`. On landscape phones, use `min(44vmin, ...)` so it fits the short axis.
- Recompute geometry only on resize (debounced, `ResizeObserver`), never per frame.

---

## 7. Content and data

### 7.1 Seed content
Until the sheet is connected, content comes from `src/content/content.seed.json`, generated from Suman's résumé.

> **TODO (Suman):** paste the résumé markdown into `docs/resume.md`. Claude Code: parse it into `content.seed.json` following the schema below. Where a field is ambiguous, leave it empty and list it in `docs/content-questions.md` rather than inventing details.

### 7.2 Schema (TypeScript)
```ts
type Category = {
  id: string;              // "experience"
  label: string;           // "Experience"
  shortLabel?: string;
  icon: string;            // icon key in /src/icons
  order: number;
  visible: boolean;
};

type Item = {
  id: string;              // slug, used in URL
  categoryId: string;
  title: string;           // "Software Developer"
  org?: string;            // "Acme Construction"
  shortLabel?: string;     // wedge label
  location?: string;
  start?: string;          // "2021-06"
  end?: string;            // "present" or "2024-01"
  summary?: string;
  bullets: string[];
  tags: string[];          // tech, skills
  links: { label: string; url: string }[];
  logo?: string;           // local path after build, e.g. /logos/acme.svg
  logoDomain?: string;     // "acme.com", used by the logo fetch step
  meter?: { label: string; value: number }; // 0..1, drives the hub meter
  order: number;
  visible: boolean;
};

type Profile = {
  name: string; title: string; tagline: string;
  email?: string; linkedin?: string; github?: string; resumePdf?: string;
};
```

### 7.3 Google Sheet as CMS
One spreadsheet, three tabs: **Profile** (key/value rows), **Categories**, **Items**. Column headers match the schema field names; `bullets`, `tags`, and `links` are pipe-separated (`Built X | Led Y`; links as `Label=URL | Label=URL`).

Pipeline:
1. Sheet is shared as "Anyone with the link can view" (or published to the web as CSV per tab). No API key in the client.
2. `scripts/fetch-content.ts` runs at **build time**: downloads each tab as CSV, validates rows with **zod**, merges with defaults, writes `src/content/content.json`. Invalid rows fail the build with a clear message naming the row and column. If the fetch fails entirely, fall back to the last committed `content.json` and log a warning, so a Google outage never breaks a deploy.
3. **Auto-update**: a Google Apps Script bound to the sheet with an installable `onEdit` / `onChange` trigger, debounced (for example, a time-based trigger that checks a "dirty" flag every 10 minutes), calls the host's **deploy hook** URL. The hook URL is stored in Apps Script Properties, not in the sheet.
4. Optional belt-and-braces: a daily scheduled GitHub Action that rebuilds anyway.

Why build-time instead of fetching the sheet from the browser: no CORS or quota issues, no exposed sheet URL, no loading spinner, works offline from cache, and keeps the page fast. Content changes appear within a few minutes of editing, which is fine for a portfolio.

Excel alternative: if Suman prefers Excel, store the workbook in OneDrive and have the fetch script read it via Microsoft Graph, using the same zod schema. Pick one source; do not support both at runtime.

### 7.4 Logos
- `scripts/fetch-logos.ts` runs at build time for items with a `logoDomain` and no local `logo`. It tries, in order: the organization's official press/brand page, the site's SVG favicon or `apple-touch-icon`, then a monogram fallback.
- Logos are saved into `public/logos/`, optimized (SVGO for SVG, `sharp` to 128 px WebP for raster), and committed. **Never hotlink** logos at runtime.
- Record the source of each logo in `public/logos/SOURCES.md`.

---

## 8. Performance budget

| Metric | Target |
|---|---|
| JS (gzipped, total) | ≤ 90 KB |
| CSS (gzipped) | ≤ 15 KB, critical CSS inlined |
| LCP (mobile, 4G) | ≤ 1.8 s |
| CLS | 0 |
| INP | ≤ 100 ms |
| Background image (mobile) | ≤ 180 KB AVIF |
| Fonts | ≤ 2 files preloaded, `font-display: swap` |

Techniques:
- Import GSAP modules individually (`import { gsap } from "gsap"`), register only the plugins used.
- Animate only `transform` and `opacity`. Never animate `backdrop-filter`, `filter`, `width`, or `height`.
- `will-change: transform` only on the ring group while animating; remove afterward.
- Pointer handling: one listener on the window, compute in a `requestAnimationFrame` callback, update DOM only when the wedge index changes.
- Detail panel images: `loading="lazy"`, `decoding="async"`, explicit width and height.
- Preload the next likely ring's logos when hovering a category for 150 ms.
- Test on a throttled mid-range Android profile, not only a desktop.

---

## 9. Accessibility and SEO

The wheel is a fun layer on top of a real document. That matters because recruiters, screen readers, and search engines will not "hold Tab".

- Render the **entire résumé as semantic HTML** in the page (sections, headings, lists) at build time. The wheel is a progressive enhancement over it. Without JS, the page is a clean, styled résumé.
- A visible **"Plain view"** toggle switches to that document layout at any time; remember the choice in `localStorage` (wrapped in try/catch).
- Wheel semantics: container `role="menu"` with `aria-label` per level, wedges `role="menuitem"`, roving `tabindex`, `aria-live="polite"` region announcing the hovered label.
- Focus is trapped in the detail panel while open and returns to the originating wedge on close.
- Color contrast ≥ 4.5:1 for all text over glass (test against the brightest part of the background).
- Per-route `<title>` and meta description; Open Graph image showing the wheel; JSON-LD `Person` schema with sameAs links.

---

## 10. Responsive behavior

| Breakpoint | Layout |
|---|---|
| < 480 px | Wheel fills width with 16 px margin; labels hidden on L1 rings with more than 6 items (icons/logos only, hub shows the label); detail as bottom sheet |
| 480–1023 px | Same as above with labels shown; bottom sheet at 60% height |
| ≥ 1024 px | Wheel centered; on item select, wheel moves left and panel slides in from the right |
| Landscape phone | Wheel sized by height; detail panel slides from the right at 55% width |

Also: respect safe-area insets (`env(safe-area-inset-*)`), disable pull-to-refresh and text selection while dragging on the wheel (`touch-action: none` on the wheel only, not the page), and make all touch targets at least 44 px.

---

## 11. Project structure

```
/
├─ docs/
│  ├─ resume.md                 # Suman pastes résumé here
│  └─ content-questions.md      # generated: gaps found while parsing
├─ scripts/
│  ├─ fetch-content.ts          # sheet → content.json (zod-validated)
│  ├─ fetch-logos.ts
│  └─ apps-script/deploy-hook.gs
├─ public/
│  ├─ logos/  (+ SOURCES.md)
│  ├─ bg/     # sharp + blurred AVIF/WebP
│  └─ sfx/
├─ src/
│  ├─ content/ content.seed.json, content.json, schema.ts
│  ├─ icons/                    # original SVG line icons
│  ├─ wheel/
│  │  ├─ geometry.ts            # buildRing()
│  │  ├─ input.ts               # pointer/touch/keyboard/gamepad → angle → index
│  │  ├─ state.ts               # level stack + History API routing
│  │  ├─ render.ts              # SVG + overlay DOM
│  │  ├─ anim.ts                # GSAP timelines (open, drill, back, select)
│  │  └─ panel.ts               # detail panel / bottom sheet
│  ├─ styles/ tokens.css, wheel.css, panel.css, plain.css
│  └─ pages/index.astro
├─ CREDITS.md
└─ README.md                    # how to edit the sheet, how deploys trigger
```

---

## 12. Legal and originality guardrails

The concept (a radial selection wheel with a slow-motion background) is a general UI pattern and fine to use. To keep the site clearly original:
- Do not use any Rockstar or GTA artwork, logos, weapon icons, screenshots, fonts shipped with the game, sound effects, or the "GTA" name in the UI.
- Icons, sounds, and textures are original or from CC0/OFL/royalty-free sources, with credits in `CREDITS.md`.
- The site may say "inspired by game selection wheels" in an About blurb if Suman wants; it should not claim affiliation.

---

## 13. Build phases (for Claude Code)

Each phase ends with a working, deployable site.

1. **Scaffold + plain view**: Astro project, tokens, fonts, seed content parsed from `docs/resume.md`, semantic résumé page. Lighthouse check.
2. **Static wheel**: `buildRing`, SVG render, glass layers, L0 categories, angle-based hover with mouse and touch, keyboard. No GSAP yet.
3. **Drill-down + routing**: level stack, History API, deep links, back behavior, "More" paging.
4. **GSAP motion**: open/close, drill-down hero timeline, hover micro-animations, interruptibility, reduced-motion path.
5. **Detail panel**: desktop side panel and mobile bottom sheet with drag-to-dismiss, focus management.
6. **Photo-real polish**: background crossfade, specular overlay, grain, glow, needle, optional sound and haptics.
7. **Data pipeline**: Google Sheet fetch with zod, logo fetch and optimization, Apps Script deploy hook, daily rebuild Action.
8. **QA**: performance budget check, axe accessibility audit, real-device testing (iOS Safari, Android Chrome), gamepad test, no-JS test.

---

## 14. Acceptance checklist

- [ ] Wheel opens and selects correctly with mouse, touch, keyboard, and gamepad.
- [ ] Any number of items from 1 to 20 per category renders correctly (with "More" paging).
- [ ] Every state has a URL; reloading or sharing it restores the state.
- [ ] Rapid inputs never leave the wheel in a half-animated or broken state.
- [ ] Editing a cell in the Google Sheet results in a live update within ~15 minutes, with no code change.
- [ ] A broken row in the sheet fails the build with a readable error and the live site stays up.
- [ ] Page works and is readable with JavaScript disabled.
- [ ] Meets the performance budget on a throttled mid-range Android device.
- [ ] No GTA/Rockstar assets anywhere in the repo.

---

## 15. Open questions for Suman

1. Background: city at night generally, or a construction skyline with cranes to tie in your work?
2. Sound: include optional UI sounds, or keep it silent?
3. Google Sheets or Excel (OneDrive) as the content source?
4. Hosting preference (Cloudflare Pages, Netlify, Vercel, or your Oracle server)?
5. Should "Contact" be a wedge on the root ring, or a fixed corner button?