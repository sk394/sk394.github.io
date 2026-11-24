// Optional UI sounds, synthesised with Web Audio (no audio files to download).
// Off by default; the AudioContext is only created once the visitor enables sound.
let ctx: AudioContext | null = null;
let enabled = false;

export function setSound(on: boolean) {
  enabled = on;
  if (on && !ctx) ctx = new AudioContext();
  if (on) void ctx?.resume();
}

export const soundOn = () => enabled;

/** Short soft tick on wedge change. */
export function tick() {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.06);
}

/** Low filtered-noise whoosh on drill-down (reverse sweep for back). */
export function whoosh(up = true) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const len = 0.38;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(up ? 220 : 900, t);
  f.frequency.exponentialRampToValueAtTime(up ? 900 : 220, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}
