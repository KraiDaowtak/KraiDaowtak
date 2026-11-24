// Procedural 3D blood cells. All units are micrometres (µm).
// Cells lie flat in the XZ plane with +Y as the thickness axis, the way they rest on a smear.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, mulberry32, smoothstep } from './noise.js';

const C = (hex) => new THREE.Color(hex);

// Wright-Giemsa inspired palette.
export const STAIN = {
  rbcDeep: '#c84a4f',
  rbcPale: '#f5cfc6',
  nucLight: '#7a4ea8',
  nucDark: '#2c1147',
  neutCyto: '#ecd2dd',
  neutGran: '#b77cb4',
  eosGran: '#f36a3e',
  basoGran: '#221042',
  lymphCyto: '#9ccbf0',
  monoCyto: '#b9b6d2',
  plasmaCyto: '#3a64b0',
  blastCyto: '#86a8dc',
  plt: '#b9a4de',
  pltGran: '#6a2f99',
};

// ---------------------------------------------------------------------------
// Shared helpers

const matCache = new Map();
function cachedMat(key, make) {
  if (!matCache.has(key)) {
    const m = make();
    m.userData.cached = true;
    matCache.set(key, m);
  }
  return matCache.get(key);
}
const geoCache = new Map();
function cachedGeo(key, make) {
  if (!geoCache.has(key)) {
    const g = make();
    g.userData.cached = true;
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

function baseSphere(w = 72, h = 48) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g);
}

function solidMat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.45, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, ...opts,
  });
}

export function glassyMat(color, opacity = 0.45, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness: 0.35, metalness: 0,
    clearcoat: 0.4, depthWrite: false, side: THREE.DoubleSide, ...opts,
  });
}

// Chromatin: colour each vertex of a nucleus by clumped fractal noise.
export function paintChromatin(geo, { light = STAIN.nucLight, dark = STAIN.nucDark, freq = 3, seed = 0, lo = 0.38, hi = 0.62, pattern } = {}) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const a = C(light), b = C(dark), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let t = smoothstep(lo, hi, fbm(x * freq + seed, y * freq + seed * 0.7, z * freq - seed, 4));
    if (pattern) t = Math.min(1, Math.max(0, pattern(x, y, z, t)));
    tmp.copy(a).lerp(b, t);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Build a lumpy blob (nucleus / cytoplasm) from a unit sphere.
export function blob(r, { scale = [1, 1, 1], amp = 0.08, freq = 2.2, seed = 0, deform, w = 72, h = 48 } = {}) {
  const g = baseSphere(w, h);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = 1 + amp * (fbm(v.x * freq + seed, v.y * freq + 3.1 * seed, v.z * freq + 7.7, 3) - 0.5) * 2;
    let x = v.x * r * d * scale[0], y = v.y * r * d * scale[1], z = v.z * r * d * scale[2];
    if (deform) [x, y, z] = deform(x, y, z, v);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function nucleusMat() {
  return cachedMat('nucleus', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
}

// Scatter granules inside an ellipsoid, avoiding listed spheres.
export function granules(count, { rMin, rMax, color, spread = 0.12, bounds, avoid = [], seed = 1, roughness = 0.35, emissive, emissiveIntensity = 0 }) {
  const rand = mulberry32(seed);
  const sph = new THREE.SphereGeometry(1, 8, 6);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness, metalness: 0, emissive: emissive || '#000000', emissiveIntensity });
  const mesh = new THREE.InstancedMesh(sph, material, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const base = C(color), tmp = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 60) {
    tries++;
    p.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (p.lengthSq() > 1) continue;
    p.set(p.x * bounds.x, p.y * bounds.y, p.z * bounds.z);
    const gr = rMin + rand() * (rMax - rMin);
    if (avoid.some((a) => p.distanceTo(a.c) < a.r + gr)) continue;
    s.setScalar(gr);
    m.compose(p, q, s);
    mesh.setMatrixAt(placed, m);
    tmp.copy(base).offsetHSL((rand() - 0.5) * spread * 0.3, 0, (rand() - 0.5) * spread);
    mesh.setColorAt(placed, tmp);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function cytoplasm(r, { flat = 0.7, color, opacity = 0.45, amp = 0.05, seed = 0, scale = [1, 1, 1], irregular = 0 }) {
  const g = blob(r, {
    scale: [scale[0], flat * scale[1], scale[2]], amp, freq: 2.5, seed,
    deform: irregular ? (x, y, z, n) => {
      const k = 1 + irregular * (fbm(n.x * 1.4 + 11, n.z * 1.4 + seed, 2, 2) - 0.5) * 2;
      return [x * k, y, z * k];
    } : undefined,
  });
  return new THREE.Mesh(g, glassyMat(color, opacity));
}

// ---------------------------------------------------------------------------
// Red cells: parametric discs driven by the Evans–Fung biconcave profile.

// Half-thickness of a normal RBC at normalised radius rho (Evans & Fung, 1972).
const EF = (rho, c0 = 0.81, c1 = 7.83, c2 = -4.39) =>
  0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (c0 + c1 * rho * rho + c2 * rho ** 4);

const RBC_TYPES = {
  normal: { R: 3.91 },
  microcyte_hypo: { R: 3.0, half: (r) => EF(r, 0.12, 6.4, -3.4), pale: '#f8e3dc', gamma: 1.4 },
  macrocyte: { R: 4.6, ax: 1.18, az: 0.94, half: (r) => EF(r, 1.4, 6, -3.2) },
  polychromatophil: { R: 4.4, half: (r) => EF(r, 1.6, 5, -3), deep: '#9d7f9f', pale: '#d3bfcc' },
  spherocyte: { R: 3.05, half: (r) => 2.2 * Math.sqrt(Math.max(0, 1 - r * r)), deep: '#b93a40', gamma: 0.6 },
  target: { R: 4.0, half: (r) => 0.5 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.25 + 4.2 * r * r) + 0.75 * Math.exp(-((r / 0.24) ** 2)) },
  stomatocyte: {
    R: 3.8,
    half: (r, t) => {
      const xn = r * Math.cos(t), zn = r * Math.sin(t);
      const slit = Math.exp(-((xn / 0.13) ** 2 + (zn / 0.5) ** 2));
      return EF(r, 1.9, 3, -2) * (1 - 0.85 * slit);
    },
    offset: (r) => 0.9 * (1 - r * r),
  },
  elliptocyte: { R: 3.7, ax: 1.45, az: 0.66, half: (r) => EF(r, 1.1, 5.5, -3) },
  teardrop: { R: 3.4, edge: (t) => 1 + 0.95 * Math.pow(Math.max(0, Math.cos(t)), 10), half: (r) => EF(r, 1.1, 6, -3.2), w: 128 },
  schistocyte: {
    R: 3.4, w: 160,
    edge: (t) => {
      const d = 0.1, c = Math.cos(t), tc = Math.acos(d);
      const cut = c > d ? d / c : 1;
      return cut + 0.28 * Math.exp(-(((Math.abs(t) - tc) / 0.12) ** 2));
    },
    half: (r) => EF(r, 1.4, 4, -2),
  },
  bite: { R: 3.85, w: 128, edge: (t) => 1 - 0.42 * Math.sqrt(Math.max(0, 1 - (t / 0.55) ** 2)) },
  echinocyte: { R: 3.6, half: (r) => EF(r, 1.6, 4, -2.2), spikes: 'echino' },
  acanthocyte: { R: 3.0, half: (r) => 1.8 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.9 + 0.1 * r * r), spikes: 'acantho', deep: '#bf4048', gamma: 0.6 },
};

function fibonacciDirs(n) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push(new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r));
  }
  return out;
}

function spikeSet(kind, seed = 3) {
  if (kind === 'echino') return fibonacciDirs(28).map((dir) => ({ dir, amp: 0.55, w: 0.16 }));
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.6;
    out.push({ dir: new THREE.Vector3(Math.cos(a), (rand() - 0.5) * 0.7, Math.sin(a)).normalize(), amp: 1.0 + rand() * 0.9, w: 0.1 + rand() * 0.04 });
  }
  return out;
}

// lod = true gives a light mesh for crowded scenes (bloodstream: hundreds of instances).
export function rbcGeometry(type = 'normal', lod = false) {
  return cachedGeo('rbc:' + type + (lod ? ':lo' : ''), () => {
    const p = { R: 3.91, ax: 1, az: 1, half: (r) => EF(r), deep: STAIN.rbcDeep, pale: STAIN.rbcPale, gamma: 0.85, w: 96, ...RBC_TYPES[type] };
    const g = lod ? new THREE.SphereGeometry(1, 28, 20) : new THREE.SphereGeometry(1, p.w, 64);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const pos = g.attributes.position;
    const thick = new Float32Array(pos.count);
    let maxT = 0;
    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i);
      const rho = Math.min(1, Math.hypot(sx, sz));
      const th = Math.atan2(sz, sx);
      const h = p.half(rho, th);
      const off = p.offset ? p.offset(rho, th) : 0;
      const e = p.edge ? p.edge(th) : 1;
      pos.setXYZ(i, p.R * e * sx * p.ax, (sy >= 0 ? 1 : -1) * h + off, p.R * e * sz * p.az);
      thick[i] = 2 * h;
      maxT = Math.max(maxT, 2 * h);
    }
    if (p.spikes) {
      const spikes = spikeSet(p.spikes);
      const v = new THREE.Vector3(), d = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        d.copy(v).normalize();
        let disp = 0;
        for (const s of spikes) {
          const ang = Math.acos(Math.min(1, Math.max(-1, d.dot(s.dir))));
          disp += s.amp * Math.exp(-((ang / s.w) ** 2));
        }
        v.addScaledVector(d, disp);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    // Thin regions stain pale: this is what produces central pallor under the microscope.
    const deep = C(p.deep), pale = C(p.pale), tmp = new THREE.Color();
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      tmp.copy(pale).lerp(deep, Math.pow(thick[i] / maxT, p.gamma));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const merged = mergeVertices(g);
    merged.computeVertexNormals();
    merged.userData.surface = (xn, zn) => {
      const rho = Math.min(1, Math.hypot(xn, zn)), th = Math.atan2(zn, xn);
      return { x: xn * p.R * p.ax, z: zn * p.R * p.az, y: p.half(rho, th) + (p.offset ? p.offset(rho, th) : 0) };
    };
    merged.userData.R = p.R * Math.max(p.ax, p.az);
    return merged;
  });
}

export function rbcMaterial() {
  return cachedMat('rbc', () => solidMat('#ffffff', { vertexColors: true, roughness: 0.42, clearcoat: 0.35, side: THREE.DoubleSide }));
}

function sickleGeometry() {
  return cachedGeo('rbc:sickle', () => {
    class Arc extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = -1.15 + 2.3 * t;
        return target.set(Math.sin(a) * 4.2, 0, -Math.cos(a) * 4.2 + 3.2);
      }
    }
    const tubular = 96, radial = 24;
    const g = new THREE.TubeGeometry(new Arc(), tubular, 1.25, radial, false);
    const pos = g.attributes.position;
    const arc = new Arc(), c = new THREE.Vector3(), v = new THREE.Vector3();
    const col = new Float32Array(pos.count * 3);
    const deep = C(STAIN.rbcDeep), pale = C('#e7948f'), tmp = new THREE.Color();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular;
      arc.getPoint(t, c);
      const taper = Math.max(0.04, Math.pow(Math.sin(Math.PI * t), 0.75));
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(taper);
        v.y *= 0.62;
        v.add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
        tmp.copy(pale).lerp(deep, Math.min(1, 0.55 + taper * 0.45));
        col.set([tmp.r, tmp.g, tmp.b], k * 3);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    g.userData.R = 4.6;
    return g;
  });
}

function rbcMesh(type) {
  const geo = type === 'sickle' ? sickleGeometry() : rbcGeometry(type);
  const mesh = new THREE.Mesh(geo, rbcMaterial());
  return mesh;
}

function dotMat(color, rough = 0.5) {
  return cachedMat('dot:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: rough }));
}

function onSurface(geo, xn, zn, sink = 0.1) {
  const s = geo.userData.surface(xn, zn);
  return new THREE.Vector3(s.x, s.y - sink, s.z);
}

// ---------------------------------------------------------------------------
// White cells, platelets and inclusion variants

export function lobedNucleus(n, seed, { arc = 2.7, lobeR = 1.35, spread = 1.0 } = {}) {
  const group = new THREE.Group();
  const rand = mulberry32(seed);
  const centers = [];
  const span = Math.min(Math.PI * 1.35, 0.55 * n * spread);
  for (let i = 0; i < n; i++) {
    const a = -span / 2 + (n === 1 ? 0 : (i / (n - 1)) * span) + (rand() - 0.5) * 0.15;
    centers.push(new THREE.Vector3(Math.sin(a) * arc, (rand() - 0.5) * 0.5, -Math.cos(a) * arc + arc * 0.55));
  }
  const mat = nucleusMat();
  centers.forEach((c, i) => {
    const r = lobeR * (0.85 + rand() * 0.3);
    const g = paintChromatin(blob(r, { scale: [1, 0.72, 0.9], amp: 0.12, seed: seed + i * 5 }), { freq: 2.6, seed: seed + i });
    const m = new THREE.Mesh(g, mat);
    m.position.copy(c);
    m.rotation.y = rand() * Math.PI;
    group.add(m);
  });
  const filMat = cachedMat('filament', () => new THREE.MeshStandardMaterial({ color: '#4a2170', roughness: 0.7 }));
  for (let i = 0; i < n - 1; i++) {
    const curve = new THREE.LineCurve3(centers[i], centers[i + 1]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.2, 8, false), filMat));
  }
  return { group, centers, lobeR };
}

function neutrophilLike(seed, lobes, extraLabel) {
  const g = new THREE.Group();
  const cyto = cytoplasm(6.2, { color: STAIN.neutCyto, opacity: 0.4, seed });
  g.add(cyto);
  const nuc = lobedNucleus(lobes, seed, lobes > 5 ? { arc: 3.2, lobeR: 1.2, spread: 0.85 } : {});
  g.add(nuc.group);
  g.add(granules(420, {
    rMin: 0.06, rMax: 0.1, color: STAIN.neutGran, bounds: new THREE.Vector3(5.6, 3.8, 5.6),
    avoid: nuc.centers.map((c) => ({ c, r: nuc.lobeR * 0.95 })), seed: seed + 9,
  }));
  const mid = nuc.centers[0].clone().lerp(nuc.centers[1], 0.5);
  const labels = [
    { p: nuc.centers[Math.floor(lobes / 2)].clone().add(new THREE.Vector3(0, 1, 0)), th: `นิวเคลียส ${lobes} lobe`, en: 'Segmented nucleus' },
    { p: mid, th: 'เส้นใยโครมาตินเชื่อม lobe', en: 'Chromatin filament' },
    { p: new THREE.Vector3(-3.8, 1.8, 2.8), th: 'แกรนูลละเอียดสีชมพูม่วง', en: 'Specific granules' },
    { p: new THREE.Vector3(5.9, 0, -1), th: 'ไซโทพลาซึมสีชมพูอ่อน', en: 'Cytoplasm' },
  ];
  if (extraLabel) labels.unshift(extraLabel);
  return { group: g, labels, radius: 6.5 };
}

function bandNeutrophil(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(6.0, { color: STAIN.neutCyto, opacity: 0.4, seed }));
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = -2.2 + (i / 8) * 4.4;
    pts.push(new THREE.Vector3(Math.sin(a) * 2.6, Math.sin(i) * 0.15, -Math.cos(a) * 2.2 + 0.6));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 80, 0.95, 20, false);
  tube.deleteAttribute('uv');
  const tp = tube.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, tp.getY(i) * 0.8);
  tube.computeVertexNormals();
  paintChromatin(tube, { freq: 2.6, seed });
  g.add(new THREE.Mesh(tube, nucleusMat()));
  for (const t of [0, 1]) {
    const cap = paintChromatin(blob(0.95, { scale: [1, 0.8, 1], amp: 0.05, seed: seed + t }), { freq: 2.6, seed });
    const m = new THREE.Mesh(cap, nucleusMat());
    m.position.copy(curve.getPoint(t));
    g.add(m);
  }
  g.add(granules(380, {
    rMin: 0.06, rMax: 0.1, color: STAIN.neutGran, bounds: new THREE.Vector3(5.4, 3.6, 5.4),
    avoid: curve.getSpacedPoints(16).map((c) => ({ c, r: 1.05 })), seed: seed + 4,
  }));
  return {
    group: g, radius: 6.3,
    labels: [
      { p: curve.getPoint(0.5).add(new THREE.Vector3(0, 0.9, 0)), th: 'นิวเคลียสรูปเกือกม้า ไม่มีรอยคอด', en: 'Band / horseshoe nucleus' },
      { p: curve.getPoint(0.05), th: 'ส่วนที่แคบที่สุด > 1/3 ของส่วนกว้าง', en: 'No filament' },
      { p: new THREE.Vector3(-3, 1.8, -3), th: 'แกรนูลละเอียด', en: 'Fine granules' },
    ],
  };
}

function eosinophil(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(6.4, { color: '#f3d7cf', opacity: 0.3, seed }));
  const nuc = lobedNucleus(2, seed, { arc: 2.6, lobeR: 1.55, spread: 1.6 });
  g.add(nuc.group);
  g.add(granules(260, {
    rMin: 0.3, rMax: 0.4, color: STAIN.eosGran, spread: 0.2, bounds: new THREE.Vector3(5.9, 4.0, 5.9),
    avoid: nuc.centers.map((c) => ({ c, r: 1.45 })), seed: seed + 2, roughness: 0.18, emissive: '#5a1400', emissiveIntensity: 0.35,
  }));
  return {
    group: g, radius: 6.7,
    labels: [
      { p: nuc.centers[0].clone().add(new THREE.Vector3(0, 1.2, 0)), th: 'นิวเคลียส 2 lobe (แว่นตา)', en: 'Bilobed nucleus' },
      { p: new THREE.Vector3(3.5, 2.2, 2.5), th: 'แกรนูลใหญ่สีส้มแดง หักเหแสง', en: 'Eosinophilic granules' },
      { p: new THREE.Vector3(-4.2, 1.4, 3.8), th: 'มี major basic protein', en: 'MBP, peroxidase' },
    ],
  };
}

function basophil(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(5.4, { color: '#d8cbe6', opacity: 0.35, seed }));
  const nuc = lobedNucleus(2, seed, { arc: 2.0, lobeR: 1.6, spread: 1.4 });
  g.add(nuc.group);
  g.add(granules(95, {
    rMin: 0.38, rMax: 0.58, color: STAIN.basoGran, spread: 0.25, bounds: new THREE.Vector3(4.9, 3.6, 4.9), seed: seed + 3, roughness: 0.3,
  }));
  return {
    group: g, radius: 5.8,
    labels: [
      { p: new THREE.Vector3(1.2, 2.6, 1), th: 'แกรนูลใหญ่สีน้ำเงินดำ บังนิวเคลียส', en: 'Basophilic granules' },
      { p: nuc.centers[1].clone(), th: 'นิวเคลียส 2 lobe (มองเห็นยาก)', en: 'Obscured nucleus' },
      { p: new THREE.Vector3(-4.6, 0.5, -2), th: 'มีฮีสตามีน & เฮพาริน', en: 'Histamine, heparin' },
    ],
  };
}

function lymphocyte(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(4.3, { color: STAIN.lymphCyto, opacity: 0.55, flat: 0.8, seed }));
  const n = new THREE.Mesh(paintChromatin(blob(3.75, { scale: [1, 0.72, 0.97], amp: 0.05, seed }), { freq: 3.4, seed, lo: 0.4, hi: 0.55, dark: '#240b3c' }), nucleusMat());
  n.position.set(-0.3, 0, 0.1);
  g.add(n);
  return {
    group: g, radius: 4.6,
    labels: [
      { p: new THREE.Vector3(0, 2.7, 0), th: 'นิวเคลียสกลมใหญ่ โครมาตินหนาแน่น', en: 'Round nucleus, clumped chromatin' },
      { p: new THREE.Vector3(4.1, 0.2, 0.8), th: 'ขอบไซโทพลาซึมบาง สีฟ้า', en: 'Scant sky-blue cytoplasm' },
      { p: new THREE.Vector3(-3.4, 0.4, -2.4), th: 'N:C ratio สูง', en: 'High N:C ratio' },
    ],
  };
}

function reactiveLymph(seed) {
  const g = new THREE.Group();
  const cyto = blob(7.4, {
    scale: [1, 0.42, 1], amp: 0.05, seed,
    deform: (x, y, z, n) => {
      const k = 1 + 0.22 * (fbm(n.x * 1.3 + 4, n.z * 1.3 + seed, 1, 2) - 0.5) * 2;
      return [x * k, y, z * k];
    },
  });
  // Deeper blue at the periphery where it hugs neighbouring red cells.
  const pos = cyto.attributes.position, col = new Float32Array(pos.count * 3);
  const inner = C('#dce8f6'), outer = C('#2f62b8'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getZ(i)) / 8;
    tmp.copy(inner).lerp(outer, smoothstep(0.45, 0.95, d));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  cyto.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Mesh(cyto, glassyMat('#ffffff', 0.62, { vertexColors: true })));
  const n = new THREE.Mesh(paintChromatin(blob(3.5, { scale: [1.15, 0.6, 0.9], amp: 0.08, seed }), { freq: 2.8, seed, lo: 0.42, hi: 0.66, light: '#8c63b8' }), nucleusMat());
  n.position.set(-1.8, 0, -0.6);
  g.add(n);
  return {
    group: g, radius: 8,
    labels: [
      { p: new THREE.Vector3(6.4, 0.3, 2.5), th: 'ขอบสีน้ำเงินเข้ม โอบเม็ดเลือดแดง', en: 'Basophilic skirt' },
      { p: new THREE.Vector3(2.5, 1.2, -1.5), th: 'ไซโทพลาซึมมากขึ้น', en: 'Abundant cytoplasm' },
      { p: new THREE.Vector3(-1.8, 2.2, -0.6), th: 'นิวเคลียสใหญ่ โครมาตินหลวมขึ้น', en: 'Larger, looser nucleus' },
    ],
  };
}

function monocyte(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(8.2, { color: STAIN.monoCyto, opacity: 0.42, flat: 0.62, seed, irregular: 0.08 }));
  const nuc = blob(3.4, {
    scale: [1.2, 0.62, 0.95], amp: 0.13, freq: 2.6, seed,
    deform: (x, y, z, n) => {
      const notch = 1.9 * Math.exp(-((n.z / 0.38) ** 2)) * Math.max(0, n.x) ** 1.5;
      return [x - notch * 2.2, y, z];
    },
  });
  paintChromatin(nuc, { freq: 5, seed, lo: 0.35, hi: 0.75, light: '#8c69b4', dark: '#4a2476' });
  const nm = new THREE.Mesh(nuc, nucleusMat());
  nm.position.set(-1.2, 0, 0);
  g.add(nm);
  const rand = mulberry32(seed + 7);
  const vacMat = cachedMat('vacuole', () => glassyMat('#f7f6ff', 0.55, { roughness: 0.1 }));
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2, r = 4.5 + rand() * 2.2;
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.3 + rand() * 0.45, 16, 12), vacMat);
    v.position.set(Math.cos(a) * r + 0.6, (rand() - 0.5) * 1.5, Math.sin(a) * r);
    g.add(v);
  }
  g.add(granules(260, { rMin: 0.04, rMax: 0.07, color: '#c9a2c6', bounds: new THREE.Vector3(7.5, 4.4, 7.5), avoid: [{ c: new THREE.Vector3(-1.4, 0, 0), r: 4 }], seed: seed + 5 }));
  return {
    group: g, radius: 8.6,
    labels: [
      { p: new THREE.Vector3(1.0, 1.6, 0), th: 'นิวเคลียสรูปไต / พับไปมา', en: 'Kidney-shaped, folded nucleus' },
      { p: new THREE.Vector3(-3.2, 1.8, -1.5), th: 'โครมาตินละเอียดเป็นลูกไม้', en: 'Lacy chromatin' },
      { p: new THREE.Vector3(5.5, 1.2, 3.2), th: 'แวคิวโอล', en: 'Vacuoles' },
      { p: new THREE.Vector3(-5.5, 1, 4), th: 'ไซโทพลาซึมเทาอมฟ้า ground-glass', en: 'Grey-blue cytoplasm' },
    ],
  };
}

function plasmaCell(seed) {
  const g = new THREE.Group();
  const cyto = blob(5.0, { scale: [1.35, 0.62, 0.95], amp: 0.04, seed });
  g.add(new THREE.Mesh(cyto, glassyMat(STAIN.plasmaCyto, 0.62)));
  const nuc = paintChromatin(blob(2.6, { scale: [1, 0.8, 1], amp: 0.04, seed }), {
    freq: 2.2, seed, dark: '#240a3a', light: '#8a64b6',
    pattern: (x, y, z, t) => 0.55 * t + 0.55 * (Math.cos(8 * Math.atan2(z, x)) > 0.1 ? 1 : 0) * smoothstep(1.2, 2.3, Math.hypot(x, z)),
  });
  const nm = new THREE.Mesh(nuc, nucleusMat());
  nm.position.set(-3.6, 0, 0);
  g.add(nm);
  const hof = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), glassyMat('#eef2ff', 0.7));
  hof.scale.set(1, 0.7, 1.2);
  hof.position.set(-0.4, 0.4, 0);
  g.add(hof);
  return {
    group: g, radius: 7,
    labels: [
      { p: new THREE.Vector3(-3.6, 2.2, 0), th: 'นิวเคลียสอยู่ชิดขอบ โครมาตินแบบหน้าปัดนาฬิกา', en: 'Eccentric, clock-face nucleus' },
      { p: new THREE.Vector3(-0.4, 1.7, 0), th: 'Perinuclear hof (Golgi)', en: 'Perinuclear clear zone' },
      { p: new THREE.Vector3(4.5, 0.8, 1.5), th: 'ไซโทพลาซึมสีน้ำเงินเข้ม (RNA มาก)', en: 'Deep basophilic cytoplasm' },
    ],
  };
}

function myeloblast(seed) {
  const g = new THREE.Group();
  g.add(cytoplasm(7.0, { color: STAIN.blastCyto, opacity: 0.45, flat: 0.72, seed }));
  const nuc = paintChromatin(blob(5.0, { scale: [1, 0.66, 0.95], amp: 0.05, seed }), { freq: 8, seed, lo: 0.3, hi: 0.8, light: '#9a74c2', dark: '#5f3a8f' });
  const nm = new THREE.Mesh(nuc, nucleusMat());
  nm.position.set(-1.0, 0, 0);
  g.add(nm);
  const nucleolusMat = cachedMat('nucleolus', () => new THREE.MeshStandardMaterial({ color: '#c4c9f0', roughness: 0.4 }));
  const nl = [[-2.2, 2.9, 1.2], [0.4, 3.0, -1.4], [-3.4, 2.7, -1.8]];
  nl.forEach(([x, y, z], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.62 - i * 0.08, 20, 14), nucleolusMat);
    m.position.set(x, y, z);
    m.scale.y = 0.5;
    g.add(m);
  });
  const auerMat = cachedMat('auer', () => new THREE.MeshStandardMaterial({ color: '#e0457b', emissive: '#6a0f2d', emissiveIntensity: 0.8, roughness: 0.3 }));
  const auer = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 2.6, 4, 10), auerMat);
  auer.position.set(4.9, 0.5, 1.3);
  auer.rotation.set(Math.PI / 2, 0, 0.6);
  g.add(auer);
  return {
    group: g, radius: 7.4,
    labels: [
      { p: new THREE.Vector3(4.9, 0.9, 1.3), th: 'Auer rod: แท่งสีแดงชมพู (MPO)', en: 'Auer rod' },
      { p: new THREE.Vector3(-2.2, 3.2, 1.2), th: 'Nucleoli 2–5 อัน', en: 'Prominent nucleoli' },
      { p: new THREE.Vector3(-4.5, 1.8, 2.2), th: 'โครมาตินละเอียดมาก', en: 'Fine open chromatin' },
      { p: new THREE.Vector3(5.5, 0.2, -3), th: 'ไซโทพลาซึมน้อย N:C สูง', en: 'Scant blue cytoplasm' },
    ],
  };
}

function smudgeCell(seed) {
  const g = new THREE.Group();
  const geo = blob(4.8, {
    scale: [1.15, 0.16, 1], amp: 0.28, freq: 1.6, seed,
    deform: (x, y, z, n) => {
      const k = 1 + 0.35 * (fbm(n.x * 2 + seed, n.z * 2, 5, 3) - 0.5) * 2;
      return [x * k, y, z * k];
    },
  });
  paintChromatin(geo, {
    freq: 1.2, seed, light: '#b49ad4', dark: '#6b4a96', lo: 0.3, hi: 0.8,
    pattern: (x, y, z, t) => t * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(x * 1.8 + z * 0.9)),
  });
  g.add(new THREE.Mesh(geo, cachedMat('smudge', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, opacity: 0.85 }))));
  return {
    group: g, radius: 6,
    labels: [
      { p: new THREE.Vector3(0, 0.8, 0), th: 'นิวเคลียสแตกกระจาย ไม่มีไซโทพลาซึม', en: 'Crushed nucleus, no cytoplasm' },
      { p: new THREE.Vector3(4.5, 0.4, 2), th: 'เซลล์เปราะ แตกขณะป้ายสไลด์', en: 'Fragile lymphocyte' },
    ],
  };
}

function platelet(seed, scale = 1) {
  const g = new THREE.Group();
  const body = blob(1.3 * scale, { scale: [1, 0.36, 0.82], amp: 0.12, freq: 2, seed });
  g.add(new THREE.Mesh(body, cachedMat('plt', () => glassyMat(STAIN.plt, 0.75, { depthWrite: true }))));
  g.add(granules(10, { rMin: 0.1 * scale, rMax: 0.16 * scale, color: STAIN.pltGran, bounds: new THREE.Vector3(0.7 * scale, 0.3 * scale, 0.5 * scale), seed: seed + 1 }));
  return {
    group: g, radius: 1.6 * scale,
    labels: [
      { p: new THREE.Vector3(0, 0.5, 0), th: 'Granulomere: แกรนูลสีม่วงตรงกลาง', en: 'Granulomere' },
      { p: new THREE.Vector3(1.25, 0, 0), th: 'Hyalomere: ขอบใส สีฟ้าอ่อน', en: 'Hyalomere' },
    ],
  };
}

function nrbc(seed) {
  const g = new THREE.Group();
  const cyto = blob(4.4, { scale: [1, 0.42, 0.95], amp: 0.03, seed });
  g.add(new THREE.Mesh(cyto, solidMat('#c79aa5', { transparent: true, opacity: 0.75, depthWrite: false })));
  const nuc = paintChromatin(blob(1.9, { scale: [1, 0.85, 1], amp: 0.05, seed }), { freq: 3, seed, dark: '#1d0833', light: '#4a2170' });
  const n = new THREE.Mesh(nuc, nucleusMat());
  n.position.set(1.0, 0.4, -0.3);
  g.add(n);
  return {
    group: g, radius: 4.6,
    labels: [
      { p: new THREE.Vector3(1.0, 2.0, -0.3), th: 'นิวเคลียสกลมเล็ก ติดสีเข้มมาก (pyknotic)', en: 'Small dense nucleus' },
      { p: new THREE.Vector3(-3, 0.6, 1.5), th: 'ไซโทพลาซึมสีชมพูเทาเหมือนเม็ดเลือดแดง', en: 'Hemoglobinised cytoplasm' },
    ],
  };
}

function rouleaux(seed) {
  const g = new THREE.Group();
  const rand = mulberry32(seed);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const m = rbcMesh('normal');
    m.rotation.set(0, 0, Math.PI / 2 + (rand() - 0.5) * 0.12);
    m.rotation.y = (rand() - 0.5) * 0.1;
    m.position.set((i - (n - 1) / 2) * 1.55, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3);
    g.add(m);
  }
  return {
    group: g, radius: 7.5,
    labels: [
      { p: new THREE.Vector3(0, 4.2, 0), th: 'เม็ดเลือดแดงเรียงซ้อนแบบเหรียญ', en: 'Stacked like coins' },
      { p: new THREE.Vector3(-6, 0, 3), th: 'globulin ในพลาสมาสูงลดประจุลบ (zeta potential)', en: 'High plasma protein' },
    ],
  };
}

function withInclusions(type, seed) {
  const g = new THREE.Group();
  const base = rbcMesh('normal');
  g.add(base);
  const geo = base.geometry;
  const rand = mulberry32(seed);
  const labels = [];
  if (type === 'howell_jolly') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), dotMat('#3a1552', 0.6));
    m.position.copy(onSurface(geo, 0.5, 0.25, 0.1));
    g.add(m);
    labels.push({ p: m.position.clone().add(new THREE.Vector3(0, 0.5, 0)), th: 'Howell-Jolly body: เศษ DNA กลมเดี่ยว', en: 'Nuclear remnant (DNA)' });
  } else if (type === 'basophilic_stippling') {
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.92;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rand() * 0.06, 8, 6), dotMat('#343a9c'));
      m.position.copy(onSurface(geo, Math.cos(a) * r, Math.sin(a) * r, 0.02));
      if (rand() < 0.35) m.position.y *= -1;
      g.add(m);
    }
    labels.push({ p: onSurface(geo, 0.3, -0.4, 0).add(new THREE.Vector3(0, 0.4, 0)), th: 'จุดสีน้ำเงินกระจายทั่วเซลล์ (ribosome/RNA)', en: 'Aggregated ribosomes' });
  } else if (type === 'pappenheimer') {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.17 + rand() * 0.06, 10, 8), dotMat('#2f2a6b'));
      m.position.copy(onSurface(geo, 0.72 + rand() * 0.12, -0.15 + rand() * 0.3, 0.02));
      g.add(m);
    }
    labels.push({ p: onSurface(geo, 0.78, 0, 0).add(new THREE.Vector3(0, 0.5, 0)), th: 'แกรนูลเหล็กกลุ่มเล็ก ชิดขอบเซลล์', en: 'Iron (siderotic) granules' });
  } else if (type === 'heinz') {
    const hm = dotMat('#6d5a86', 0.5);
    [0.4, 2.4, 4.3].forEach((a) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), hm);
      m.position.set(Math.cos(a) * 3.55, 0.3, Math.sin(a) * 3.55);
      g.add(m);
    });
    labels.push({ p: new THREE.Vector3(Math.cos(0.4) * 3.9, 0.9, Math.sin(0.4) * 3.9), th: 'Heinz body: Hb เสื่อมสภาพเกาะเยื่อหุ้ม', en: 'Denatured Hb (supravital stain)' });
  } else if (type === 'malaria_ring') {
    const ringMat = dotMat('#5d86d6', 0.45);
    const chromMat = dotMat('#8a1c6e', 0.45);
    const addRing = (xn, zn, s) => {
      const c = onSurface(geo, xn, zn, 0.05);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 * s, 0.13 * s, 12, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(c);
      g.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 14, 10), chromMat);
      dot.position.copy(c).add(new THREE.Vector3(0.72 * s, 0.08, 0));
      g.add(dot);
      return c;
    };
    const c1 = addRing(-0.25, 0.1, 1);
    addRing(0.55, -0.35, 0.75);
    labels.push({ p: c1.clone().add(new THREE.Vector3(0, 0.6, 0)), th: 'Ring form: วงไซโทพลาซึมบาง + จุดโครมาติน', en: 'Signet-ring trophozoite' });
    labels.push({ p: onSurface(geo, 0.55, -0.35, 0).add(new THREE.Vector3(0.6, 0.5, 0)), th: 'ติดเชื้อหลายตัวในเซลล์เดียว (P. falciparum)', en: 'Multiple infection' });
  }
  return { group: g, labels, radius: 4.3 };
}

const RBC_LABELS = {
  normal: [
    { p: [0, 0.6, 0], th: 'Central pallor ~1/3 ของเส้นผ่านศูนย์กลาง', en: 'Central pallor' },
    { p: [3.3, 1.3, 0], th: 'ขอบหนา ~2.5 µm', en: 'Thick rim' },
    { p: [-2, 0.5, 3], th: 'ไม่มีนิวเคลียส', en: 'Anucleate' },
  ],
  microcyte_hypo: [
    { p: [0, 0.4, 0], th: 'Central pallor กว้าง > 1/2', en: 'Enlarged pallor' },
    { p: [2.8, 0.9, 0], th: 'ขนาดเล็ก < 6 µm', en: 'Microcytic' },
  ],
  macrocyte: [
    { p: [0, 1, 0], th: 'ขนาดใหญ่ > 9 µm รูปไข่', en: 'Large oval cell' },
    { p: [-4.5, 1.2, 0], th: 'มักไม่มี central pallor ชัด', en: 'Pallor reduced' },
  ],
  polychromatophil: [
    { p: [0, 1.4, 0], th: 'สีเทาอมม่วง/ฟ้า (RNA ตกค้าง)', en: 'Blue-grey tint' },
    { p: [3.9, 1, 0], th: 'ใหญ่กว่าเม็ดเลือดแดงปกติเล็กน้อย', en: 'Slightly larger' },
  ],
  spherocyte: [
    { p: [0, 2.3, 0], th: 'ไม่มี central pallor ติดสีเข้ม', en: 'No pallor, dense' },
    { p: [3, 0.5, 0], th: 'ทรงกลม เล็ก (อัตราส่วนผิว/ปริมาตรลด)', en: 'Low surface:volume' },
  ],
  target: [
    { p: [0, 1.1, 0], th: 'จุดเข้มตรงกลาง (bull’s-eye)', en: 'Central density' },
    { p: [1.8, 0.8, 0], th: 'วงซีดล้อมรอบ', en: 'Pale ring' },
    { p: [3.5, 1.3, 0], th: 'ขอบเข้ม: เยื่อหุ้มเกินปริมาตร', en: 'Excess membrane' },
  ],
  stomatocyte: [
    { p: [0, 1.2, 0], th: 'Central pallor เป็นร่องยาวคล้ายปาก', en: 'Mouth-like slit' },
    { p: [3, 1.3, 1], th: 'เซลล์ทรงถ้วย', en: 'Cup-shaped' },
  ],
  elliptocyte: [
    { p: [0, 1, 0], th: 'รูปรีหรือรูปดินสอ', en: 'Elliptical / pencil' },
    { p: [5, 0.6, 0], th: 'แกนยาว > 2 เท่าของแกนสั้น (pencil cell)', en: 'Long axis > 2× short' },
  ],
  teardrop: [
    { p: [6.4, 0.3, 0], th: 'หางแหลมข้างเดียว', en: 'Single tail' },
    { p: [-1, 1.2, 0], th: 'ถูกบีบผ่านไขกระดูกที่เป็นพังผืด', en: 'Squeezed through fibrotic marrow' },
  ],
  schistocyte: [
    { p: [0.4, 1.1, 2.5], th: 'ขอบตรงถูกตัด (helmet cell)', en: 'Straight cut edge' },
    { p: [0.4, 0.4, -3.3], th: 'มุมแหลม (horn)', en: 'Horn' },
    { p: [-2, 1.1, 0], th: 'เศษเซลล์จากการถูกไฟบรินตัด', en: 'Fibrin-sheared fragment' },
  ],
  bite: [
    { p: [2.5, 0.8, 0], th: 'รอยแหว่งครึ่งวงกลม', en: 'Semicircular bite' },
    { p: [-1.5, 0.8, 1.5], th: 'ม้ามตัด Heinz body ออก', en: 'Splenic pitting of Heinz bodies' },
  ],
  echinocyte: [
    { p: [3.4, 1.6, 1], th: 'หนามสั้นสม่ำเสมอ 10–30 อัน', en: 'Short regular spicules' },
    { p: [0, 2.1, 0], th: 'กระจายรอบเซลล์เท่า ๆ กัน', en: 'Evenly spaced' },
  ],
  acanthocyte: [
    { p: [4, 0.5, 0], th: 'หนามยาวไม่เท่ากัน ปลายมน', en: 'Irregular spikes' },
    { p: [0, 2, 0], th: 'เซลล์เล็กเข้ม ไม่มี pallor', en: 'Dense, no pallor' },
  ],
};

export function buildCell(id, seed = 7) {
  let out;
  switch (id) {
    case 'neutrophil': out = neutrophilLike(seed, 3); break;
    case 'hypersegmented': out = neutrophilLike(seed, 6, { p: new THREE.Vector3(0, 2.5, 0), th: 'นิวเคลียส ≥ 6 lobe', en: '≥ 6 lobes' }); break;
    case 'band': out = bandNeutrophil(seed); break;
    case 'eosinophil': out = eosinophil(seed); break;
    case 'basophil': out = basophil(seed); break;
    case 'lymphocyte': out = lymphocyte(seed); break;
    case 'reactive_lymph': out = reactiveLymph(seed); break;
    case 'monocyte': out = monocyte(seed); break;
    case 'plasma_cell': out = plasmaCell(seed); break;
    case 'myeloblast': out = myeloblast(seed); break;
    case 'smudge': out = smudgeCell(seed); break;
    case 'platelet': out = platelet(seed, 1.35); break;
    case 'nrbc': out = nrbc(seed); break;
    case 'rouleaux': out = rouleaux(seed); break;
    case 'howell_jolly': case 'basophilic_stippling': case 'pappenheimer': case 'heinz': case 'malaria_ring':
      out = withInclusions(id, seed); break;
    case 'rbc': case 'sickle': default: {
      const type = id === 'rbc' ? 'normal' : id;
      const mesh = rbcMesh(type);
      const g = new THREE.Group();
      g.add(mesh);
      const labels = (RBC_LABELS[type] || (type === 'sickle' ? [
        { p: [0, 1.1, -1], th: 'รูปเคียว ปลายแหลม 2 ข้าง', en: 'Crescent, pointed ends' },
        { p: [-3.8, 0.3, 1.2], th: 'HbS polymer เมื่อขาดออกซิเจน', en: 'Polymerised HbS' },
      ] : [])).map((l) => ({ ...l, p: new THREE.Vector3(...l.p) }));
      out = { group: g, labels, radius: mesh.geometry.userData.R || 4.2 };
    }
  }
  out.group.userData.cellId = id;
  return out;
}

// Lightweight versions for crowded scenes (bloodstream, smear fields).
export { rbcMesh, platelet as plateletCell };

// Free per-instance GPU resources; cached geometries/materials are shared and kept.
export function disposeCell(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.cached) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { if (!m.userData.cached) m.dispose(); });
    if (o.isInstancedMesh) o.dispose();
  });
}
