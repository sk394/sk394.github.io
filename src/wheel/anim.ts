// GSAP timelines: open/close, drill-down hero transition, back. Every transition is
// interruptible: starting a new one kills the running timeline, discards rings that
// were already leaving, and tweens the rest from wherever they currently are.
import { gsap } from "gsap";
import type { Ring } from "./render.ts";

export const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const EASE = "power3.inOut";

let current: gsap.core.Timeline | null = null;
const leaving = new Set<HTMLElement>();

/** Circular distance between wedge indices, for "outward from the selection" staggers. */
const cdist = (i: number, from: number, n: number) => Math.min(Math.abs(i - from), n - Math.abs(i - from));

function nearestIndex(ring: Ring, angle: number): number {
  let best = 0;
  let bd = Infinity;
  ring.wedges.forEach((w, i) => {
    const d = Math.abs(((w.mid - angle + 540) % 360) - 180);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export function placeLabels(ring: Ring) {
  ring.labels.forEach((l, i) => gsap.set(l, { x: ring.wedges[i].cx, y: ring.wedges[i].cy, xPercent: -50, yPercent: -50 }));
}

function typeIn(tl: gsap.core.Timeline, ring: Ring, at: number) {
  ring.labels.forEach((l, i) => {
    const t = l.querySelector(".wl-t") as HTMLElement | null;
    if (!t) return;
    const full = (t.dataset.full = t.textContent ?? "");
    const p = { n: 0 };
    t.textContent = "";
    tl.to(p, {
      n: full.length, ease: "none", duration: Math.min(0.28, 0.02 * full.length + 0.08),
      onUpdate: () => { t.textContent = full.slice(0, Math.round(p.n)); },
    }, at + i * 0.015);
  });
}

/** Restore any half-typed labels (used when a timeline is interrupted). */
function untype(ring: Ring | null) {
  ring?.labels.forEach((l) => {
    const t = l.querySelector(".wl-t") as HTMLElement | null;
    if (t?.dataset.full !== undefined) t.textContent = t.dataset.full;
  });
}

function finishLeaving() {
  for (const el of leaving) { gsap.killTweensOf(el); el.remove(); }
  leaving.clear();
}

let entering: Ring | null = null;

/**
 * Swap `from` (null on first render) for `to`.
 * dir: 1 = drill down, -1 = back, 0 = same level (paging / reroute).
 * selIndex: wedge in `from` that was chosen; used for the flash and stagger origin.
 */
export function transition(from: Ring | null, to: Ring, dir: 1 | -1 | 0, selIndex: number, onHub: () => void) {
  current?.kill();
  untype(entering);
  finishLeaving();
  placeLabels(to);
  entering = to;
  if (!from) { onHub(); current = null; return; }

  leaving.add(from.el);
  from.el.setAttribute("aria-hidden", "true");
  from.el.removeAttribute("role");
  from.el.classList.add("leaving");

  const tl = gsap.timeline({
    defaults: { ease: EASE },
    onComplete: () => { finishLeaving(); gsap.set(to.el, { clearProps: "willChange" }); current = null; entering = null; },
  });
  current = tl;

  if (reduced.matches) {
    tl.to(from.el, { opacity: 0, duration: 0.12, ease: "none" }, 0)
      .fromTo(to.el, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, 0)
      .call(onHub, [], 0.06);
    return;
  }

  const n0 = from.groups.length;
  const n1 = to.groups.length;
  const sel = Math.max(0, Math.min(selIndex, n0 - 1));
  const origin = nearestIndex(to, from.wedges[sel]?.mid ?? -90);
  const rot = dir === 0 ? 12 : 30 * dir;
  const c0 = from.el.offsetWidth / 2;
  const c1 = to.el.offsetWidth / 2;
  gsap.set([from.el, to.el], { willChange: "transform, opacity" });
  gsap.set(from.groups, { svgOrigin: `${c0} ${c0}` });
  gsap.set(to.groups, { svgOrigin: `${c1} ${c1}` });

  // 1. flash the chosen wedge (60 ms)
  if (dir === 1 && from.groups[sel]) tl.call(() => from.groups[sel].classList.add("flash"), [], 0);
  // 2. collapse outgoing wedges toward the center, staggered outward from the selection
  const stag0 = (i: number) => 0.02 * cdist(i, sel, n0);
  tl.to(from.groups, { scale: 0.6, opacity: 0, duration: 0.26, stagger: stag0 }, 0.06);
  from.labels.forEach((l, i) => {
    tl.to(l, { x: from.wedges[i].cx * 0.6, y: from.wedges[i].cy * 0.6, scale: 0.6, opacity: 0, rotation: -rot, duration: 0.26 }, 0.06 + stag0(i));
  });
  tl.to(from.glass, { opacity: 0, duration: 0.24 }, 0.06);
  // 3. ring rotates 30° and dips to 0.92
  tl.to(from.el, { rotation: rot, scale: 0.92, duration: 0.3 }, 0.06);

  // 4. new ring expands from the center, outward from the previous selection's angle
  const stag1 = (i: number) => 0.02 * cdist(i, origin, n1);
  tl.fromTo(to.el, { rotation: -rot, scale: 0.92 }, { rotation: 0, scale: 1, duration: 0.32 }, 0.22);
  tl.fromTo(to.glass, { opacity: 0 }, { opacity: 1, duration: 0.28 }, 0.22);
  tl.fromTo(to.groups, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "power3.out", stagger: stag1 }, 0.24);
  to.labels.forEach((l, i) => {
    const w = to.wedges[i];
    tl.fromTo(l, { x: w.cx * 0.6, y: w.cy * 0.6, scale: 0.6, opacity: 0, rotation: rot },
      { x: w.cx, y: w.cy, scale: 1, opacity: 1, rotation: 0, duration: 0.3, ease: "power3.out" }, 0.24 + stag1(i));
  });
  typeIn(tl, to, 0.3);
  // 5. hub crossfades to the new level
  tl.call(onHub, [], 0.22);
}

export function hubSwap(hubInner: HTMLElement, update: () => void) {
  if (reduced.matches) { update(); return; }
  gsap.killTweensOf(hubInner);
  gsap.timeline()
    .to(hubInner, { opacity: 0, y: -4, duration: 0.09, ease: "power2.in" })
    .call(update)
    .to(hubInner, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" });
}

export function openWheel(wheel: HTMLElement, bgBlur: HTMLElement, shade: HTMLElement, landing: HTMLElement, instant = false) {
  gsap.killTweensOf([wheel, bgBlur, shade, landing]);
  const d = instant ? 0 : reduced.matches ? 0.12 : 0.45;
  gsap.to(bgBlur, { opacity: 1, duration: d, ease: "power2.out" });
  gsap.to(shade, { opacity: 1, duration: d, ease: "power2.out" });
  gsap.to(landing, { opacity: 0, y: reduced.matches ? 0 : -16, duration: d * 0.7, ease: "power2.in", onComplete: () => { landing.style.visibility = "hidden"; } });
  wheel.style.visibility = "visible";
  if (reduced.matches || instant) gsap.fromTo(wheel, { opacity: 0 }, { opacity: 1, scale: 1, rotation: 0, duration: d });
  else gsap.fromTo(wheel, { opacity: 0, scale: 0.8, rotation: -20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.4)" });
}

export function closeWheel(wheel: HTMLElement, bgBlur: HTMLElement, shade: HTMLElement, landing: HTMLElement) {
  gsap.killTweensOf([wheel, bgBlur, shade, landing]);
  const d = reduced.matches ? 0.12 : 0.35;
  gsap.to(bgBlur, { opacity: 0, duration: d });
  gsap.to(shade, { opacity: 0, duration: d });
  landing.style.visibility = "visible";
  gsap.to(landing, { opacity: 1, y: 0, duration: d, delay: d * 0.4 });
  gsap.to(wheel, {
    opacity: 0, scale: reduced.matches ? 1 : 0.85, rotation: reduced.matches ? 0 : 12, duration: d, ease: "power2.in",
    onComplete: () => { wheel.style.visibility = "hidden"; },
  });
}

/** Desktop: wheel slides left + shrinks while the side panel is open. */
export function shiftWheel(stage: HTMLElement, open: boolean, dx: number) {
  gsap.to(stage, {
    x: open ? dx : 0, scale: open ? 0.82 : 1,
    duration: reduced.matches ? 0 : 0.5, ease: EASE,
  });
}

export { gsap };
