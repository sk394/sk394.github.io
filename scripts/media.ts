// Downloads the files used by blog posts into public/media/blog (Notion's file URLs expire, so
// nothing is hotlinked). Every run regenerates the folder; prune() drops what is no longer used.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Media } from "./notion-blocks.ts";

const DIR = path.resolve("public/media/blog");
const MAX_BYTES = 25 * 1024 * 1024;
const written = new Set<string>();

function save(name: string, data: Buffer | string): string {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, name), data);
  written.add(name);
  return `{{BASE}}/media/blog/${name}`;
}

async function download(url: string): Promise<{ buf: Buffer; type: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("larger than 25 MB");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("larger than 25 MB");
  return { buf, type: res.headers.get("content-type") ?? "" };
}

const extension = (url: string) => path.extname(decodeURIComponent(new URL(url).pathname)).toLowerCase().replace(/[^.a-z0-9]/g, "");

export async function saveImage(url: string, name: string): Promise<Media> {
  const { buf, type } = await download(url);
  if (type.includes("svg") || extension(url) === ".svg") {
    const { width = 800, height = 450 } = await sharp(buf).metadata();
    return { src: save(`${name}.svg`, buf), width, height };
  }
  const { data, info } = await sharp(buf, { animated: true })
    .rotate() // apply the EXIF orientation
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { src: save(`${name}.webp`, data), width: info.width, height: info.pageHeight ?? info.height };
}

/** Post cover: a wide image for the page plus a JPEG for link previews. */
export async function saveCover(url: string, name: string): Promise<{ cover: Media; og: string }> {
  const { buf } = await download(url);
  const { data, info } = await sharp(buf).rotate().resize(1600, 720, { fit: "cover" }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const og = await sharp(buf).rotate().resize(1200, 630, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
  return { cover: { src: save(`${name}.webp`, data), width: info.width, height: info.height }, og: save(`${name}-og.jpg`, og) };
}

export async function saveFile(url: string, name: string): Promise<string> {
  const { buf } = await download(url);
  return save(`${name}${extension(url)}`, buf);
}

// Runs inside the sandboxed frame: reports the content height and opens outside links in a new tab.
const FRAME_SCRIPT = `<script>(function(){var e=document.documentElement;function p(){parent.postMessage({folioHeight:Math.ceil(Math.max(e.getBoundingClientRect().height,document.body?document.body.scrollHeight:0))},"*")}addEventListener("load",p);if(window.ResizeObserver)new ResizeObserver(p).observe(e);p();document.addEventListener("click",function(v){var a=v.target.closest&&v.target.closest('a[href^="http"]');if(a&&!a.target){a.target="_blank";a.rel="noopener"}},true)})()</script>`;

/** Notion /html block. Undefined when the file is something other than HTML. */
export async function saveHtml(url: string, name: string): Promise<string | undefined> {
  const { buf, type } = await download(url);
  if (!type.includes("html") && !/^\.html?$/.test(extension(url))) return undefined;
  const body = buf.toString("utf8").replace(/^﻿/, "");
  const head = /^\s*<!doctype/i.test(body) ? "" : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  return save(`${name}.html`, head + body + FRAME_SCRIPT);
}

/** Removes files left over from earlier runs. */
export function prune() {
  if (!fs.existsSync(DIR)) return;
  for (const f of fs.readdirSync(DIR)) if (!written.has(f)) fs.rmSync(path.join(DIR, f));
}
