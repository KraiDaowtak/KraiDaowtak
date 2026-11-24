// Bas-relief backdrop: blood cells carved into a pale plaster wall, lit from the top-left.
// A height map is stamped from real cell profiles (Evans–Fung for red cells), then shaded once
// on a canvas. A soft lamp follows the pointer; the wall drifts a few pixels for parallax.
import { mulberry32 } from './noise.js';

const LIGHT = (() => { const v = [-0.52, -0.62, 0.58]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
const EF = (r) => Math.sqrt(Math.max(0, 1 - r * r)) * (0.81 + 7.83 * r * r - 4.39 * r ** 4) / 4.4;

const BASE = [236, 235, 245];
const HIGH = [255, 255, 255];
const SHADE = [196, 188, 220];
const TINT = { rbc: [250, 226, 234], wbc: [232, 226, 250], plt: [238, 232, 250] };

function build(W, H, seed = 7) {
  const rand = mulberry32(seed);
  const h = new Float32Array(W * H);
  const kind = new Uint8Array(W * H); // 0 wall, 1 rbc, 2 wbc, 3 platelet
  const placed = [];
  const fits = (x, y, r) => placed.every((p) => Math.hypot(p.x - x, p.y - y) > (p.r + r) * 0.96);

  // Stamp one cell: shape(u, v) returns height for unit-disc coordinates, or <0 outside.
  const stamp = (cx, cy, rx, ry, rot, amp, k, shape) => {
    const c = Math.cos(rot), s = Math.sin(rot), R = Math.max(rx, ry) + 2;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
        const val = shape(u, v);
        if (val <= 0) continue;
        const i = y * W + x, z = val * amp;
        if (z > h[i]) { h[i] = z; kind[i] = k; }
      }
    }
  };

  const area = W * H;
  const scale = Math.max(0.75, Math.min(1.25, Math.sqrt(area) / 1300));
  // A few white cells first: lumpy domes with lobed nuclei pressed into them.
  const nW = Math.round(area / 420000) + 2;
  for (let i = 0, t = 0; i < nW && t < 400; t++) {
    const r = (52 + rand() * 24) * scale, x = rand() * W, y = rand() * H;
    if (!fits(x, y, r * 1.6)) continue;
    placed.push({ x, y, r });
    i++;
    const lobes = 2 + Math.floor(rand() * 3), ph = rand() * 6, spin = rand() * 6;
    stamp(x, y, r, r * (0.9 + rand() * 0.1), rand() * 6, 1, 2, (u, v) => {
      const d = Math.hypot(u, v);
      const edge = 1 + 0.05 * Math.sin(7 * Math.atan2(v, u) + ph);
      if (d > edge) return -1;
      let z = 0.55 * Math.sqrt(1 - (d / edge) ** 2);
      for (let l = 0; l < lobes; l++) {
        const a = spin + (l / lobes) * Math.PI * 1.3;
        const lx = Math.cos(a) * 0.34, ly = Math.sin(a) * 0.34;
        z += 0.32 * Math.exp(-((u - lx) ** 2 + (v - ly) ** 2) / 0.045);
      }
      return z;
    });
  }
  // Red cells: biconcave discs, some tilted so they read as ellipses.
  const nR = Math.round(area / 24000);
  for (let i = 0, t = 0; i < nR && t < nR * 25; t++) {
    const r = (26 + rand() * 20) * scale, x = rand() * W, y = rand() * H;
    if (!fits(x, y, r * 1.5)) continue;
    placed.push({ x, y, r });
    i++;
    const tilt = rand() < 0.3 ? 0.55 + rand() * 0.35 : 1;
    stamp(x, y, r, r * tilt, rand() * Math.PI, 0.62, 1, (u, v) => {
      const d = Math.hypot(u, v);
      return d >= 1 ? -1 : 0.05 + EF(d);
    });
  }
  // Platelets: small flat lozenges in the gaps.
  for (let i = 0, t = 0; i < nR * 0.5 && t < nR * 10; t++) {
    const r = (6 + rand() * 4) * scale, x = rand() * W, y = rand() * H;
    if (!fits(x, y, r * 2)) continue;
    placed.push({ x, y, r });
    i++;
    stamp(x, y, r, r * 0.65, rand() * Math.PI, 0.35, 3, (u, v) => {
      const d = u * u + v * v;
      return d >= 1 ? -1 : Math.sqrt(1 - d);
    });
  }
  return { h, kind };
}

function shade(canvas, W, H) {
  const { h, kind } = build(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const depth = 20; // relief strength in px of height per unit
  const rand = mulberry32(3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hl = h[x > 0 ? i - 1 : i], hr = h[x < W - 1 ? i + 1 : i];
      const hu = h[y > 0 ? i - W : i], hd = h[y < H - 1 ? i + W : i];
      let nx = -(hr - hl) * depth * 0.5, ny = -(hd - hu) * depth * 0.5, nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]; // ~0.58 on flat wall
      const t = (lit - LIGHT[2]) * 2.4;
      const k = kind[i];
      const base = k === 1 ? TINT.rbc : k === 2 ? TINT.wbc : k === 3 ? TINT.plt : BASE;
      const mix = k ? Math.min(1, h[i] * 2.2) : 0;
      const grain = (rand() - 0.5) * 3;
      for (let c = 0; c < 3; c++) {
        let v = BASE[c] + (base[c] - BASE[c]) * mix;
        v = t >= 0 ? v + (HIGH[c] - v) * Math.min(1, t) : v + (SHADE[c] - v) * Math.min(1, -t);
        px[i * 4 + c] = v + grain;
      }
      px[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function mountRelief() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = document.createElement('div');
  wrap.className = 'relief';
  wrap.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const lamp = document.createElement('div');
  lamp.className = 'relief-lamp';
  wrap.append(canvas, lamp);
  document.body.prepend(wrap);

  let built = { w: 0, h: 0 };
  const render = () => {
    // Cover the viewport plus a parallax margin; rebuild only when it grows noticeably.
    const W = Math.min(2400, Math.ceil(innerWidth * 1.04)), H = Math.min(1600, Math.ceil(innerHeight * 1.04));
    if (W <= built.w * 1.1 && H <= built.h * 1.1) return;
    canvas.width = W;
    canvas.height = H;
    shade(canvas, W, H);
    built = { w: W, h: H };
  };
  render();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 300); });

  if (reduce) return;
  let raf = 0, mx = 0.3, my = 0.2;
  addEventListener('pointermove', (e) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      wrap.style.setProperty('--lx', (mx * 100).toFixed(1) + '%');
      wrap.style.setProperty('--ly', (my * 100).toFixed(1) + '%');
      canvas.style.transform = `translate(${((0.5 - mx) * 10).toFixed(1)}px, ${((0.5 - my) * 10).toFixed(1)}px)`;
    });
  }, { passive: true });
}
