// Detail panel: side panel on desktop / landscape phones, draggable bottom sheet otherwise.
import { gsap, reduced } from "./anim.ts";
import { icon } from "../icons/index.ts";
import { asset } from "./render.ts";
import type { Detail } from "./types.ts";

const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const sideMQ = matchMedia("(min-width: 1024px), (orientation: landscape) and (max-height: 540px)");
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class Panel {
  isOpen = false;
  private body: HTMLElement;
  private returnFocus: (() => HTMLElement | null) | null = null;

  constructor(private el: HTMLElement, private onDismiss: () => void, private onLayout: (open: boolean, side: boolean) => void) {
    this.body = el.querySelector(".panel-body") as HTMLElement;
    el.querySelector(".panel-close")!.addEventListener("click", () => this.onDismiss());
    el.addEventListener("keydown", (e) => this.trap(e));
    this.initDrag();
    sideMQ.addEventListener("change", () => {
      if (!this.isOpen) return;
      gsap.set(this.el, { x: 0, y: 0, xPercent: 0, yPercent: 0 });
      this.mode();
      this.onLayout(true, this.side);
    });
  }

  get side() {
    return sideMQ.matches;
  }

  private mode() {
    this.el.classList.toggle("side", this.side);
    this.el.classList.toggle("sheet", !this.side);
    this.el.setAttribute("aria-modal", String(!this.side));
  }

  open(d: Detail, returnFocus: () => HTMLElement | null, focus: boolean) {
    this.returnFocus = returnFocus;
    this.body.innerHTML = render(d);
    this.body.scrollTop = 0;
    const was = this.isOpen;
    this.isOpen = true;
    this.mode();
    this.el.hidden = false;
    this.el.setAttribute("aria-labelledby", "panel-title");
    this.onLayout(true, this.side);
    gsap.killTweensOf(this.el);
    const dur = reduced.matches ? 0.12 : 0.45;
    if (was) {
      gsap.fromTo(this.body, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.to(this.el, { xPercent: 0, yPercent: 0, y: 0, x: 0, opacity: 1, duration: 0.2 });
    } else if (reduced.matches) {
      gsap.fromTo(this.el, { opacity: 0, xPercent: 0, yPercent: 0 }, { opacity: 1, duration: dur });
    } else if (this.side) {
      gsap.fromTo(this.el, { xPercent: 105, yPercent: 0, y: 0, opacity: 1 }, { xPercent: 0, duration: dur, ease: "power3.out" });
    } else {
      gsap.fromTo(this.el, { yPercent: 105, xPercent: 0, y: 0, opacity: 1 }, { yPercent: 0, duration: dur, ease: "power3.out" });
    }
    if (focus) requestAnimationFrame(() => (this.el.querySelector(".panel-close") as HTMLElement).focus({ preventScroll: true }));
  }

  close(restoreFocus = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.onLayout(false, this.side);
    gsap.killTweensOf(this.el);
    const done = () => { this.el.hidden = true; };
    if (reduced.matches) gsap.to(this.el, { opacity: 0, duration: 0.12, onComplete: done });
    else if (this.side) gsap.to(this.el, { xPercent: 105, duration: 0.35, ease: "power3.in", onComplete: done });
    else gsap.to(this.el, { yPercent: 105, y: 0, duration: 0.3, ease: "power3.in", onComplete: done });
    if (restoreFocus && this.el.contains(document.activeElement)) this.returnFocus?.()?.focus({ preventScroll: true });
  }

  private trap(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const f = [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /** Bottom sheet: drag down on the grip/header (or the body when scrolled to top) to dismiss. */
  private initDrag() {
    let startY = 0, lastY = 0, lastT = 0, vel = 0, dragging = false, id = -1;
    const h = () => this.el.offsetHeight;
    this.el.addEventListener("pointerdown", (e) => {
      if (this.side || !this.isOpen || e.button > 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("a, button")) return;
      const onHandle = !!t.closest(".panel-grip, .panel-head");
      if (!onHandle && this.body.scrollTop > 0) return;
      dragging = true; id = e.pointerId;
      startY = lastY = e.clientY; lastT = e.timeStamp; vel = 0;
      gsap.killTweensOf(this.el);
    });
    addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== id) return;
      const dy = Math.max(0, e.clientY - startY);
      if (dy > 6 && !this.el.hasPointerCapture(id)) this.el.setPointerCapture(id);
      vel = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
      lastY = e.clientY; lastT = e.timeStamp;
      gsap.set(this.el, { y: dy });
    });
    const end = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== id) return;
      dragging = false;
      const dy = Math.max(0, e.clientY - startY);
      if (dy > h() * 0.25 || vel > 0.6) this.onDismiss();
      else gsap.to(this.el, { y: 0, duration: 0.25, ease: "power3.out" });
    };
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  }
}

function render(d: Detail): string {
  const logo = d.logo
    ? `<img class="p-logo" src="${esc(asset(d.logo))}" alt="" width="56" height="56" decoding="async">`
    : `<span class="p-logo p-mono" aria-hidden="true">${esc(initials(d.org || d.title))}</span>`;
  const meta = [
    d.location ? `<span>${icon("pin")}${esc(d.location)}</span>` : "",
    d.dates ? `<span>${icon("calendar")}${esc(d.dates)}</span>` : "",
  ].join("");
  const links = d.links.map((l) => {
    const ext = /^https?:/.test(l.url);
    return `<a class="p-link" href="${esc(asset(l.url))}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}${icon(ext ? "external" : "more")}</a>`;
  }).join("");
  return `
    <header class="panel-head">${logo}<div><h2 id="panel-title" class="p-title">${esc(d.title)}</h2>${d.org && d.org !== d.title ? `<p class="p-org">${esc(d.org)}</p>` : ""}</div></header>
    ${meta ? `<p class="p-meta">${meta}</p>` : ""}
    ${d.summary ? `<p class="p-summary">${esc(d.summary)}</p>` : ""}
    ${d.bullets.length ? `<ul class="p-bullets">${d.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
    ${d.tags.length ? `<ul class="p-tags" aria-label="Skills and tools">${d.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${links ? `<div class="p-links">${links}</div>` : ""}`;
}

function initials(s: string) {
  return s.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).slice(0, 2).map((w) => w[0]).join("") || s[0];
}
