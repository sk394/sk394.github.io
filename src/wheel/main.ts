// Client island entry: wires routing, rendering, animation, panel and input together.
import { Router, toHash, type View } from "./state.ts";
import { createRing, setActive, setSelected, setHub, hubRefs, asset, type Ring } from "./render.ts";
import { transition, hubSwap, openWheel, closeWheel, gsap, reduced, placeLabels } from "./anim.ts";
import { Panel } from "./panel.ts";
import { initInput, type Source } from "./input.ts";
import { setSound, soundOn, tick, whoosh } from "./sound.ts";
import type { WheelNode } from "./types.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const root: WheelNode = JSON.parse($("#wheel-data").textContent!);
const siteName = root.label;
const baseTitle = document.title;

const el = {
  html: document.documentElement,
  stage: $(".stage"),
  wheel: $(".wheel"),
  rings: $(".rings"),
  needle: $(".needle"),
  hubInner: $(".hub-inner"),
  bgBlur: $(".bg-blur"),
  shade: $(".bg-shade"),
  landing: $(".landing"),
  live: $("#announce"),
  plainBtn: $<HTMLButtonElement>("#plain-toggle"),
  soundBtn: $<HTMLButtonElement>("#sound-toggle"),
  openBtn: $<HTMLButtonElement>("#open-wheel"),
};
const hub = hubRefs($<HTMLButtonElement>(".hub"));

const router = new Router(root);
let view: View = router.view;
let ring: Ring | null = null;
let active = -1;
let isOpen = false;
let R = 0;

const measure = () => el.wheel.offsetWidth / 2;
const plain = () => el.html.dataset.view === "plain";
const fine = matchMedia("(hover: hover) and (pointer: fine)");

// ---- rendering ---------------------------------------------------------------

function levelLabel(v: View) {
  return v.depth === 0 ? `${siteName}: main menu` : v.ring.label;
}

function updateHub() {
  setHub(hub, view.wedges[active], active, view.wedges.length, view.ring, view.depth);
}

function buildRing(v: View): Ring {
  const r = createRing(v.wedges, R, levelLabel(v), v.depth);
  el.rings.append(r.el);
  return r;
}

function render(v: View, prev: View | null) {
  const ringChanged = !prev || prev.ring !== v.ring || prev.route.page !== v.route.page;
  if (ringChanged) {
    let dir: 1 | -1 | 0 = 0;
    let sel = active;
    if (prev && prev.ring !== v.ring) {
      dir = v.depth > prev.depth ? 1 : -1;
      if (dir === 1) sel = Math.max(0, prev.wedges.findIndex((w) => w.id === v.ring.id));
    }
    const old = ring;
    ring = buildRing(v);
    active = v.selectedIndex >= 0 ? v.selectedIndex
      : dir === -1 && prev ? Math.max(0, v.wedges.indexOf(prev.ring)) : 0;
    setActive(ring, active);
    if (old && isOpen) {
      whoosh(dir !== -1);
      transition(old, ring, dir, sel, () => hubSwap(el.hubInner, updateHub));
    } else {
      old?.el.remove();
      transition(null, ring, 0, 0, updateHub);
    }
  } else if (v.selectedIndex >= 0 && v.selectedIndex !== active && ring) {
    active = v.selectedIndex;
    setActive(ring, active);
    updateHub();
  }
  if (ring) setSelected(ring, v.selectedIndex);

  if (v.selected?.detail) {
    const idx = v.selectedIndex;
    panel.open(v.selected.detail, () => ring?.labels[idx] ?? null, !fine.matches || lastSource === "key" || lastSource === "pad");
  } else {
    panel.close();
  }
  document.title = v.selected ? `${v.selected.label} · ${siteName}` : v.depth ? `${v.ring.label} · ${siteName}` : baseTitle;
}

let lastSource: Source = "pointer";
let preloadTimer = 0;

function hover(i: number, src: Source) {
  if (!ring || i < 0 || i >= view.wedges.length) return;
  lastSource = src;
  if (i !== active) {
    active = i;
    setActive(ring, i);
    updateHub();
    tick();
    if (src === "touch" || src === "pad") navigator.vibrate?.(8);
    el.live.textContent = view.wedges[i].label;
  }
  if (src === "key" || src === "pad") ring.labels[i]?.focus({ preventScroll: true });
  // Preload what the visitor is lingering on: a category's logos, or the post itself.
  clearTimeout(preloadTimer);
  const node = view.wedges[i];
  if (node.kind === "post") preloadTimer = window.setTimeout(() => prefetch(asset(node.href!)), 150);
  if (node.children) preloadTimer = window.setTimeout(() => node.children!.forEach((c) => { if (c.logo) new Image().src = asset(c.logo); }), 150);
}

const prefetched = new Set<string>();
function prefetch(href: string) {
  if (prefetched.has(href)) return;
  prefetched.add(href);
  document.head.append(Object.assign(document.createElement("link"), { rel: "prefetch", href }));
}

function confirm(i: number, src: Source) {
  lastSource = src;
  const node = view.wedges[i];
  if (!node) return;
  const base = view.selected ? view.route.path.slice(0, -1) : view.route.path;
  switch (node.kind) {
    case "group":
      router.go({ path: [...base, node.id], page: 0 });
      break;
    case "item":
    case "about":
      if (view.selected === node) return;
      router.go({ path: [...base, node.id], page: view.route.page }, !!view.selected);
      break;
    case "post":
      location.href = asset(node.href!);
      break;
    case "more":
      page(1);
      break;
    case "action":
      if (!node.href) return;
      if (/^(mailto|tel):/.test(node.href)) location.href = node.href;
      else window.open(node.href, "_blank", "noopener");
      break;
  }
}

function page(dir: 1 | -1) {
  if (view.pages <= 1) return;
  const base = view.selected ? view.route.path.slice(0, -1) : view.route.path;
  router.go({ path: base, page: view.route.page + dir }, true);
}

function back() {
  if (!router.back()) closeIt();
}

// ---- open / close ------------------------------------------------------------

function openIt(instant = false) {
  if (isOpen) return;
  isOpen = true;
  el.html.classList.add("wheel-open");
  store.set("folio:visited", "1");
  openWheel(el.wheel, el.bgBlur, el.shade, el.landing, instant);
  if (!instant && ring && !reduced.matches) {
    placeLabels(ring);
    gsap.fromTo(ring.labels, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.03, delay: 0.15 });
  }
  if (!fine.matches || lastSource === "key") requestAnimationFrame(() => ring?.labels[Math.max(0, active)]?.focus({ preventScroll: true }));
}

function closeIt() {
  if (!isOpen) return;
  isOpen = false;
  el.html.classList.remove("wheel-open");
  panel.close(false);
  closeWheel(el.wheel, el.bgBlur, el.shade, el.landing);
  if (location.hash && location.hash !== "#/") router.go({ path: [], page: 0 }, true);
  el.openBtn.focus({ preventScroll: true });
}

// ---- panel + layout ------------------------------------------------------------

const panel = new Panel($(".panel"), () => router.back(), (open, side) => {
  el.html.classList.toggle("panel-open", open);
  const vw = innerWidth, vh = innerHeight;
  let x = 0, y = 0, scale = 1;
  if (open && side) {
    const pw = ($(".panel").offsetWidth || Math.min(480, vw * 0.4));
    x = -pw / 2;
    scale = Math.min(0.82, ((vw - pw) * 0.9) / (2 * R));
  } else if (open) {
    const top = 64;
    const free = vh * (vw < 480 ? 0.3 : 0.4) - top;
    scale = Math.min(1, (free * 0.92) / (2 * R));
    y = top + free / 2 - vh / 2;
  }
  gsap.to(el.stage, { x, y, scale, duration: reduced.matches ? 0 : 0.5, ease: "power3.inOut" });
});

// ---- needle --------------------------------------------------------------------

const needleRot = gsap.quickTo(el.needle, "rotation", { duration: 0.22, ease: "power3.out" });
let needleAngle = -90;
function needle(angle: number | null) {
  if (reduced.matches) return;
  if (angle === null) { el.needle.classList.remove("on"); return; }
  el.needle.classList.add("on");
  const delta = ((angle - needleAngle + 540) % 360) - 180;
  needleAngle += delta;
  needleRot(needleAngle + 90);
}

// ---- toggles -------------------------------------------------------------------

function setPlain(on: boolean) {
  el.html.dataset.view = on ? "plain" : "wheel";
  el.plainBtn.setAttribute("aria-pressed", String(on));
  el.plainBtn.querySelector(".lbl")!.textContent = on ? "Wheel view" : "Plain view";
  store.set("folio:view", on ? "plain" : "wheel");
  if (on) { panel.close(false); scrollTo(0, 0); }
  else if (R === 0 || R !== measure()) relayout();
}
el.plainBtn.addEventListener("click", () => setPlain(!plain()));
document.querySelectorAll<HTMLAnchorElement>("[data-goto-plain]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); setPlain(true); $("#resume").focus(); }));

el.soundBtn.addEventListener("click", () => {
  const on = !soundOn();
  setSound(on);
  el.soundBtn.setAttribute("aria-pressed", String(on));
  el.soundBtn.setAttribute("aria-label", on ? "Mute sounds" : "Enable sounds");
  el.soundBtn.classList.toggle("on", on);
  if (on) tick();
});

el.openBtn.addEventListener("click", () => openIt());
$(".hub").addEventListener("click", () => back());

// ---- resize --------------------------------------------------------------------

function relayout() {
  const r = measure();
  if (!r || Math.abs(r - R) < 0.5) return;
  R = r;
  if (!ring) return;
  const old = ring;
  ring = buildRing(view);
  setActive(ring, active);
  setSelected(ring, view.selectedIndex);
  placeLabels(ring);
  old.el.remove();
}
let rt = 0;
new ResizeObserver(() => { clearTimeout(rt); rt = window.setTimeout(relayout, 120); }).observe(el.wheel);

// ---- boot ----------------------------------------------------------------------

router.on((v, prev) => { view = v; if (!isOpen && (v.depth || v.selected)) openIt(true); render(v, prev); });
initInput(el.wheel, {
  count: () => view.wedges.length,
  active: () => active,
  isOpen: () => isOpen,
  enabled: () => !plain(),
  hover, confirm, back, page,
  open: () => openIt(),
  needle,
});

R = measure();
render(view, null);
el.html.classList.add("wheel-ready");

const deepLink = !!(view.depth || view.selected);
if (deepLink) {
  history.replaceState(history.state, "", toHash(view.route));
  openIt(true);
} else if (!plain() && (!store.get("folio:visited") || !fine.matches)) {
  // First visit (or touch device): open automatically so no one misses the wheel.
  setTimeout(() => { if (!isOpen && !plain()) openIt(); }, 1200);
}
