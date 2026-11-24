// Build-time content fetch: Notion → zod validation → src/content/content.json.
//
//   npm run content              fetch, validate, write content.json + public/content-version.txt
//   npm run content:check        fetch + validate only; print the content hash (used by CI to skip no-op deploys)
//
// Env: NOTION_TOKEN (internal integration secret), NOTION_PAGE_ID (page holding the
// Profile / Categories / Items databases, and optionally Blog). Without them the committed
// content is used.
//
// Failure policy:
//   - invalid rows        → exit 1 with the row and column named (the live site stays up)
//   - Notion unreachable  → warn and keep the last committed content.json
//   - a post body fails   → exit 1 (the live site stays up, rather than losing its posts)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { validateContent, type Content } from "../src/content/schema.ts";
import { env, findSources, queryAll, selectOptions, toCategory, toItem, toPost, toProfile, ITEM_COLUMNS, CATEGORY_COLUMNS, POST_COLUMNS, type PostRow } from "./notion.ts";
import { fetchBlocks, readingMinutes, renderBlocks } from "./notion-blocks.ts";
import { prune, saveCover, saveFile, saveHtml, saveImage } from "./media.ts";

const hashOnly = process.argv.includes("--hash-only");
const LIVE = path.resolve("src/content/content.json");
const SEED = path.resolve("src/content/content.seed.json");
const LOGOS = path.resolve("public/logos");

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

function writeVersion(json: string) {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/content-version.txt", hash(json) + "\n");
}

function committed(): string {
  return fs.readFileSync(fs.existsSync(LIVE) ? LIVE : SEED, "utf8");
}

async function downloadLogo(id: string, url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(LOGOS, { recursive: true });
    const isSvg = (res.headers.get("content-type") ?? "").includes("svg") || /\.svg(\?|$)/i.test(url);
    if (isSvg) {
      fs.writeFileSync(path.join(LOGOS, `${id}.svg`), buf);
      return `/logos/${id}.svg`;
    }
    await sharp(buf).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toFile(path.join(LOGOS, `${id}.webp`));
    return `/logos/${id}.webp`;
  } catch (e) {
    console.warn(`  ! logo for "${id}" could not be downloaded (${(e as Error).message}); using fallback`);
    return undefined;
  }
}

async function fromNotion(token: string, page: string) {
  const src = await findSources(token, page);
  const [profileRows, catRows, itemRows, postRows, order] = await Promise.all([
    queryAll(token, src.Profile), queryAll(token, src.Categories), queryAll(token, src.Items),
    src.Blog ? queryAll(token, src.Blog) : [], src.Blog ? selectOptions(token, src.Blog, "Category") : ([] as string[]),
  ]);
  // Drafts are left out entirely: they are never written to disk and editing one doesn't redeploy.
  const posts = postRows.map(toPost).filter((p) => p !== null);
  const rank = (p: PostRow) => order.indexOf(p.post.category) + 1 || order.length + 1;
  posts.sort((a, b) => rank(a) - rank(b) || b.post.date.localeCompare(a.post.date) || a.post.title.localeCompare(b.post.title));
  // A row's last_edited_time also moves when its page body is edited, so posts needn't be read to spot a change.
  const edited = [...profileRows, ...catRows, ...itemRows].map((r) => r.last_edited_time).concat(posts.map((p) => p.edited)).sort().join(",");
  const items = itemRows.map(toItem).sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.order - b.order);
  const raw = {
    profile: toProfile(profileRows),
    categories: catRows.map(toCategory).sort((a, b) => a.order - b.order),
    items: items.map(({ _logoFile, ...i }) => ({ ...i, ...(_logoFile ? { logo: `/logos/${i.id}.webp` } : {}) })),
    posts: posts.map((p) => p.post),
  };
  return { raw, items, posts, edited };
}

/** Reads each published post's page body and renders it to HTML, downloading its files. */
async function renderPosts(token: string, rows: PostRow[], content: Content) {
  const urls = new Map(rows.map((r) => [r.pageId.replace(/-/g, ""), `{{BASE}}/blog/${r.post.id}/`]));
  for (const row of rows) {
    const post = content.posts.find((p) => p.id === row.post.id)!;
    const warn = (m: string) => console.warn(`  ! post "${post.title}": ${m}`);
    const attempt = async <T>(what: string, get: () => Promise<T | undefined>) => {
      try {
        const got = await get();
        if (got === undefined) warn(`${what} could not be used; skipped`);
        return got;
      } catch (e) {
        warn(`${what} could not be downloaded (${(e as Error).message}); skipped`);
        return undefined;
      }
    };
    const blocks = await fetchBlocks(token, row.pageId, warn);
    post.html = await renderBlocks(blocks, {
      image: (url, name) => attempt("an image", () => saveImage(url, name)),
      file: (url, name) => attempt("a file", () => saveFile(url, name)),
      html: (url, name) => attempt("an HTML block", () => saveHtml(url, name)),
      post: (id) => urls.get(id.toLowerCase()),
      warn,
    });
    post.minutes = readingMinutes(post.html);
    if (row.coverUrl) {
      const saved = await attempt("the cover", () => saveCover(row.coverUrl!, `${row.pageId.replace(/-/g, "")}-cover`));
      if (saved) { post.cover = saved.cover; post.og = saved.og; }
    }
    if (!post.html) warn("the page is empty");
  }
  prune();
}

function checkReferences(c: Content) {
  const cats = new Set(c.categories.map((x) => x.id));
  const problems: string[] = [];
  const seen = new Set<string>();
  c.items.forEach((i, n) => {
    if (!cats.has(i.categoryId)) problems.push(`  - items (row ${n + 1}: "${i.title}") → column "Category": "${i.categoryId}" is not a category ID (${[...cats].join(", ")})`);
    if (seen.has(i.id)) problems.push(`  - items (row ${n + 1}: "${i.title}") → column "ID": duplicate id "${i.id}"`);
    seen.add(i.id);
  });
  const slugs = new Set<string>();
  for (const p of c.posts) {
    if (slugs.has(p.id)) problems.push(`  - posts ("${p.title}") → column "ID": another published post already uses "${p.id}"`);
    slugs.add(p.id);
  }
  if (!c.profile.name) problems.push(`  - profile → key "name" is empty`);
  if (problems.length) throw new Error(`Invalid content from Notion:\n${problems.join("\n")}`);
}

async function main() {
  const cfg = env();
  if (!cfg) {
    if (hashOnly) { console.log("unconfigured"); return; }
    console.log("Notion not configured (NOTION_TOKEN / NOTION_PAGE_ID); using committed content.");
    writeVersion(committed());
    return;
  }

  let fetched: Awaited<ReturnType<typeof fromNotion>>;
  try {
    fetched = await fromNotion(cfg.token, cfg.page);
  } catch (e) {
    const msg = (e as Error).message;
    if (/missing database|→ 40[134]/.test(msg)) throw e; // configuration problems should be loud
    if (hashOnly) { console.log("unreachable"); return; }
    console.warn(`::warning::Notion fetch failed, keeping last committed content.json: ${msg}`);
    writeVersion(committed());
    return;
  }

  const content = validateContent(fetched.raw, "Notion", { items: ITEM_COLUMNS, categories: CATEGORY_COLUMNS, posts: POST_COLUMNS });
  checkReferences(content);
  const json = JSON.stringify(content, null, 2) + "\n";

  if (hashOnly) { console.log(hash(json + fetched.edited)); return; }

  await renderPosts(cfg.token, fetched.posts, content);

  // Download logos uploaded to Notion (their URLs expire, so they are never hotlinked).
  for (const i of fetched.items) {
    if (!i._logoFile) continue;
    const local = await downloadLogo(i.id, i._logoFile);
    const target = content.items.find((x) => x.id === i.id)!;
    if (local) target.logo = local;
    else delete target.logo;
  }
  const out = JSON.stringify(content, null, 2) + "\n";
  fs.writeFileSync(LIVE, out);
  fs.writeFileSync("public/content-version.txt", hash(json + fetched.edited) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), LIVE)}: ${content.categories.length} categories, ${content.items.length} items, ${content.posts.length} posts.`);
}

main().catch((e) => {
  console.error(`\n✖ ${(e as Error).message}\n`);
  process.exit(1);
});
