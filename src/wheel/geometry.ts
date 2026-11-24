// Single source of truth for wheel shapes. All angles in degrees, 0° = 3 o'clock,
// increasing clockwise (SVG y-down). Wedge 0 is centered at the top (-90°).

export type Wedge = {
  d: string;        // filled wedge path
  band: string;     // outer-arc highlight band (stroke)
  edgeOut: string;  // 1px bevel along the outer edge
  edgeIn: string;   // 1px bevel along the inner edge
  start: number;
  end: number;
  mid: number;
  cx: number;       // label centroid, relative to wheel center
  cy: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const f = (n: number) => Math.round(n * 100) / 100;

function pt(c: number, r: number, deg: number): string {
  return `${f(c + r * Math.cos(rad(deg)))} ${f(c + r * Math.sin(rad(deg)))}`;
}

/**
 * @param count   wedges in the ring (1..8)
 * @param innerR  inner radius in px
 * @param outerR  outer radius in px
 * @param gapPx   visible gap between neighbouring wedges, constant width in px
 * @param labelR  radius of the label centroid
 * Paths are in a (2*outerR)² box, centered at (outerR, outerR).
 */
export function buildRing(count: number, innerR: number, outerR: number, gapPx = 1.5, labelR = outerR * 0.72): Wedge[] {
  const c = outerR;
  if (count <= 1) {
    const d =
      `M${pt(c, outerR, 0)}A${outerR} ${outerR} 0 1 1 ${pt(c, outerR, 180)}A${outerR} ${outerR} 0 1 1 ${pt(c, outerR, 0)}Z` +
      `M${pt(c, innerR, 0)}A${innerR} ${innerR} 0 1 0 ${pt(c, innerR, 180)}A${innerR} ${innerR} 0 1 0 ${pt(c, innerR, 0)}Z`;
    const br = outerR - 1.5;
    const band = `M${pt(c, br, -90)}A${br} ${br} 0 1 1 ${pt(c, br, 89.9)}A${br} ${br} 0 1 1 ${pt(c, br, 269.8)}`;
    return [{ d, band, edgeOut: arc(c, outerR - 0.5, -90, 269.8, 0), edgeIn: arc(c, innerR + 0.5, -90, 269.8, 0), start: -270, end: 90, mid: -90, cx: 0, cy: -labelR }];
  }
  const span = 360 / count;
  const padOut = (gapPx / 2 / outerR) * (180 / Math.PI);
  const padIn = (gapPx / 2 / innerR) * (180 / Math.PI);
  const large = span > 180 ? 1 : 0;
  const wedges: Wedge[] = [];
  for (let i = 0; i < count; i++) {
    const mid = -90 + i * span;
    const s = mid - span / 2;
    const e = mid + span / 2;
    const d =
      `M${pt(c, outerR, s + padOut)}` +
      `A${outerR} ${outerR} 0 ${large} 1 ${pt(c, outerR, e - padOut)}` +
      `L${pt(c, innerR, e - padIn)}` +
      `A${innerR} ${innerR} 0 ${large} 0 ${pt(c, innerR, s + padIn)}Z`;
    wedges.push({
      d, start: s, end: e, mid,
      band: arc(c, outerR - 1.5, s, e, gapPx),
      edgeOut: arc(c, outerR - 0.5, s, e, gapPx),
      edgeIn: arc(c, innerR + 0.5, s, e, gapPx),
      cx: f(labelR * Math.cos(rad(mid))),
      cy: f(labelR * Math.sin(rad(mid))),
    });
  }
  return wedges;
}

/** Clockwise arc at radius r from angle s to e, trimmed by half the gap at each end. */
export function arc(c: number, r: number, s: number, e: number, gapPx: number): string {
  const pad = (gapPx / 2 / r) * (180 / Math.PI);
  const large = e - s - 2 * pad > 180 ? 1 : 0;
  return `M${pt(c, r, s + pad)}A${f(r)} ${f(r)} 0 ${large} 1 ${pt(c, r, e - pad)}`;
}

/** Pointer angle (deg, same convention as buildRing) → wedge index. */
export function angleToIndex(angleDeg: number, count: number): number {
  if (count <= 1) return 0;
  const span = 360 / count;
  const rel = (((angleDeg + 90 + span / 2) % 360) + 360) % 360;
  return Math.floor(rel / span) % count;
}

/** Full annulus outline, for the shadow plate / static layers. */
export function annulus(innerR: number, outerR: number): string {
  return buildRing(1, innerR, outerR)[0].d;
}
