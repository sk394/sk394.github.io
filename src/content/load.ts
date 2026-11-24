// Build-time only: loads content.json (written by scripts/fetch-content.ts) or the
// seed, validates it, and derives the wheel tree that is embedded in the page as JSON.
import fs from "node:fs";
import path from "node:path";
import { validateContent, type Content, type Item, type Post } from "./schema.ts";
import { clip } from "../wheel/text.ts";
import type { WheelNode, Detail } from "../wheel/types.ts";

const dir = path.resolve("src/content");
const logosDir = path.resolve("public/logos");

export function loadContent(): Content {
  const live = path.join(dir, "content.json");
  const file = fs.existsSync(live) ? live : path.join(dir, "content.seed.json");
  return validateContent(JSON.parse(fs.readFileSync(file, "utf8")), path.basename(file));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(d?: string): string {
  if (!d) return "";
  if (d === "present") return "Present";
  const [y, m] = d.split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

export function fmtRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (!end) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function fmtDay(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

export const postUrl = (p: Post) => `/blog/${p.id}/`;

/** Posts grouped by category, in the order the fetch script sorted them. */
export function blogCategories(c: Content): { id: string; label: string; posts: Post[] }[] {
  const groups = new Map<string, { id: string; label: string; posts: Post[] }>();
  for (const p of c.posts) {
    if (!groups.has(p.categoryId)) groups.set(p.categoryId, { id: p.categoryId, label: p.category, posts: [] });
    groups.get(p.categoryId)!.posts.push(p);
  }
  return [...groups.values()];
}

function monogram(s: string): string {
  const words = s.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const caps = words.filter((w) => /^\p{Lu}/u.test(w));
  const pick = caps.length ? caps : words;
  return pick.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";
}

/** A logo explicitly set in content wins; otherwise use one fetched into public/logos. */
function findLogo(item: Item): string | undefined {
  if (item.logo) return item.logo;
  for (const ext of ["svg", "webp", "png"]) {
    if (fs.existsSync(path.join(logosDir, `${item.id}.${ext}`))) return `/logos/${item.id}.${ext}`;
  }
  return undefined;
}

function short(label: string, shortLabel?: string): string {
  if (shortLabel) return shortLabel;
  return label.length <= 14 ? label : label.slice(0, 13).trimEnd() + "…";
}

/** Blog names can be sentences: their wedges wrap instead of being cut at 14 characters. */
const WRAP = 28;

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function blogNode(cat: Content["categories"][number], c: Content): WheelNode {
  return {
    id: cat.id, kind: "group", label: cat.label, short: short(cat.label, cat.shortLabel), icon: cat.icon,
    sub: count(c.posts.length, "post"),
    children: blogCategories(c).map((g) => ({
      id: g.id, kind: "group", label: g.label, short: clip(g.label, WRAP), mono: g.label.length <= 3 ? g.label : monogram(g.label),
      sub: count(g.posts.length, "post"),
      children: g.posts.map((p) => ({
        id: p.id, kind: "post", label: p.title, short: p.shortLabel ?? clip(p.title, WRAP), icon: p.icon ?? "document",
        sub: `${fmtDay(p.date)} · ${p.minutes} min read`, href: postUrl(p),
      })),
    })),
  };
}

function itemDetail(item: Item, logo?: string): Detail {
  return {
    title: item.title,
    org: item.org,
    location: item.location,
    dates: fmtRange(item.start, item.end),
    summary: item.summary,
    bullets: item.bullets,
    tags: item.tags,
    links: item.links,
    logo,
  };
}

export function buildTree(c: Content): WheelNode {
  const p = c.profile;
  const groups: WheelNode[] = [];
  const cats = c.categories.filter((x) => x.visible).sort((a, b) => a.order - b.order);

  for (const cat of cats) {
    if (cat.id === "about") {
      groups.push({
        id: "about", kind: "about", label: cat.label, short: short(cat.label, cat.shortLabel),
        icon: cat.icon, sub: p.title,
        detail: { title: p.name, org: p.title, location: p.location, summary: p.about || p.tagline, bullets: [], tags: [], links: contactLinks(c) },
      });
      continue;
    }
    if (cat.id === "contact") {
      const links = contactLinks(c);
      if (!links.length) continue;
      groups.push({
        id: "contact", kind: "group", label: cat.label, short: short(cat.label, cat.shortLabel), icon: cat.icon,
        sub: `${links.length} ways to reach me`,
        children: links.map((l) => ({
          id: l.id, kind: "action", label: l.label, short: l.label, icon: l.icon, sub: l.display, href: l.url,
        })),
      });
      continue;
    }
    if (cat.id === "blog") {
      if (c.posts.length) groups.push(blogNode(cat, c));
      continue;
    }
    const items = c.items
      .filter((i) => i.categoryId === cat.id && i.visible)
      .sort((a, b) => a.order - b.order);
    if (!items.length) continue;
    groups.push({
      id: cat.id, kind: "group", label: cat.label, short: short(cat.label, cat.shortLabel), icon: cat.icon,
      sub: `${items.length} ${items.length === 1 ? "entry" : "entries"}`,
      children: items.map((i) => {
        const logo = findLogo(i);
        return {
          id: i.id, kind: "item", label: i.title, short: short(i.org && cat.id !== "projects" ? i.org : i.title, i.shortLabel),
          icon: i.icon, logo, mono: monogram(i.org || i.title),
          sub: itemSub(i, cat.id),
          start: i.start, end: i.end, meter: i.meter, count: i.tags.length,
          detail: itemDetail(i, logo),
        };
      }),
    });
  }
  return { id: "", kind: "group", label: p.name, short: p.name, sub: p.title, children: groups };
}

/** Hub sub-label: the role when the wedge shows the org, else a short summary. */
function itemSub(i: Item, categoryId: string): string {
  if (i.org && categoryId !== "projects") return i.title;
  if (i.summary) return i.summary.replace(/\.$/, "");
  if (i.tags.length) return i.tags.slice(0, 3).join(", ") + (i.tags.length > 3 ? "…" : "");
  return i.org ?? "";
}

type ContactLink = { id: string; label: string; url: string; icon: string; display: string };

export function contactLinks(c: Content): (ContactLink & { label: string; url: string })[] {
  const p = c.profile;
  const out: ContactLink[] = [];
  const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (p.email) out.push({ id: "email", label: "Email", url: `mailto:${p.email}`, icon: "envelope", display: p.email });
  if (p.linkedin) out.push({ id: "linkedin", label: "LinkedIn", url: p.linkedin, icon: "linkedin", display: strip(p.linkedin) });
  if (p.github) out.push({ id: "github", label: "GitHub", url: p.github, icon: "github", display: strip(p.github) });
  if (p.resumePdf) out.push({ id: "resume", label: "Résumé", url: p.resumePdf, icon: "document", display: "PDF" });
  if (p.phone) out.push({ id: "phone", label: "Phone", url: `tel:${p.phone.replace(/[^\d+]/g, "")}`, icon: "phone", display: p.phone });
  return out;
}
