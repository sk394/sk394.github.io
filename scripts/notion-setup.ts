// One-time setup: creates the Profile / Categories / Items / Blog databases under your Notion page
// and fills them from the current content (content.json, else content.seed.json).
// Safe to re-run: databases that already exist are left alone (and not re-seeded).
//
//   NOTION_TOKEN=... NOTION_PAGE_ID=... npm run notion:setup      (or put both in .env)
import fs from "node:fs";
import path from "node:path";
import { validateContent, type Content } from "../src/content/schema.ts";
import { iconNames } from "../src/icons/index.ts";
import { api, env, TABLES, type Table } from "./notion.ts";

const cfg = env();
if (!cfg) {
  console.error("Set NOTION_TOKEN and NOTION_PAGE_ID (see README → Notion setup).");
  process.exit(1);
}
const { token, page } = cfg;

const file = ["src/content/content.json", "src/content/content.seed.json"].map((p) => path.resolve(p)).find((p) => fs.existsSync(p))!;
const content: Content = validateContent(JSON.parse(fs.readFileSync(file, "utf8")), path.basename(file));

const text = (s?: string) => ({
  rich_text: s ? (s.match(/[\s\S]{1,1900}/g) ?? []).map((c) => ({ type: "text", text: { content: c } })) : [],
});
const title = (s: string) => ({ title: [{ type: "text", text: { content: s } }] });
const date = (ym?: string) => (ym && ym !== "present" ? { date: { start: ym.length === 4 ? `${ym}-01-01` : `${ym}-01` } } : { date: null });
const sel = (s?: string) => ({ select: s ? { name: s } : null });
const opts = (names: string[]) => ({ options: [...new Set(names)].slice(0, 100).map((name) => ({ name })) });

const SCHEMAS: Record<Table, Record<string, unknown>> = {
  Profile: { Key: { title: {} }, Value: { rich_text: {} } },
  Categories: {
    Label: { title: {} }, ID: { rich_text: {} }, "Short Label": { rich_text: {} },
    Icon: { select: opts(iconNames) }, Order: { number: {} }, Visible: { checkbox: {} },
  },
  Items: {
    Title: { title: {} }, ID: { rich_text: {} },
    Category: { select: opts(content.categories.map((c) => c.id)) },
    Organization: { rich_text: {} }, "Short Label": { rich_text: {} }, Icon: { select: opts(iconNames) },
    Location: { rich_text: {} }, Start: { date: {} }, End: { date: {} }, Current: { checkbox: {} },
    Summary: { rich_text: {} }, Bullets: { rich_text: {} },
    Tags: { multi_select: opts(content.items.flatMap((i) => i.tags)) },
    Links: { rich_text: {} }, Logo: { files: {} }, "Logo Domain": { rich_text: {} },
    "Meter Label": { rich_text: {} }, "Meter Value": { number: { format: "percent" } },
    Order: { number: {} }, Visible: { checkbox: {} },
  },
  // One row per post; the row's page body is the article.
  Blog: {
    Title: { title: {} }, Category: { select: {} }, Published: { checkbox: {} }, Date: { date: {} },
    Summary: { rich_text: {} }, Tags: { multi_select: {} }, "Short Label": { rich_text: {} },
    Icon: { select: opts(iconNames) }, ID: { rich_text: {} },
  },
};

function rows(t: Table): Record<string, unknown>[] {
  if (t === "Blog") return []; // posts are written in Notion
  if (t === "Profile") {
    return Object.entries(content.profile).filter(([, v]) => v).map(([k, v]) => ({ Key: title(k), Value: text(String(v)) }));
  }
  if (t === "Categories") {
    return content.categories.map((c) => ({
      Label: title(c.label), ID: text(c.id), "Short Label": text(c.shortLabel), Icon: sel(c.icon),
      Order: { number: c.order }, Visible: { checkbox: c.visible },
    }));
  }
  return content.items.map((i) => ({
    Title: title(i.title), ID: text(i.id), Category: sel(i.categoryId), Organization: text(i.org),
    "Short Label": text(i.shortLabel), Icon: sel(i.icon), Location: text(i.location),
    Start: date(i.start), End: date(i.end), Current: { checkbox: i.end === "present" },
    Summary: text(i.summary), Bullets: text(i.bullets.join("\n")),
    Tags: { multi_select: i.tags.map((name) => ({ name })) },
    Links: text(i.links.map((l) => `${l.label}=${l.url}`).join("\n")),
    "Logo Domain": text(i.logoDomain), "Meter Label": text(i.meter?.label),
    "Meter Value": { number: i.meter?.value ?? null }, Order: { number: i.order }, Visible: { checkbox: i.visible },
  }));
}

const existing = new Map<string, string>();
const children = await api(token, `/blocks/${page}/children?page_size=100`);
for (const b of children.results) if (b.type === "child_database") existing.set(String(b.child_database.title).toLowerCase(), b.id);

for (const t of TABLES) {
  if (existing.has(t.toLowerCase())) {
    console.log(`• ${t}: already exists, skipped`);
    continue;
  }
  const db = await api(token, "/databases", "POST", {
    parent: { type: "page_id", page_id: page },
    title: [{ type: "text", text: { content: t } }],
    is_inline: true,
    initial_data_source: { properties: SCHEMAS[t] },
  });
  const source = db.data_sources?.[0]?.id;
  const list = rows(t);
  for (const properties of list) {
    await api(token, "/pages", "POST", { parent: { type: "data_source_id", data_source_id: source }, properties });
    await new Promise((r) => setTimeout(r, 340)); // stay under Notion's ~3 requests/second
  }
  console.log(`✓ ${t}: created with ${list.length} rows`);
}
console.log("\nDone. Edit the tables in Notion; the site picks changes up on the next build.");
