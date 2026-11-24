// A configurable "teaching cell" for the basics lesson: every morphological feature can be switched,
// and each feature's meshes are tagged so the lesson can spotlight one keypoint at a time.
import * as THREE from 'three';
import { blob, paintChromatin, granules, glassyMat, lobedNucleus, nucleusMat } from './cells.js';
import { fbm, mulberry32, smoothstep } from './noise.js';

const CELL_R = { small: 4.6, medium: 6.4, large: 8.4 };
const NC_FRAC = { high: 0.82, moderate: 0.62, low: 0.46 }; // nucleus radius / cell radius (top view)
const CYTO = { pink: '#ecc9d8', skyblue: '#9cc8ef', greyblue: '#b3b4d4', deepblue: '#3e68b6', salmon: '#d9a3a8' };
const CHROMATIN = {
  fine: { freq: 8, lo: 0.3, hi: 0.8, light: '#a27dc8', dark: '#6a4598' },
  lacy: { freq: 5, lo: 0.35, hi: 0.72, light: '#8c69b4', dark: '#4a2476' },
  clumped: { freq: 3, lo: 0.42, hi: 0.56, light: '#7a4ea8', dark: '#240b3c' },
  pyknotic: { freq: 2, lo: 0.2, hi: 0.9, light: '#3a1658', dark: '#160527' },
};

function cytoplasmMesh(R, state, seed) {
  const geo = blob(R, {
    scale: [1, 0.5, 1], amp: 0.03, seed,
    deform: (x, y, z, n) => {
      const th = Math.atan2(n.z, n.x);
      let k = 1;
      if (state.margin === 'irregular') k = 1 + 0.2 * (fbm(n.x * 2.6 + 3, n.z * 2.6 + seed, 1.7, 3) - 0.5) * 2;
      if (state.margin === 'scalloped') k = 1 - 0.14 * Math.pow(Math.abs(Math.sin(3 * th)), 4);
      return [x * k, y, z * k];
    },
  });
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const inner = new THREE.Color('#dfe9f6'), outer = new THREE.Color('#2f62b8');
  for (let i = 0; i < pos.count; i++) {
    if (state.cyto === 'skirt') {
      const d = Math.hypot(pos.getX(i), pos.getZ(i)) / R;
      tmp.copy(inner).lerp(outer, smoothstep(0.55, 1.0, d));
    } else tmp.set(CYTO[state.cyto] || CYTO.skyblue);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const opacity = state.cyto === 'deepblue' ? 0.72 : state.cyto === 'salmon' ? 0.7 : 0.5;
  return new THREE.Mesh(geo, glassyMat('#ffffff', opacity, { vertexColors: true }));
}

// Nucleus of radius nr, returns its group, spheres to keep granules out of, and its top height.
function nucleus(state, nr, seed) {
  const g = new THREE.Group();
  const avoid = [];
  const shape = state.nshape;
  if (shape === 'bilobed' || shape === 'multilobed' || shape === 'hyperseg') {
    const opts = shape === 'bilobed' ? [2, { arc: nr * 0.6, lobeR: nr * 0.46, spread: 1.6 }]
      : shape === 'multilobed' ? [4, { arc: nr * 0.66, lobeR: nr * 0.34 }]
        : [6, { arc: nr * 0.75, lobeR: nr * 0.27, spread: 0.85 }];
    const lob = lobedNucleus(opts[0], seed, opts[1]);
    g.add(lob.group);
    lob.centers.forEach((c) => avoid.push({ c, r: opts[1].lobeR }));
    g.position.z = -nr * 0.2;
  } else if (shape === 'band') {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = -2.2 + (i / 8) * 4.4;
      pts.push(new THREE.Vector3(Math.sin(a) * nr * 0.68, 0, -Math.cos(a) * nr * 0.58 + nr * 0.15));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 80, nr * 0.27, 20, false);
    tube.deleteAttribute('uv');
    const tp = tube.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setY(i, tp.getY(i) * 0.8);
    tube.computeVertexNormals();
    paintChromatin(tube, { seed });
    g.add(new THREE.Mesh(tube, nucleusMat()));
    for (const t of [0, 1]) {
      const cap = new THREE.Mesh(paintChromatin(blob(nr * 0.27, { scale: [1, 0.8, 1], amp: 0.04, seed: seed + t })), nucleusMat());
      cap.position.copy(curve.getPoint(t));
      g.add(cap);
    }
    curve.getSpacedPoints(14).forEach((c) => avoid.push({ c, r: nr * 0.3 }));
  } else {
    const kidney = shape === 'kidney';
    const geo = blob(nr, {
      scale: kidney ? [1.15, 0.62, 0.95] : [1, 0.66, 0.92], amp: kidney ? 0.12 : 0.05, freq: 2.6, seed,
      deform: kidney ? (x, y, z, n) => {
        const notch = 1.9 * Math.exp(-((n.z / 0.38) ** 2)) * Math.max(0, n.x) ** 1.5;
        return [x - notch * nr * 0.62, y, z];
      } : undefined,
    });
    g.add(new THREE.Mesh(geo, nucleusMat()));
    avoid.push({ c: new THREE.Vector3(0, 0, 0), r: nr * 0.95 });
  }
  // Repaint every nucleus surface with the chosen chromatin pattern.
  const c = CHROMATIN[state.chromatin] || CHROMATIN.clumped;
  g.traverse((o) => { if (o.isMesh && o.material === nucleusMat()) paintChromatin(o.geometry, { ...c, seed }); });
  return { group: g, avoid, top: nr * 0.62 };
}

/**
 * Build the cell. Returns { group, parts, radius, anchors, nucR, cellR } where parts maps a
 * feature name (cyto, nucleus, nucleoli, granules, vacuoles, hof, inclusion, ruler) to its meshes.
 */
export function buildTeachingCell(state, seed = 21) {
  const rand = mulberry32(seed);
  const R = CELL_R[state.size] || CELL_R.large;
  const nr = R * (NC_FRAC[state.nc] || NC_FRAC.moderate);
  const root = new THREE.Group();
  const parts = { cyto: [], nucleus: [], nucleoli: [], granules: [], vacuoles: [], hof: [], inclusion: [], ruler: [] };
  const tag = (key, obj) => { parts[key].push(obj); root.add(obj); return obj; };

  tag('cyto', cytoplasmMesh(R, state, seed));

  // With a hof the nucleus sits off-centre, as in a plasma cell.
  const nx = state.hof === 'present' ? -Math.min(R - nr - 0.3, nr * 0.45) : 0;
  const nuc = nucleus(state, nr, seed);
  nuc.group.position.x += nx;
  tag('nucleus', nuc.group);
  const avoid = nuc.avoid.map((a) => ({ c: a.c.clone().add(nuc.group.position), r: a.r }));

  if (state.nucleoli === 'present') {
    const mat = new THREE.MeshStandardMaterial({ color: '#c3c9f2', roughness: 0.35 });
    [[-0.3, 0.25], [0.28, -0.22], [0.05, 0.42]].forEach(([dx, dz], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(nr * (0.13 - i * 0.02), 20, 14), mat);
      m.scale.y = 0.55;
      m.position.set(nx + dx * nr, nuc.top - 0.05, dz * nr + nuc.group.position.z);
      tag('nucleoli', m);
    });
  }

  let hofPos = null;
  if (state.hof === 'present') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(nr * 0.5, 28, 18), glassyMat('#f3f6ff', 0.75));
    m.scale.set(1, 0.55, 1.15);
    hofPos = new THREE.Vector3(nx + nr * 1.15, 0.25, 0);
    m.position.copy(hofPos);
    tag('hof', m);
    avoid.push({ c: hofPos, r: nr * 0.55 });
  }

  const bounds = new THREE.Vector3(R * 0.9, R * 0.42, R * 0.9);
  const area = (R / 6.4) ** 2;
  const gspec = {
    fine: { n: 380, rMin: 0.06, rMax: 0.1, color: '#b77cb4' },
    azur: { n: 16, rMin: 0.16, rMax: 0.22, color: '#9c1f4a' },
    orange: { n: 240, rMin: 0.3, rMax: 0.4, color: '#f36a3e', emissive: '#5a1400', emissiveIntensity: 0.35, roughness: 0.18 },
    dark: { n: 80, rMin: 0.38, rMax: 0.55, color: '#221042', overNucleus: true },
  }[state.granules];
  if (gspec) {
    tag('granules', granules(Math.round(gspec.n * area), {
      ...gspec, bounds, avoid: gspec.overNucleus ? [] : avoid, seed: seed + 5,
    }));
  }

  const vacPositions = [];
  if (state.vacuoles === 'present') {
    const mat = glassyMat('#fbfbff', 0.6, { roughness: 0.08 });
    for (let i = 0, t = 0; i < 6 && t < 200; t++) {
      const a = rand() * Math.PI * 2, d = R * (0.55 + rand() * 0.32);
      const p = new THREE.Vector3(Math.cos(a) * d, (rand() - 0.3) * R * 0.2, Math.sin(a) * d);
      const r = 0.3 + rand() * 0.4;
      if (avoid.some((v) => v.c.distanceTo(p) < v.r + r)) continue;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
      m.position.copy(p);
      tag('vacuoles', m);
      vacPositions.push(p);
      i++;
    }
  }

  let incPos = new THREE.Vector3(R * 0.62, R * 0.2, R * 0.35);
  if (state.inclusion === 'auer') {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, Math.min(2.8, R * 0.35), 4, 10),
      new THREE.MeshStandardMaterial({ color: '#e0457b', emissive: '#6a0f2d', emissiveIntensity: 0.8, roughness: 0.3 }));
    m.position.copy(incPos);
    m.rotation.set(Math.PI / 2, 0, 0.6);
    tag('inclusion', m);
  } else if (state.inclusion === 'dohle') {
    const mat = new THREE.MeshStandardMaterial({ color: '#6f93d6', roughness: 0.6, transparent: true, opacity: 0.9 });
    [[0.78, -0.15], [0.7, 0.32], [-0.2, 0.82]].forEach(([fx, fz], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.42 + i * 0.05, 16, 10), mat);
      m.scale.set(1.6, 0.35, 0.9);
      m.rotation.y = rand() * 3;
      m.position.set(fx * R, R * 0.2, fz * R);
      tag('inclusion', m);
    });
    incPos = new THREE.Vector3(0.78 * R, R * 0.25, -0.15 * R);
  }

  // Measuring bar across the diameter, just below the cell.
  const y = -R * 0.55 - 0.6;
  const rulerMat = new THREE.LineBasicMaterial({ color: '#d9486a' });
  const rz = R * 1.12; // in front of the cell, toward the default camera
  const pts = [
    [-R, y + 0.5, rz], [-R, y - 0.5, rz], [-R, y, rz], [R, y, rz], [R, y + 0.5, rz], [R, y - 0.5, rz],
  ].map((p) => new THREE.Vector3(...p));
  const ruler = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]), rulerMat);
  tag('ruler', ruler);
  for (let u = -R + 1; u < R; u += 1) {
    const tick = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(u, y, rz), new THREE.Vector3(u, y + 0.25, rz)]), rulerMat);
    tag('ruler', tick);
  }

  // Own materials per cell so the lesson can dim and glow parts without touching shared ones.
  root.traverse((o) => {
    if (!o.material) return;
    o.material = o.material.clone();
    o.material.userData = { cached: false, baseOpacity: o.material.opacity, baseTransparent: o.material.transparent, baseDepthWrite: o.material.depthWrite };
  });

  return {
    group: root, parts, radius: R + 1, cellR: R, nucR: nr,
    anchors: {
      ruler: new THREE.Vector3(0, y - 0.3, R * 1.12),
      nucleusTop: new THREE.Vector3(nx, nuc.top + 0.3, nuc.group.position.z),
      nucleusSide: new THREE.Vector3(nx - nr * 0.8, nuc.top * 0.6, nuc.group.position.z + nr * 0.4),
      nucleolus: new THREE.Vector3(nx - 0.3 * nr, nuc.top + 0.15, 0.25 * nr + nuc.group.position.z),
      cytoEdge: new THREE.Vector3(R * 0.92, 0.3, -R * 0.25),
      cytoTop: new THREE.Vector3(-R * 0.55, R * 0.35, R * 0.55),
      hof: hofPos ? hofPos.clone().add(new THREE.Vector3(0, 0.8, 0)) : null,
      granules: new THREE.Vector3(R * 0.5, R * 0.35, -R * 0.55),
      vacuole: vacPositions[0] ? vacPositions[0].clone().add(new THREE.Vector3(0, 0.6, 0)) : null,
      inclusion: incPos.clone().add(new THREE.Vector3(0, 0.6, 0)),
    },
  };
}

// Spotlight: parts in `focus` keep full presence and glow softly; the others fade back.
export function spotlight(cell, focus, dim = []) {
  const all = focus === null;
  for (const [key, objs] of Object.entries(cell.parts)) {
    const on = all ? key !== 'ruler' : focus.includes(key) && !dim.includes(key);
    const half = !all && dim.includes(key);
    const visible = key === 'ruler' ? !all && focus.includes('ruler') : true;
    objs.forEach((obj) => obj.traverse((o) => {
      o.visible = visible;
      const m = o.material;
      if (!m || !m.userData) return;
      const base = m.userData.baseOpacity ?? 1;
      if (on) {
        m.opacity = base;
        m.transparent = m.userData.baseTransparent;
        m.depthWrite = m.userData.baseDepthWrite;
      } else {
        m.transparent = true;
        m.opacity = base * (half ? 0.35 : 0.12);
        m.depthWrite = false;
      }
      m.userData.glow = on && !all && key !== 'ruler';
      m.needsUpdate = true;
    }));
  }
}

// Gentle pulse on spotlighted parts; call every frame.
export function pulse(cell, time) {
  const k = 0.1 + 0.08 * Math.sin(time * 3);
  cell.group.traverse((o) => {
    const m = o.material;
    if (!m || !m.emissive || !m.userData) return;
    if (m.userData.baseEmissive === undefined) {
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseEmissiveIntensity = m.emissiveIntensity;
    }
    if (m.userData.glow) {
      m.emissive.set('#ffffff');
      m.emissiveIntensity = k;
    } else {
      m.emissive.setHex(m.userData.baseEmissive);
      m.emissiveIntensity = m.userData.baseEmissiveIntensity;
    }
  });
}

// Share of the cell's top-view area taken by the nucleus.
export const ncPercent = (cell) => Math.round((cell.nucR / cell.cellR) ** 2 * 100);
export const diameterUm = (cell) => Math.round(cell.cellR * 2);
