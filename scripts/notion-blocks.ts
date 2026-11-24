// Notion page body → static HTML, at build time (code is highlighted and math is MathML, so the
// page ships no library). Root-relative URLs are written as {{BASE}}/… and resolved by the page.
import katex from "katex";
import { bundledLanguages, codeToHtml } from "shiki";
import { api } from "./notion.ts";

export type Block = { id: string; type: string; has_children?: boolean; children?: Block[]; [key: string]: any };

export type Media = { src: string; width: number; height: number };

/** Where the renderer gets its files and links from (the fetch script downloads; tests can stub). */
export type Context = {
  image(url: string, name: string): Promise<Media | undefined>;
  file(url: string, name: string): Promise<string | undefined>;
  html(url: string, name: string): Promise<string | undefined>;
  /** URL of the post written on this Notion page, if it is published. */
  post(pageId: string): string | undefined;
  warn(message: string): void;
};

export const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join("");
const compact = (id: string) => id.replace(/-/g, "");

export async function fetchBlocks(token: string, id: string, warn: (m: string) => void): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  do {
    const r = await api(token, `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);

  for (const b of out) {
    if (b.type === "child_page" || b.type === "child_database") continue;
    const source: string | undefined = b.synced_block?.synced_from?.block_id; // a copy: children live on the original
    if (!b.has_children && !source) continue;
    try {
      b.children = await fetchBlocks(token, source ?? b.id, warn);
    } catch (e) {
      if (!source || !/→ 40[34]/.test((e as Error).message)) throw e;
      warn("a synced block's original is not shared with the integration; skipped");
    }
  }
  return out;
}

// ---- inline text -----------------------------------------------------------------

function math(expression: string, displayMode: boolean): string {
  return katex.renderToString(expression, { displayMode, output: "mathml", throwOnError: false });
}

/** A safe href, or undefined. Links to private Notion pages are dropped unless the page is a post. */
function href(url: string | undefined | null, ctx: Context): string | undefined {
  if (!url) return undefined;
  const internal = /^\/(?!\/)/.test(url) || /^https:\/\/(www\.notion\.so|app\.notion\.com)\//.test(url);
  const id = internal ? /([0-9a-f]{8}-?(?:[0-9a-f]{4}-?){3}[0-9a-f]{12})(?=$|[?#])/i.exec(url)?.[1] : undefined;
  if (id || url.startsWith("/")) return id ? ctx.post(compact(id)) : undefined;
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : undefined;
}

const anchor = (h: string) => `href="${esc(h)}"${/^https?:/.test(h) ? ' rel="noopener"' : ""}`;
const tint = (color?: string) => (color && color !== "default" ? ` class="n-${color.replace(/_background$/, "-bg")}"` : "");

function rich(rt: any[] | undefined, ctx: Context): string {
  return (rt ?? []).map((t) => {
    if (t.type === "equation") return math(t.equation.expression, false);
    const a = t.annotations ?? {};
    let s = esc(t.plain_text).replace(/\n/g, "<br>");
    if (a.code) s = `<code>${s}</code>`;
    if (a.bold) s = `<strong>${s}</strong>`;
    if (a.italic) s = `<em>${s}</em>`;
    if (a.strikethrough) s = `<s>${s}</s>`;
    if (a.underline) s = `<u>${s}</u>`;
    if (tint(a.color)) s = `<span${tint(a.color)}>${s}</span>`;
    const m = t.mention;
    const url = m?.type === "page" ? ctx.post(compact(m.page.id)) : href(m?.link_preview?.url ?? t.href, ctx);
    return url ? `<a ${anchor(url)}>${s}</a>` : s;
  }).join("");
}

// ---- code ------------------------------------------------------------------------

const LANGS: Record<string, string> = { "visual basic": "vb", "vb.net": "vb", markup: "html", protobuf: "proto", webassembly: "wasm", "f#": "fsharp", shell: "shellscript" };

async function code(b: Block, ctx: Context): Promise<string> {
  const name: string = b.code.language ?? "plain text";
  const lang = LANGS[name] ?? name;
  const html = await codeToHtml(plain(b.code.rich_text), { lang: lang in bundledLanguages ? lang : "text", theme: "github-dark-default" });
  const label = name === "plain text" ? "" : `<span class="code-lang">${esc(name)}</span>`;
  return figure(`<div class="code">${label}${html}</div>`, b.code.caption, ctx);
}

// ---- media -----------------------------------------------------------------------

function figure(inner: string, caption: any[] | undefined, ctx: Context, cls = ""): string {
  const c = rich(caption, ctx);
  return `<figure${cls ? ` class="${cls}"` : ""}>${inner}${c ? `<figcaption>${c}</figcaption>` : ""}</figure>`;
}

const source = (o: any): string | undefined => o?.file?.url ?? o?.external?.url;
const isNotionFile = (url: string) => /[?&]X-Amz-/i.test(url) || /^https:\/\/([\w-]+\.)*(notion\.so|notion\.com|notionusercontent\.com|notion-static\.com)\//i.test(url);

/** Player URL for the providers that allow embedding. */
function player(url: string): string | undefined {
  const u = new URL(url);
  const host = u.hostname.replace(/^(www|m)\./, "");
  const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
  if (host === "youtube.com" || host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.searchParams.get("v") ?? last)}`;
  if (host === "vimeo.com") return `https://player.vimeo.com/video/${encodeURIComponent(last)}`;
  if (host === "loom.com") return `https://www.loom.com/embed/${encodeURIComponent(last)}`;
  if (host === "codepen.io") return url.replace("/pen/", "/embed/");
  if (host === "figma.com") return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
  if (/^(player\.vimeo\.com|codesandbox\.io|stackblitz\.com)$/.test(host)) return url;
  return undefined;
}

function card(url: string, caption: any[] | undefined, ctx: Context, label?: string): string {
  const h = href(url, ctx) ?? (url.startsWith("{{BASE}}") ? url : undefined);
  if (!h) return "";
  const host = /^https?:/.test(h) ? new URL(h).hostname.replace(/^www\./, "") : "";
  const text = plain(caption) || label || h.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return `<a class="card" ${anchor(h)}><span class="card-t">${esc(text)}</span>${host && host !== text ? `<span class="card-h">${esc(host)}</span>` : ""}</a>`;
}

const frame = (src: string, title: string) =>
  `<div class="frame"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="fullscreen; picture-in-picture"></iframe></div>`;

async function media(b: Block, ctx: Context): Promise<string> {
  const data = b[b.type];
  const url = source(data);
  if (!url) return "";
  const name = compact(b.id);

  if (b.type === "image") {
    const img = await ctx.image(url, name);
    if (!img) return "";
    return figure(`<img src="${esc(img.src)}" alt="${esc(plain(data.caption))}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async">`, data.caption, ctx);
  }
  if (!data.file) {
    const embed = b.type === "video" ? player(url) : undefined;
    return embed ? figure(frame(embed, plain(data.caption) || "Video"), data.caption, ctx) : card(url, data.caption, ctx, data.name);
  }
  const local = await ctx.file(url, name);
  if (!local) return "";
  if (b.type === "video") return figure(`<video src="${esc(local)}" controls preload="metadata" playsinline></video>`, data.caption, ctx);
  if (b.type === "audio") return figure(`<audio src="${esc(local)}" controls preload="metadata"></audio>`, data.caption, ctx);
  return card(local, data.caption, ctx, data.name ?? "Download file");
}

async function embed(b: Block, ctx: Context): Promise<string> {
  const { url, caption } = b.embed;
  if (!url) return "";
  // Notion's /html block: a signed, temporary URL to an uploaded .html file. It runs sandboxed,
  // like it does in Notion, and reports its height to the page.
  if (isNotionFile(url)) {
    const local = await ctx.html(url, compact(b.id));
    if (!local) return "";
    return figure(`<iframe class="html-block" src="${esc(local)}" title="${esc(plain(caption) || "Embedded content")}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" loading="lazy"></iframe>`, caption, ctx, "wide");
  }
  const src = player(url);
  return src ? figure(frame(src, plain(caption) || "Embedded content"), caption, ctx) : card(url, caption, ctx);
}

// ---- blocks ----------------------------------------------------------------------

const LIST: Record<string, string> = { bulleted_list_item: "ul", numbered_list_item: "ol", to_do: "ul" };
const FORMAT: Record<string, string> = { letters: "a", roman: "i" };

type State = { ctx: Context; headings: { id: string; level: number; text: string }[] };

async function renderList(items: Block[], st: State): Promise<string> {
  const type = items[0].type;
  const first = items[0][type];
  let attrs = type === "to_do" ? ' class="todo"' : "";
  if (first.list_start_index > 1) attrs += ` start="${Number(first.list_start_index)}"`;
  if (FORMAT[first.list_format]) attrs += ` type="${FORMAT[first.list_format]}"`;
  let out = "";
  for (const b of items) {
    const d = b[type];
    const box = type === "to_do" ? `<input type="checkbox" disabled${d.checked ? " checked" : ""} aria-label="${d.checked ? "Done" : "To do"}"> ` : "";
    out += `<li${tint(d.color)}>${box}${rich(d.rich_text, st.ctx)}${await renderAll(b.children, st)}</li>`;
  }
  return `<${LIST[type]}${attrs}>${out}</${LIST[type]}>`;
}

function heading(b: Block, st: State): string {
  const d = b[b.type];
  const level = Number(b.type.slice(-1)) + 1; // the post title is the h1
  const text = plain(d.rich_text).trim();
  if (!text) return "";
  const stem = text.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60) || "section";
  let id = stem;
  for (let n = 2; st.headings.some((h) => h.id === id); n++) id = `${stem}-${n}`;
  st.headings.push({ id, level, text });
  return `<h${level} id="${id}"${tint(d.color)}>${rich(d.rich_text, st.ctx)}</h${level}>`;
}

function table(b: Block, ctx: Context): string {
  const { has_column_header: col, has_row_header: row } = b.table;
  const trs = (b.children ?? []).map((r, i) => {
    const cells = r.table_row.cells.map((c: any[], j: number) => {
      const th = (col && i === 0) || (row && j === 0);
      return th ? `<th scope="${col && i === 0 ? "col" : "row"}">${rich(c, ctx)}</th>` : `<td>${rich(c, ctx)}</td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<div class="table" tabindex="0" role="group" aria-label="Table"><table>${trs.join("")}</table></div>`;
}

async function renderBlock(b: Block, st: State): Promise<string> {
  const { ctx } = st;
  const d = b[b.type] ?? {};
  const kids = () => renderAll(b.children, st);
  switch (b.type) {
    case "paragraph": {
      const text = rich(d.rich_text, ctx);
      const inner = await kids();
      return (text ? `<p${tint(d.color)}>${text}</p>` : "") + (inner && `<div class="indent">${inner}</div>`);
    }
    case "heading_1": case "heading_2": case "heading_3": case "heading_4": {
      const h = heading(b, st);
      return d.is_toggleable && b.children ? `<details><summary>${h}</summary>${await kids()}</details>` : h + (await kids());
    }
    case "toggle": return `<details><summary>${rich(d.rich_text, ctx)}</summary>${await kids()}</details>`;
    case "quote": return `<blockquote${tint(d.color)}><p>${rich(d.rich_text, ctx)}</p>${await kids()}</blockquote>`;
    case "callout": {
      const emoji = d.icon?.type === "emoji" ? `<span class="callout-i" aria-hidden="true">${esc(d.icon.emoji)}</span>` : "";
      const text = rich(d.rich_text, ctx);
      const cls = d.color && d.color !== "default" ? ` n-${d.color.replace(/_background$/, "-bg")}` : "";
      return `<aside class="callout${cls}">${emoji}<div>${text ? `<p>${text}</p>` : ""}${await kids()}</div></aside>`;
    }
    case "code": return code(b, ctx);
    case "equation": return `<div class="math">${math(d.expression, true)}</div>`;
    case "divider": return "<hr>";
    case "image": case "video": case "audio": case "file": case "pdf": return media(b, ctx);
    case "embed": return embed(b, ctx);
    case "bookmark": case "link_preview": return d.url ? card(d.url, d.caption, ctx) : "";
    case "table": return table(b, ctx);
    case "column_list": {
      const cols = b.children ?? [];
      const grid = cols.map((c) => `${Number(c.column?.width_ratio) || 1 / cols.length}fr`).join(" ");
      const inner = await Promise.all(cols.map(async (c) => `<div>${await renderAll(c.children, st)}</div>`));
      return `<div class="cols" style="--cols:${grid}">${inner.join("")}</div>`;
    }
    case "tab": {
      let out = "";
      for (const t of b.children ?? []) out += `<section><p class="tab-t">${rich(t.paragraph?.rich_text, ctx)}</p>${await renderAll(t.children, st)}</section>`;
      return out;
    }
    case "synced_block": case "column": return kids();
    case "table_of_contents": return "<!--toc-->";
    case "breadcrumb": case "template": return "";
    default:
      ctx.warn(`"${b.type === "unsupported" ? (d.block_type ?? b.type) : b.type}" blocks are not supported; skipped`);
      return "";
  }
}

async function renderAll(blocks: Block[] | undefined, st: State): Promise<string> {
  let out = "";
  const list = blocks ?? [];
  for (let i = 0; i < list.length; ) {
    if (LIST[list[i].type]) {
      let j = i + 1;
      while (j < list.length && list[j].type === list[i].type) j++;
      out += await renderList(list.slice(i, j), st);
      i = j;
    } else {
      out += await renderBlock(list[i++], st);
    }
  }
  return out;
}

export async function renderBlocks(blocks: Block[], ctx: Context): Promise<string> {
  const st: State = { ctx, headings: [] };
  const html = await renderAll(blocks, st);
  const toc = st.headings.length
    ? `<nav class="toc" aria-label="Contents"><ul>${st.headings.map((h) => `<li class="l${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ul></nav>`
    : "";
  return html.replaceAll("<!--toc-->", () => toc);
}

/** Reading time from rendered HTML, at 220 words per minute. */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
