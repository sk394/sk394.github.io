// Pointer / touch / keyboard / gamepad → angle → wedge index.
// One window-level listener per event type; geometry is read inside rAF only.
import { angleToIndex } from "./geometry.ts";
import { DEAD, INNER } from "./render.ts";

export type Source = "pointer" | "touch" | "key" | "pad";

export type InputHandlers = {
  count(): number;
  active(): number;
  isOpen(): boolean;
  enabled(): boolean;
  hover(i: number, src: Source): void;
  confirm(i: number, src: Source): void;
  back(): void;
  page(dir: 1 | -1): void;
  open(): void;
  needle(angle: number | null): void;
};

const IGNORE = "[data-noangle], .panel, .topbar, .plain";

export function initInput(wheel: HTMLElement, h: InputHandlers) {
  let px = 0, py = 0, pending = false, lastTarget: Element | null = null;
  let pointerMoved = false;
  let lastTouch = -1e9; // iOS fires a synthetic click (without pointerType) after touchend

  const polar = (x: number, y: number) => {
    const r = wheel.getBoundingClientRect();
    const R = r.width / 2;
    const dx = x - (r.left + R);
    const dy = y - (r.top + R);
    return { R, dist: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  };

  const track = (x: number, y: number, src: Source) => {
    const p = polar(x, y);
    if (p.dist < p.R * DEAD) { h.needle(null); return p; }
    h.needle(p.angle);
    const i = angleToIndex(p.angle, h.count());
    if (i !== h.active()) h.hover(i, src);
    return p;
  };

  // ---- mouse / pen: anywhere on screen selects by angle ----------------------
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || !h.isOpen() || !h.enabled()) return;
    px = e.clientX; py = e.clientY; lastTarget = e.target as Element;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (lastTarget?.closest(IGNORE)) return;
      pointerMoved = true;
      track(px, py, "pointer");
    });
  }, { passive: true });

  addEventListener("click", (e) => {
    if (!h.isOpen() || !h.enabled() || e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest(`${IGNORE}, a, button, input`)) return;
    if ((e as PointerEvent).pointerType === "touch" || e.timeStamp - lastTouch < 700) return; // touch path handles it
    const p = polar(e.clientX, e.clientY);
    if (p.dist < p.R * INNER * 0.9) return;
    if (p.dist <= p.R * 1.25) {
      const i = angleToIndex(p.angle, h.count());
      if (i !== h.active()) h.hover(i, "pointer");
      h.confirm(i, "pointer");
    }
  });

  addEventListener("contextmenu", (e) => {
    if (!h.isOpen() || !h.enabled() || (e.target as Element).closest(IGNORE)) return;
    e.preventDefault();
    h.back();
  });

  // ---- touch: drag a thumb around the wheel, lift to confirm --------------------
  const touches = new Map<number, { x: number; y: number; t: number; startDist: number }>();
  let multi = false;
  let lastPolar: ReturnType<typeof polar> | null = null;

  wheel.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !h.enabled()) return;
    const p = polar(e.clientX, e.clientY);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, startDist: p.dist });
    if (touches.size > 1) { multi = true; return; }
    multi = false;
    lastPolar = null;
    if (p.dist > p.R * INNER * 0.9) {
      wheel.setPointerCapture(e.pointerId);
      lastPolar = track(e.clientX, e.clientY, "touch");
    }
  });
  wheel.addEventListener("pointermove", (e) => {
    const s = touches.get(e.pointerId);
    if (e.pointerType !== "touch" || !s || multi) return;
    if (s.startDist > polar(s.x, s.y).R * INNER * 0.9 || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) {
      lastPolar = track(e.clientX, e.clientY, "touch");
    }
  });
  const touchEnd = (e: PointerEvent, cancelled: boolean) => {
    const s = touches.get(e.pointerId);
    if (e.pointerType !== "touch" || !s) return;
    touches.delete(e.pointerId);
    lastTouch = e.timeStamp;
    if (multi) {
      // two-finger tap = back
      if (touches.size === 0) { multi = false; if (!cancelled && e.timeStamp - s.t < 400) h.back(); }
      return;
    }
    if (cancelled) return;
    const R = polar(s.x, s.y).R;
    const inHub = s.startDist < R * INNER * 0.9;
    // swipe down that started in the hub = back
    if (inHub && e.clientY - s.y > 60 && Math.abs(e.clientX - s.x) < 50) { h.back(); return; }
    if (inHub) return; // a plain tap on the hub fires the hub button's click
    if (lastPolar && lastPolar.dist > R * DEAD && lastPolar.dist < R * 1.4) h.confirm(h.active(), "touch");
    lastPolar = null;
  };
  wheel.addEventListener("pointerup", (e) => touchEnd(e, false));
  wheel.addEventListener("pointercancel", (e) => touchEnd(e, true));

  // ---- keyboard ------------------------------------------------------------------
  let holdStart = 0, holding = false;
  addEventListener("keydown", (e) => {
    if (!h.enabled() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    const inPanel = !!t.closest(".panel");
    const k = e.key;

    if (!h.isOpen()) {
      if ((k === "Tab" && !e.shiftKey && t === document.body) || k === "q" || k === "Q") {
        if (e.repeat) return;
        e.preventDefault();
        holding = true; holdStart = performance.now(); pointerMoved = false;
        h.open();
      } else if (k === "Enter" && t === document.body) {
        h.open();
      }
      return;
    }
    if (k === "Escape" || (k === "Backspace" && !inPanel)) { e.preventDefault(); h.back(); return; }
    if (inPanel) return;
    const n = h.count();
    const onUi = !!t.closest("a, button:not(.hub)");
    switch (k) {
      case "ArrowRight": case "ArrowDown": case "d": case "D":
        e.preventDefault(); h.hover((h.active() + 1 + n) % n, "key"); break;
      case "ArrowLeft": case "ArrowUp": case "a": case "A":
        e.preventDefault(); h.hover((Math.max(0, h.active()) - 1 + n) % n, "key"); break;
      case "Enter": case " ":
        if (onUi || t.classList.contains("hub")) return;
        e.preventDefault(); h.confirm(Math.max(0, h.active()), "key"); break;
      case "PageDown": case "]": e.preventDefault(); h.page(1); break;
      case "PageUp": case "[": e.preventDefault(); h.page(-1); break;
      default:
        if (/^[1-8]$/.test(k) && Number(k) <= n) { e.preventDefault(); h.hover(Number(k) - 1, "key"); }
    }
  });
  addEventListener("keyup", (e) => {
    if (!holding || !(e.key === "Tab" || e.key === "q" || e.key === "Q")) return;
    holding = false;
    // Hold-and-release (game style): releasing confirms what the pointer aimed at.
    if (performance.now() - holdStart > 300 && pointerMoved && h.active() >= 0) h.confirm(h.active(), "pointer");
  });

  // ---- gamepad (progressive enhancement) --------------------------------------
  let polling = false;
  const prev: boolean[] = [];
  const poll = () => {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) { polling = false; return; }
    if (h.enabled()) {
      const [x, y] = pad.axes;
      if (Math.hypot(x, y) > 0.5 && h.isOpen()) {
        const angle = (Math.atan2(y, x) * 180) / Math.PI;
        h.needle(angle);
        const i = angleToIndex(angle, h.count());
        if (i !== h.active()) h.hover(i, "pad");
      }
      const pressed = (b: number) => !!pad.buttons[b]?.pressed && !prev[b];
      if (pressed(0)) h.isOpen() ? h.confirm(Math.max(0, h.active()), "pad") : h.open();
      if (pressed(1)) h.back();
      if (pressed(4)) h.page(-1);
      if (pressed(5)) h.page(1);
      if (pressed(9) && !h.isOpen()) h.open();
      pad.buttons.forEach((b, i) => (prev[i] = b.pressed));
    }
    requestAnimationFrame(poll);
  };
  addEventListener("gamepadconnected", () => {
    if (!polling) { polling = true; requestAnimationFrame(poll); }
  });
}
