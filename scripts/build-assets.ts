// Generates the background (sharp + pre-blurred, AVIF + WebP), the film-grain tile,
// the Open Graph image and the favicon. Run with `npm run assets`; outputs are committed.
//
// Background source: if assets/bg-source.jpg (or .png/.webp) exists it is used, so you can
// drop in a royalty-free photo (record the credit in CREDITS.md). Otherwise an original
// night skyline with tower cranes is drawn procedurally below.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { buildRing } from "../src/wheel/geometry.ts";

const W = 1920, H = 1080;
const out = (p: string) => path.resolve(p);
fs.mkdirSync(out("public/bg"), { recursive: true });
fs.mkdirSync(out("src/assets"), { recursive: true });

// Deterministic PRNG so the skyline is stable between runs.
let seed = 20261020;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const r = (a: number, b: number) => a + rnd() * (b - a);

function windows(x: number, y: number, w: number, h: number, density: number, warm = 0.75): string {
  let s = "";
  const cw = 7, ch = 9, gx = 6, gy = 8;
  for (let yy = y + 10; yy < y + h - 12; yy += ch + gy) {
    for (let xx = x + 6; xx < x + w - cw - 4; xx += cw + gx) {
      if (rnd() > density) continue;
      const c = rnd() < warm ? (rnd() < 0.5 ? "#ffcf7a" : "#ffb85c") : "#a9d8ff";
      s += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${cw}" height="${ch}" fill="${c}" opacity="${r(0.35, 0.95).toFixed(2)}"/>`;
    }
  }
  return s;
}

function crane(x: number, baseY: number, h: number, jib: number, counter: number, flip = false): string {
  const topY = baseY - h;
  const m = 14; // mast width
  let lattice = "";
  for (let y = baseY; y > topY + 10; y -= 16) {
    lattice += `M${x} ${y}L${x + m} ${y - 16}M${x + m} ${y}L${x} ${y - 16}M${x} ${y}L${x + m} ${y}`;
  }
  const dir = flip ? -1 : 1;
  const jx = x + m / 2;
  const jy = topY + 8;
  const jibEnd = jx + dir * jib;
  const cEnd = jx - dir * counter;
  let jl = "";
  for (let i = 0; i < jib; i += 18) {
    const a = jx + dir * i, b = jx + dir * Math.min(jib, i + 18);
    jl += `M${a} ${jy}L${b} ${jy - 10}M${a} ${jy - 10}L${b} ${jy}`;
  }
  const hookX = jx + dir * jib * r(0.45, 0.85);
  const hookY = jy + r(120, 320);
  return `
  <g stroke="#06070c" fill="none" stroke-width="2.2">
    <path d="M${x} ${baseY}V${topY}M${x + m} ${baseY}V${topY}${lattice}"/>
    <path d="M${cEnd} ${jy}H${jibEnd}M${cEnd} ${jy - 10}H${jibEnd}${jl}" stroke-width="2"/>
    <path d="M${jx} ${topY - 46}L${jibEnd} ${jy - 10}M${jx} ${topY - 46}L${cEnd} ${jy - 10}" stroke-width="1.4"/>
    <path d="M${jx - 4} ${topY - 46}h8v40h-8z" fill="#06070c"/>
    <path d="M${hookX} ${jy}V${hookY}" stroke-width="1"/>
  </g>
  <rect x="${cEnd - dir * 6 - (flip ? 0 : 26)}" y="${jy - 4}" width="26" height="22" fill="#06070c"/>
  <rect x="${jx + dir * 4 - (flip ? 22 : 0)}" y="${jy + 2}" width="22" height="18" fill="#0b0d14"/>
  <rect x="${jx + dir * 8 - (flip ? 10 : 0)}" y="${jy + 6}" width="10" height="8" fill="#ffd28a" opacity="0.8"/>
  <path d="M${hookX - 5} ${hookY}h10l-2 8h-6z" fill="#06070c"/>
  <circle cx="${jx}" cy="${topY - 48}" r="3.2" fill="#ff3b30"/><circle cx="${jx}" cy="${topY - 48}" r="14" fill="url(#redglow)"/>
  <circle cx="${jibEnd}" cy="${jy - 6}" r="2.6" fill="#ff3b30"/><circle cx="${jibEnd}" cy="${jy - 6}" r="12" fill="url(#redglow)"/>`;
}

function skylineSvg(): string {
  let stars = "";
  for (let i = 0; i < 180; i++) {
    stars += `<circle cx="${r(0, W).toFixed(0)}" cy="${(r(0, 1) ** 2 * H * 0.45).toFixed(0)}" r="${r(0.4, 1.3).toFixed(1)}" fill="#fff" opacity="${r(0.15, 0.7).toFixed(2)}"/>`;
  }
  // far layer
  let far = "";
  for (let x = -20; x < W; ) {
    const w = r(40, 110), h = r(110, 300);
    far += `<rect x="${x.toFixed(0)}" y="${(H * 0.74 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 300).toFixed(0)}" fill="#1a2038"/>`;
    far += windows(x, H * 0.74 - h, w, h, 0.12, 0.6);
    x += w + r(0, 8);
  }
  // mid layer, taller towers
  let mid = "";
  for (let x = -40; x < W; ) {
    const w = r(70, 170), h = r(180, 520);
    const y = H * 0.8 - h;
    mid += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 300).toFixed(0)}" fill="#0f1324"/>`;
    if (rnd() < 0.35) {
      const ax = x + w * r(0.3, 0.7);
      mid += `<path d="M${ax.toFixed(0)} ${y}v-${r(30, 80).toFixed(0)}" stroke="#0f1324" stroke-width="3"/>`;
      mid += `<circle cx="${ax.toFixed(0)}" cy="${(y - 60).toFixed(0)}" r="2" fill="#ff4d3d" opacity=".9"/>`;
    }
    mid += windows(x, y, w, h, 0.28);
    x += w + r(4, 22);
  }
  // building under construction (front, right of center)
  const bx = 1180, bw = 420, floors = 13, fh = 34, by = H * 0.86;
  let site = `<rect x="${bx}" y="${by - floors * fh}" width="${bw}" height="${floors * fh + 200}" fill="#07080e"/>`;
  for (let f = 0; f < floors; f++) {
    const y = by - (f + 1) * fh;
    site += `<rect x="${bx - 6}" y="${y}" width="${bw + 12}" height="5" fill="#141826"/>`;
    for (let c = 0; c <= 7; c++) site += `<rect x="${bx + c * (bw / 7) - 3}" y="${y}" width="6" height="${fh}" fill="#141826"/>`;
    if (f < 9) for (let c = 0; c < 7; c++) if (rnd() < 0.3) site += `<rect x="${bx + c * (bw / 7) + 6}" y="${y + 9}" width="${bw / 7 - 12}" height="${fh - 12}" fill="#ffc46b" opacity="${r(0.15, 0.5).toFixed(2)}"/>`;
  }
  site += `<rect x="${bx + 30}" y="${by - floors * fh - 70}" width="${bw - 160}" height="70" fill="none" stroke="#141826" stroke-width="4"/>`;
  // work lights
  site += `<circle cx="${bx + 60}" cy="${by - 5 * fh}" r="70" fill="url(#worklight)"/><circle cx="${bx + bw - 80}" cy="${by - 9 * fh}" r="90" fill="url(#worklight)"/>`;

  // front low buildings + street glow
  let front = "";
  for (let x = -30; x < W; ) {
    const w = r(90, 240), h = r(60, 170);
    if (x > bx - 40 && x < bx + bw) { x = bx + bw + 10; continue; }
    front += `<rect x="${x.toFixed(0)}" y="${(H * 0.9 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 200).toFixed(0)}" fill="#05060a"/>`;
    front += windows(x, H * 0.9 - h, w, h, 0.18, 0.85);
    x += w + r(0, 10);
  }
  let lamps = "";
  for (let x = 40; x < W; x += r(120, 200)) lamps += `<circle cx="${x.toFixed(0)}" cy="${(H * 0.93).toFixed(0)}" r="46" fill="url(#lamp)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070a18"/><stop offset=".35" stop-color="#121a3a"/>
      <stop offset=".58" stop-color="#2c2a52"/><stop offset=".72" stop-color="#6b3b55"/>
      <stop offset=".8" stop-color="#c2643f"/><stop offset=".86" stop-color="#e08a48"/>
    </linearGradient>
    <radialGradient id="horizon" cx=".55" cy=".78" r=".55"><stop offset="0" stop-color="#ffb066" stop-opacity=".55"/><stop offset="1" stop-color="#ffb066" stop-opacity="0"/></radialGradient>
    <radialGradient id="redglow"><stop offset="0" stop-color="#ff3b30" stop-opacity=".55"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>
    <radialGradient id="worklight"><stop offset="0" stop-color="#fff2c8" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <radialGradient id="lamp"><stop offset="0" stop-color="#ffcf87" stop-opacity=".6"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9826a" stop-opacity="0"/><stop offset=".6" stop-color="#b9707a" stop-opacity=".22"/><stop offset="1" stop-color="#1b1a2e" stop-opacity=".1"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05060a" stop-opacity="0"/><stop offset="1" stop-color="#030305"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#horizon)"/>
  ${stars}
  <circle cx="420" cy="190" r="34" fill="#f3ead6" opacity=".9"/><circle cx="420" cy="190" r="90" fill="#f3ead6" opacity=".06"/>
  ${far}
  <rect y="${H * 0.55}" width="${W}" height="${H * 0.3}" fill="url(#fog)"/>
  ${crane(320, H * 0.8, 560, 520, 150)}
  ${mid}
  ${crane(1500, H * 0.86, 660, 640, 170, true)}
  ${crane(930, H * 0.84, 470, 360, 120)}
  ${site}
  ${front}
  ${lamps}
  <rect y="${H * 0.82}" width="${W}" height="${H * 0.18}" fill="url(#ground)"/>
</svg>`;
}

async function background() {
  const src = ["jpg", "jpeg", "png", "webp"].map((e) => out(`assets/bg-source.${e}`)).find((p) => fs.existsSync(p));
  const base = src
    ? sharp(src).resize(W, H, { fit: "cover" })
    : sharp(Buffer.from(skylineSvg()));
  const master = await base.png().toBuffer();

  // Pre-blurred, desaturated (~30%), darkened "slow-motion" version.
  const blurred = await sharp(master).resize(960).blur(12).modulate({ saturation: 0.3, brightness: 1.25 }).png().toBuffer();

  for (const w of [960, 1920]) {
    const s = sharp(master).resize(w);
    await s.clone().avif({ quality: w === 960 ? 48 : 52, effort: 6 }).toFile(out(`public/bg/city-sharp-${w}.avif`));
    await s.clone().webp({ quality: 72 }).toFile(out(`public/bg/city-sharp-${w}.webp`));
    const b = sharp(blurred).resize(w);
    await b.clone().avif({ quality: 40, effort: 6 }).toFile(out(`public/bg/city-blur-${w}.avif`));
    await b.clone().webp({ quality: 60 }).toFile(out(`public/bg/city-blur-${w}.webp`));
  }
  return blurred;
}

async function grain() {
  const s = 128;
  const buf = Buffer.alloc(s * s * 4);
  for (let i = 0; i < s * s; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    buf[i * 4] = buf[i * 4 + 1] = buf[i * 4 + 2] = v;
    buf[i * 4 + 3] = Math.round(rnd() * 20); // averages ~4% opacity
  }
  await sharp(buf, { raw: { width: s, height: s, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out("src/assets/grain.png"));
}

async function og(blurred: Buffer) {
  const content = JSON.parse(fs.readFileSync(out(fs.existsSync("src/content/content.json") ? "src/content/content.json" : "src/content/content.seed.json"), "utf8"));
  const p = content.profile;
  const R = 230, cx = 330, cy = 315;
  type C = { id: string; label: string; visible: boolean; order: number };
  const hasItems = (c: C) => ["about", "contact"].includes(c.id) || content.items.some((i: { categoryId: string; visible: boolean }) => i.categoryId === c.id && i.visible);
  const cats = (content.categories as C[]).filter((c) => c.visible && hasItems(c)).sort((a, b) => a.order - b.order).slice(0, 8);
  const ring = buildRing(cats.length, R * 0.38, R, 3);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const wedges = ring.map((w, i) => `
    <path d="${w.d}" transform="translate(${cx - R} ${cy - R})" fill="${i === 0 ? "rgba(255,255,255,0.16)" : "rgba(10,10,12,0.62)"}"/>
    ${i === 0 ? `<path d="${w.band}" transform="translate(${cx - R} ${cy - R})" stroke="#fff" stroke-width="5" fill="none"/>` : ""}
    <text x="${cx + w.cx}" y="${cy + w.cy + 6}" fill="#f2f2f2" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="17" letter-spacing="1.5" text-anchor="middle">${esc(cats[i].label.toUpperCase())}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="rgba(0,0,0,0.35)"/>
    <circle cx="${cx}" cy="${cy}" r="${R + 30}" fill="rgba(0,0,0,0.35)"/>
    ${wedges}
    <circle cx="${cx}" cy="${cy}" r="${R * 0.34}" fill="rgba(8,8,10,0.85)"/>
    <text x="${cx}" y="${cy + 4}" fill="#fff" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="24" text-anchor="middle">${esc(cats[0].label.toUpperCase())}</text>
    <rect x="${cx - 40}" y="${cy + 18}" width="80" height="4" fill="rgba(255,255,255,0.2)"/><rect x="${cx - 40}" y="${cy + 18}" width="52" height="4" fill="#6fbf5a"/>
    <text x="640" y="300" fill="#fff" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="76" letter-spacing="1">${esc(p.name.toUpperCase())}</text>
    <text x="644" y="345" fill="#6fbf5a" font-family="Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="3">${esc(p.title.toUpperCase())}</text>
  </svg>`;
  await sharp(blurred).resize(1200, 630, { fit: "cover" }).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(out("public/og.png"));
}

function favicon() {
  const ring = buildRing(6, 12, 30, 2.5);
  const paths = ring.map((w, i) => `<path d="${w.d}" transform="translate(2 2)" fill="${i === 0 ? "#fff" : "#2a2d36"}"/>`).join("");
  fs.writeFileSync(out("public/favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0a0a0c"/>${paths}<circle cx="32" cy="32" r="7" fill="#6fbf5a"/></svg>`);
}

const blurred = await background();
await grain();
await og(blurred);
favicon();
for (const f of fs.readdirSync(out("public/bg"))) console.log(`public/bg/${f}`.padEnd(32), (fs.statSync(out(`public/bg/${f}`)).size / 1024).toFixed(1), "KB");
console.log("src/assets/grain.png, public/og.png, public/favicon.svg written");
