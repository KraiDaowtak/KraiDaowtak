// A virtual 100× oil-immersion field: cells lying on a glass slide, viewed from above.
import * as THREE from 'three';
import { buildCell, disposeCell, rbcMesh, plateletCell } from './cells.js';
import { mulberry32 } from './noise.js';

const SIMPLE_RBC = new Set(['normal', 'microcyte_hypo', 'macrocyte', 'polychromatophil', 'spherocyte', 'target', 'stomatocyte',
  'elliptocyte', 'teardrop', 'schistocyte', 'bite', 'echinocyte', 'acanthocyte', 'sickle']);

const RADIUS = { rouleaux: 7.2, macrocyte: 5.2, sickle: 5.2, teardrop: 4.6, elliptocyte: 5.0, microcyte_hypo: 3.0, spherocyte: 3.1, schistocyte: 3.2, acanthocyte: 3.6 };

function pickWeighted(weights, rand) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export class SmearField {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f2ebe1');
    this.viewH = 52; // µm visible vertically
    this.camera = new THREE.OrthographicCamera(-30, 30, 23, -23, 0.1, 200);
    this.camera.position.set(0, 60, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d2dbe4', 1.6));
    const key = new THREE.DirectionalLight('#fffaf2', 1.4);
    key.position.set(6, 30, 8);
    this.scene.add(key);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.markers = new THREE.Group();
    this.scene.add(this.markers);
    this.cells = [];
    this.aspect = 1.5;
    this.px = { w: 900, h: 600 };
    this.raycaster = new THREE.Raycaster();
  }

  resize(w, h) {
    this.aspect = w / h;
    this.px = { w, h };
    const hh = this.viewH / 2;
    Object.assign(this.camera, { left: -hh * this.aspect, right: hh * this.aspect, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  // Radius (µm) of the circular eyepiece window, matching the CSS overlay (48% of the short side).
  get fieldRadius() {
    const short = Math.min(this.aspect, 1);
    return this.viewH * 0.48 * short;
  }

  clear() {
    this.cells.forEach((c) => { if (!c.shared) disposeCell(c.obj); });
    this.root.clear();
    this.clearMarkers();
    this.cells = [];
  }

  clearMarkers() {
    this.markers.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
    this.markers.clear();
  }

  build(comp, seed = 1) {
    this.clear();
    const rand = mulberry32(seed);
    const R = this.fieldRadius;
    const halfW = (this.viewH / 2) * Math.max(this.aspect, 1) + 6;
    const halfH = this.viewH / 2 + 6;
    const placed = [];
    const fits = (x, z, r, k = 0.86) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > (p.r + r) * k);
    const add = (obj, id, kind, r, x, z, shared = false) => {
      obj.position.set(x, kind === 'wbc' ? 0.5 : rand() * 0.4, z);
      obj.rotation.y = rand() * Math.PI * 2;
      obj.traverse((o) => (o.userData.pickRoot = obj));
      obj.userData.cellId = id;
      this.root.add(obj);
      const rec = { obj, id, kind, r, x, z, shared };
      this.cells.push(rec);
      placed.push({ x, z, r });
      return rec;
    };

    const [wMin, wMax] = comp.wbcPerField || [1, 3];
    const nW = wMin + Math.floor(rand() * (wMax - wMin + 1));
    for (let i = 0; i < nW && comp.wbc; i++) {
      const id = pickWeighted(comp.wbc, rand);
      const cell = buildCell(id, 1 + Math.floor(rand() * 9999));
      const r = Math.min(cell.radius, 8.5);
      for (let t = 0; t < 80; t++) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (R - r - 1);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (fits(x, z, r, 1.0)) { add(cell.group, id, 'wbc', r, x, z); break; }
        if (t === 79) disposeCell(cell.group);
      }
    }

    const [pMin, pMax] = comp.plt || [6, 10];
    const nP = pMin + Math.floor(rand() * (pMax - pMin + 1));
    for (let i = 0, t = 0; i < nP && t < 200; t++) {
      const x = (rand() * 2 - 1) * halfW, z = (rand() * 2 - 1) * halfH;
      if (!fits(x, z, 1.4, 1)) continue;
      add(plateletCell(1 + i, 0.9 + rand() * 0.4).group, 'platelet', 'plt', 1.4, x, z);
      i++;
    }

    // Red cells fill the monolayer.
    const target = Math.round((halfW * 2 * halfH * 2) / 62);
    for (let i = 0, t = 0; i < target && t < target * 30; t++) {
      const x = (rand() * 2 - 1) * halfW, z = (rand() * 2 - 1) * halfH;
      const id = pickWeighted(comp.rbc || { normal: 1 }, rand);
      const r = RADIUS[id] || 3.9;
      if (!fits(x, z, r)) continue;
      if (SIMPLE_RBC.has(id)) add(rbcMesh(id), id === 'normal' ? 'rbc' : id, 'rbc', r, x, z, true);
      else add(buildCell(id, 1 + Math.floor(rand() * 9999)).group, id, 'rbc', r, x, z);
      i++;
    }
    return this.cells;
  }

  pick(ndc, filter = () => true) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.root.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pickRoot) o = o.parent;
      const root = o?.userData.pickRoot;
      const rec = root && this.cells.find((c) => c.obj === root);
      if (rec && filter(rec)) return rec;
    }
    return null;
  }

  ring(rec, color = '#2c6aa3', width = 0.5) {
    const r = rec.r + 1.2;
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + width, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(rec.x, 8, rec.z);
    m.renderOrder = 10;
    this.markers.add(m);
    return m;
  }

  get pxPerUm() {
    return this.px.h / this.viewH;
  }

  // Screen position (px) of a cell, for HTML badges.
  toScreen(rec) {
    const v = new THREE.Vector3(rec.x, 0, rec.z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.px.w, y: (-v.y * 0.5 + 0.5) * this.px.h };
  }
}
