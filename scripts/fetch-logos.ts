// Fetches logos for items that have a `logoDomain` but no logo yet, from the organization's
// own site: an SVG icon or apple-touch-icon declared in its HTML, then /apple-touch-icon.png.
// Results go to public/logos/<item-id>.(svg|webp) and are committed; the site never hotlinks.
// Items without a logo fall back to a monogram. Sources are recorded in public/logos/SOURCES.md.
//
//   npm run logos            only missing logos
//   npm run logos -- --force refetch all
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { validateContent } from "../src/content/schema.ts";

const force = process.argv.includes("--force");
const DIR = path.resolve("public/logos");
const SOURCES = path.join(DIR, "SOURCES.md");
const file = ["src/content/content.json", "src/content/content.seed.json"].map((p) => path.resolve(p)).find((p) => fs.existsSync(p))!;
const content = validateContent(JSON.parse(fs.readFileSync(file, "utf8")), path.basename(file));
fs.mkdirSync(DIR, { recursive: true });

const UA = "Mozilla/5.0 (portfolio logo fetch; +https://github.com)";
const get = (url: string) => fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });

function candidates(html: string, base: string): string[] {
  const out: { url: string; score: number }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = /rel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const href = /href=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href || !/icon/.test(rel)) continue;
    const url = new URL(href, base).href;
    const svg = /\.svg(\?|$)/i.test(url) || /image\/svg/i.test(tag);
    const size = Number(/sizes=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    out.push({ url, score: (svg ? 1000 : 0) + (rel.includes("apple-touch") ? 500 : 0) + size });
  }
  return out.sort((a, b) => b.score - a.score).map((c) => c.url).filter((u) => !/\.ico(\?|$)/i.test(u));
}

function cleanSvg(s: string): string {
  return s
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function save(id: string, url: string): Promise<string | null> {
  const res = await get(url);
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (type.includes("svg") || /\.svg(\?|$)/i.test(url)) {
    const svg = cleanSvg(buf.toString("utf8"));
    if (!svg.includes("<svg")) return null;
    fs.writeFileSync(path.join(DIR, `${id}.svg`), svg);
    return `${id}.svg`;
  }
  const meta = await sharp(buf).metadata().catch(() => null);
  if (!meta?.width || meta.width < 32) return null;
  await sharp(buf).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toFile(path.join(DIR, `${id}.webp`));
  return `${id}.webp`;
}

const log: string[] = [];
for (const item of content.items) {
  if (!item.logoDomain || item.logo) continue;
  const have = ["svg", "webp", "png"].some((e) => fs.existsSync(path.join(DIR, `${item.id}.${e}`)));
  if (have && !force) continue;
  const home = `https://${item.logoDomain}/`;
  let saved: string | null = null;
  let from = "";
  try {
    const res = await get(home);
    const html = res.ok ? await res.text() : "";
    for (const url of [...candidates(html, res.url || home), new URL("/apple-touch-icon.png", home).href]) {
      saved = await save(item.id, url).catch(() => null);
      if (saved) { from = url; break; }
    }
  } catch (e) {
    console.warn(`  ! ${item.logoDomain}: ${(e as Error).message}`);
  }
  if (saved) {
    console.log(`✓ ${item.id} ← ${from}`);
    log.push(`| ${saved} | ${item.org ?? item.title} | ${from} | ${new Date().toISOString().slice(0, 10)} |`);
  } else {
    console.log(`– ${item.id}: no usable logo at ${item.logoDomain}; monogram fallback`);
  }
}

if (log.length) {
  const head = "# Logo sources\n\nLogos are trademarks of their owners, used only to identify organizations I have worked with or studied at.\n\n| File | Organization | Source | Fetched |\n|---|---|---|---|\n";
  const prev = fs.existsSync(SOURCES) ? fs.readFileSync(SOURCES, "utf8") : head;
  const names = new Set(log.map((l) => l.split("|")[1].trim()));
  const kept = prev.split("\n").filter((l) => !(l.startsWith("| ") && names.has(l.split("|")[1].trim())));
  fs.writeFileSync(SOURCES, (kept.join("\n").trimEnd() || head.trimEnd()) + "\n" + log.join("\n") + "\n");
}
