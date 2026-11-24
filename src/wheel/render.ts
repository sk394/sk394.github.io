// SVG + HTML overlay DOM for rings and the center hub.
import { buildRing, type Wedge } from "./geometry.ts";
import { icon } from "../icons/index.ts";
import { clip } from "./text.ts";
import type { WheelNode } from "./types.ts";

export const INNER = 0.38;
export const DEAD = 0.18;
const SVGNS = "http://www.w3.org/2000/svg";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const asset = (p: string) => (p.startsWith("/") ? BASE + p : p);

const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type Ring = {
  el: HTMLDivElement;
  glass: HTMLDivElement;
  groups: SVGGElement[];
  labels: HTMLDivElement[];
  wedges: Wedge[];
  nodes: WheelNode[];
};

let uid = 0;

export function createRing(nodes: WheelNode[], R: number, label: string, depth: number): Ring {
  const n = nodes.length;
  const inner = R * INNER;
  const wedges = buildRing(n, inner, R, 1.5, R * (n <= 3 ? 0.7 : 0.72));
  const el = document.createElement("div");
  el.className = "ring";
  el.dataset.count = String(n);
  el.dataset.depth = String(depth);
  if (nodes.some((x) => x.kind === "post" || x.short.length > 14)) el.dataset.wrap = "";
  el.setAttribute("role", "menu");
  el.setAttribute("aria-label", label);
  el.setAttribute("aria-orientation", "horizontal");

  const glass = document.createElement("div");
  glass.className = "ring-glass";
  glass.style.clipPath = `path("${wedges.map((w) => w.d).join(" ")}")`;
  el.append(glass);

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "ring-svg");
  svg.setAttribute("viewBox", `0 0 ${2 * R} ${2 * R}`);
  svg.setAttribute("aria-hidden", "true");
  const groups = wedges.map((w, i) => {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "w");
    g.dataset.i = String(i);
    g.innerHTML =
      `<path class="w-fill" d="${w.d}"/><path class="w-edge-o" d="${w.edgeOut}"/>` +
      `<path class="w-edge-i" d="${w.edgeIn}"/><path class="w-band" d="${w.band}"/>`;
    svg.append(g);
    return g;
  });
  el.append(svg);

  const id = ++uid;
  const labels = nodes.map((node, i) => {
    const w = wedges[i];
    const d = document.createElement("div");
    d.className = "wl";
    d.id = `wl-${id}-${i}`;
    d.dataset.i = String(i);
    d.setAttribute("role", "menuitem");
    d.setAttribute("tabindex", "-1");
    d.setAttribute("aria-label", node.kind === "more" ? `More, ${node.sub}` : `${node.label}${node.sub ? ", " + node.sub : ""}`);
    if (node.children?.length) d.setAttribute("aria-haspopup", "menu");
    d.style.transform = `translate(${w.cx}px, ${w.cy}px)`;
    d.innerHTML = `<div class="wl-in">${mark(node)}<span class="wl-t">${esc(n <= 3 ? clip(node.label, 60) : node.short)}</span></div>`;
    el.append(d);
    return d;
  });

  return { el, glass, groups, labels, wedges, nodes };
}

function mark(node: WheelNode): string {
  if (node.logo) return `<img class="wl-logo" src="${esc(asset(node.logo))}" alt="" width="40" height="40" decoding="async">`;
  if (node.icon) return icon(node.icon, "ico wl-ico");
  if (node.mono) return `<span class="wl-mono">${esc(node.mono)}</span>`;
  return icon("more", "ico wl-ico");
}

export function setActive(ring: Ring, i: number) {
  ring.groups.forEach((g, j) => g.classList.toggle("on", j === i));
  ring.labels.forEach((l, j) => {
    l.classList.toggle("on", j === i);
    l.setAttribute("tabindex", j === i ? "0" : "-1");
  });
}

export function setSelected(ring: Ring, i: number) {
  ring.groups.forEach((g, j) => g.classList.toggle("sel", j === i));
  ring.labels.forEach((l, j) => l.classList.toggle("sel", j === i));
}

// ---- hub -------------------------------------------------------------------

const MONTH_MS = 2629800000;

function months(start: string, end?: string): number {
  const p = (s: string) => {
    const [y, m] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1).getTime();
  };
  const e = !end || end === "present" ? Date.now() : p(end);
  return Math.max(1, Math.round((e - p(start)) / MONTH_MS) + (end && end !== "present" ? 1 : 0));
}

function fmtDur(m: number): string {
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", r ? `${r} mo` : ""].filter(Boolean).join(" ");
}

export function meterFor(node: WheelNode | undefined, i: number, total: number): { label: string; value: number } {
  if (node?.meter) return node.meter;
  if (node?.start) {
    const m = months(node.start, node.end);
    return { label: fmtDur(m), value: Math.min(1, m / 48) };
  }
  if (node?.kind === "item" && node.icon && node.count) return { label: `${node.count} skills`, value: Math.min(1, node.count / 16) };
  if (i < 0 || total <= 0) return { label: "", value: 0 };
  return { label: `${i + 1} / ${total}`, value: (i + 1) / total };
}

export type Hub = { el: HTMLButtonElement; title: HTMLElement; sub: HTMLElement; fill: HTMLElement; mlabel: HTMLElement; back: HTMLElement };

export function hubRefs(el: HTMLButtonElement): Hub {
  const q = (s: string) => el.querySelector(s) as HTMLElement;
  return { el, title: q(".hub-title"), sub: q(".hub-sub"), fill: q(".hub-fill"), mlabel: q(".hub-mlabel"), back: q(".hub-back") };
}

export function setHub(h: Hub, node: WheelNode | undefined, i: number, total: number, fallback: WheelNode, depth: number) {
  const n = node ?? fallback;
  const small = h.el.offsetWidth < 160;
  const title = n.kind === "item" ? n.short : clip(n.label, small ? 40 : 64);
  h.title.textContent = title;
  h.title.classList.toggle("long", title.length > 11);
  h.title.classList.toggle("xlong", title.length > 26);
  h.sub.textContent = clip(n.sub ?? "", small ? 30 : 52);
  const m = meterFor(node, i, total);
  h.fill.style.transform = `scaleX(${m.value})`;
  h.mlabel.textContent = m.label;
  h.el.classList.toggle("has-meter", !!m.label);
  h.back.hidden = depth === 0;
  h.el.setAttribute("aria-label", depth ? "Back" : "Close wheel");
}
