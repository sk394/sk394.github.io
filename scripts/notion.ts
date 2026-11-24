// Minimal Notion API client (no SDK) + the mapping between Notion rows and the content schema.
// Uses API version 2025-09-03 (databases contain data sources; rows are queried per data source).
import type { Category, Item, Profile } from "../src/content/schema.ts";

const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";

export function env() {
  const token = process.env.NOTION_TOKEN?.trim();
  const page = process.env.NOTION_PAGE_ID?.trim().replace(/^.*?([0-9a-f]{32}).*$/i, "$1");
  return token && page ? { token, page } : null;
}

export async function api<T = any>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) return res.json() as Promise<T>;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after") || 1) * 1000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
}

export const TABLES = ["Profile", "Categories", "Items"] as const;
export type Table = (typeof TABLES)[number];

/** Finds the three databases (by title) directly under the portfolio page; returns their data source ids. */
export async function findSources(token: string, page: string): Promise<Record<Table, string>> {
  const found: Partial<Record<Table, string>> = {};
  let cursor: string | undefined;
  do {
    const r = await api(token, `/blocks/${page}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of r.results) {
      if (b.type !== "child_database") continue;
      const t = TABLES.find((x) => x.toLowerCase() === String(b.child_database.title).trim().toLowerCase());
      if (t && !found[t]) {
        const db = await api(token, `/databases/${b.id}`);
        found[t] = db.data_sources?.[0]?.id;
      }
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  const missing = TABLES.filter((t) => !found[t]);
  if (missing.length) {
    throw new Error(`Notion page is missing database(s): ${missing.join(", ")}. Run "npm run notion:setup" or share the page with your integration.`);
  }
  return found as Record<Table, string>;
}

export async function queryAll(token: string, source: string): Promise<any[]> {
  const rows: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await api(token, `/data_sources/${source}/query`, "POST", { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    rows.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// ---- reading properties --------------------------------------------------------

type Props = Record<string, any>;

const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join("").trim();

export function prop(p: Props, name: string): any {
  const v = p[name];
  if (!v) return undefined;
  switch (v.type) {
    case "title": return plain(v.title) || undefined;
    case "rich_text": return plain(v.rich_text) || undefined;
    case "number": return v.number ?? undefined;
    case "checkbox": return v.checkbox;
    case "select": return v.select?.name ?? undefined;
    case "multi_select": return v.multi_select.map((o: any) => o.name);
    case "url": return v.url ?? undefined;
    case "email": return v.email ?? undefined;
    case "phone_number": return v.phone_number ?? undefined;
    case "date": return v.date ?? undefined;
    case "files": return v.files.map((f: any) => ({ name: f.name, url: f.file?.url ?? f.external?.url }));
    default: return undefined;
  }
}

const lines = (s?: string) => (s ?? "").split(/\r?\n|\s+\|\s+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const month = (d?: string) => (d ? d.slice(0, 7) : undefined);

/** Human-friendly Notion column names → schema fields (also used for error messages). */
export const ITEM_COLUMNS: Record<string, string> = {
  title: "Title", id: "ID", categoryId: "Category", org: "Organization", shortLabel: "Short Label", icon: "Icon",
  location: "Location", start: "Start", end: "End", summary: "Summary", bullets: "Bullets", tags: "Tags",
  links: "Links", logo: "Logo", logoDomain: "Logo Domain", meter: "Meter Value", order: "Order", visible: "Visible",
};
export const CATEGORY_COLUMNS: Record<string, string> = {
  label: "Label", id: "ID", shortLabel: "Short Label", icon: "Icon", order: "Order", visible: "Visible",
};

export function slug(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

export function toCategory(row: any): Category {
  const p = row.properties;
  const label = prop(p, "Label") ?? "";
  return {
    id: prop(p, "ID") ?? slug(label),
    label,
    shortLabel: prop(p, "Short Label"),
    icon: prop(p, "Icon") ?? "more",
    order: prop(p, "Order") ?? 99,
    visible: prop(p, "Visible") ?? true,
  };
}

export function toItem(row: any): Item & { _logoFile?: string } {
  const p = row.properties;
  const title = prop(p, "Title") ?? "";
  const start = prop(p, "Start");
  const endDate = prop(p, "End");
  const current = prop(p, "Current") === true;
  const links = lines(prop(p, "Links")).map((l) => {
    const i = l.indexOf("=");
    return i > 0 ? { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() } : { label: "Link", url: l };
  });
  const meterValue = prop(p, "Meter Value");
  const files = prop(p, "Logo") as { url: string }[] | string | undefined;
  return {
    id: prop(p, "ID") ?? slug(`${prop(p, "Organization") ?? ""} ${title}`),
    categoryId: prop(p, "Category") ?? "",
    title,
    org: prop(p, "Organization"),
    shortLabel: prop(p, "Short Label"),
    icon: prop(p, "Icon"),
    location: prop(p, "Location"),
    start: month(start?.start),
    // A date range in "Start" also works: its end is used when "End" is empty.
    end: current ? "present" : month(endDate?.start ?? start?.end),
    summary: prop(p, "Summary"),
    bullets: lines(prop(p, "Bullets")),
    tags: prop(p, "Tags") ?? [],
    links,
    logoDomain: prop(p, "Logo Domain")?.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    meter: typeof meterValue === "number" ? { label: prop(p, "Meter Label") ?? "", value: meterValue } : undefined,
    order: prop(p, "Order") ?? 99,
    visible: prop(p, "Visible") ?? true,
    _logoFile: Array.isArray(files) ? files[0]?.url : files,
  };
}

export function toProfile(rows: any[]): Profile {
  const kv: Record<string, string> = {};
  for (const r of rows) {
    const k = prop(r.properties, "Key");
    const v = prop(r.properties, "Value");
    if (k) kv[k.trim()] = v ?? "";
  }
  const out: Record<string, string | undefined> = {};
  for (const k of ["name", "title", "tagline", "about", "location", "email", "phone", "linkedin", "github", "resumePdf"]) {
    out[k] = kv[k] || undefined;
  }
  return { ...out, name: out.name ?? "", title: out.title ?? "", tagline: out.tagline ?? "" } as Profile;
}
