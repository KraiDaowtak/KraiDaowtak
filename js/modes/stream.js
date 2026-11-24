// "Voyage through a venule": ride the flow, click cells to identify and collect them.
import * as THREE from 'three';
import { buildCell, rbcGeometry, rbcMaterial } from '../cells.js';
import { mulberry32 } from '../noise.js';
import { byId, enOf } from '../data.js';

const VESSEL_R = 24;
const TARGETS = ['rbc', 'platelet', 'neutrophil', 'band', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil'];
const WBC_MIX = [['neutrophil', 6], ['lymphocyte', 4], ['monocyte', 2], ['eosinophil', 2], ['band', 1], ['basophil', 1]];

function endotheliumTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d4606d';
  g.fillRect(0, 0, 256, 256);
  const rand = mulberry32(5);
  for (let i = 0; i < 46; i++) {
    const x = rand() * 256, y = rand() * 256, w = 26 + rand() * 18, h = 9 + rand() * 6;
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.fillStyle = `rgba(${220 + rand() * 30}, ${110 + rand() * 30}, ${120 + rand() * 20}, 0.55)`;
      g.beginPath();
      g.ellipse(x + dx, y + dy, w, h, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(110, 30, 70, 0.55)';
      g.beginPath();
      g.ellipse(x + dx, y + dy, w * 0.28, h * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class StreamMode {
  constructor(renderer, ui) {
    this.ui = ui;
    this.panel = document.getElementById('streamPanel');
    this.hud = document.getElementById('streamHud');
    this.built = false;
    this.speed = 1;
    this.paused = false;
    this.found = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.drag = null;
    this.raycaster = new THREE.Raycaster();
  }

  build() {
    this.built = true;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#9c3346');
    scene.fog = new THREE.FogExp2('#b2475a', 0.0085);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 400);
    scene.add(this.camera);
    scene.add(new THREE.HemisphereLight('#fff0f2', '#8a2a3c', 2.0));
    const head = new THREE.DirectionalLight('#fff1f0', 1.6);
    head.position.set(3, 4, 0);
    head.target.position.set(0, 0, -20);
    this.camera.add(head, head.target);

    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 170 + 35 * Math.sin(3 * a);
      pts.push(new THREE.Vector3(Math.cos(a) * r, 28 * Math.sin(2 * a), Math.sin(a) * r));
    }
    const curve = (this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'));
    this.len = curve.getLength();
    const N = 1500;
    const frames = curve.computeFrenetFrames(N, true);
    this.lut = curve.getSpacedPoints(N);
    this.frames = frames;
    this.N = N;

    const vessel = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 600, VESSEL_R, 48, true),
      new THREE.MeshStandardMaterial({ map: endotheliumTexture(), side: THREE.BackSide, roughness: 0.55, emissive: '#7a1f30', emissiveIntensity: 0.45 })
    );
    scene.add(vessel);

    const rand = mulberry32(42);
    const profile = (r) => 0.35 + 0.65 * (1 - (r / VESSEL_R) ** 2); // Poiseuille flow: fastest at the centre.

    // Red cells.
    const nR = 560;
    this.rbc = new THREE.InstancedMesh(rbcGeometry('normal', true), rbcMaterial(), nR);
    this.rbc.frustumCulled = false;
    this.rbcState = [];
    for (let i = 0; i < nR; i++) {
      const r = 4 + Math.sqrt(rand()) * (VESSEL_R - 7), a = rand() * Math.PI * 2;
      this.rbcState.push({
        t: rand(), ox: Math.cos(a) * r, oy: Math.sin(a) * r, v: profile(r),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
        spin: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), 0.02 + rand() * 0.03),
      });
    }
    scene.add(this.rbc);

    // Platelets.
    const nP = 180;
    const pg = new THREE.SphereGeometry(1.3, 16, 12);
    pg.scale(1, 0.38, 0.85);
    this.plt = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#c9b3ee', roughness: 0.4 }), nP);
    this.plt.frustumCulled = false;
    this.pltState = [];
    for (let i = 0; i < nP; i++) {
      // Platelets are pushed toward the wall by red cells (margination).
      const r = VESSEL_R * (0.55 + rand() * 0.35), a = rand() * Math.PI * 2;
      this.pltState.push({
        t: rand(), ox: Math.cos(a) * r, oy: Math.sin(a) * r, v: profile(r),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
        spin: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rand(), rand(), rand()).normalize(), 0.04),
      });
    }
    scene.add(this.plt);

    // White cells roll along the endothelium.
    this.wbcs = [];
    const bag = WBC_MIX.flatMap(([id, n]) => Array(n).fill(id));
    bag.forEach((id, i) => {
      const cell = buildCell(id, 100 + i);
      const r = VESSEL_R - cell.radius - 1.5, a = rand() * Math.PI * 2;
      cell.group.traverse((o) => (o.userData.pickRoot = cell.group));
      scene.add(cell.group);
      this.wbcs.push({ id, group: cell.group, t: i / bag.length + rand() * 0.03, ox: Math.cos(a) * r, oy: Math.sin(a) * r, v: 0.28 + rand() * 0.08, roll: rand() * 6, pulse: 0 });
    });

    this.camT = 0;
  }

  // Point on the path at parameter t with a cross-section offset.
  place(t, ox, oy, out) {
    const f = ((t % 1) + 1) % 1;
    const i = Math.floor(f * this.N) % this.N;
    out.copy(this.lut[i]).addScaledVector(this.frames.normals[i], ox).addScaledVector(this.frames.binormals[i], oy);
    return out;
  }

  renderPanel(info) {
    const slots = TARGETS.map((id) => `<li class="${this.found.has(id) ? 'got' : ''}"><i></i><span>${byId[id].th}</span></li>`).join('');
    const c = info && byId[info];
    this.panel.innerHTML = `
      <p class="eyebrow">ภารกิจล่องหลอดเลือด</p>
      <h2>ตามหาเซลล์ให้ครบ ${TARGETS.length} ชนิด</h2>
      <p class="muted">ลากเพื่อหันมอง คลิกเซลล์ที่ลอยผ่านเพื่อระบุชนิดและเก็บเข้าสมุดสะสม</p>
      <div class="progress big"><i style="width:${(this.found.size / TARGETS.length) * 100}%"></i></div>
      <ul class="collect">${slots}</ul>
      ${c ? `<div class="found-card"><p class="eyebrow">เพิ่งพบ</p><h3>${c.th}</h3><p class="en">${enOf(c) ? enOf(c) + ' · ' : ''}${c.size}</p><p>${c.desc}</p>
        <button class="btn ghost" id="sAtlas">ดูโมเดลละเอียดใน Atlas</button></div>` : ''}
      <h3>สังเกตการไหล</h3>
      <ul class="keys">
        <li>เม็ดเลือดแดงเกาะกลุ่มไหลเร็วตรงกลาง (axial streaming) ส่วนขอบไหลช้ากว่า ตามกฎการไหลแบบ Poiseuille</li>
        <li>เกล็ดเลือดและเม็ดเลือดขาวถูกดันไปชิดผนัง (margination) พร้อมทำหน้าที่ทันทีเมื่อผนังหลอดเลือดบาดเจ็บ</li>
        <li>เม็ดเลือดขาวกลิ้งช้า ๆ บน endothelium (rolling) ด้วย selectin ก่อนเกาะแน่นและลอดออกนอกหลอดเลือด (diapedesis)</li>
      </ul>`;
    this.panel.querySelector('#sAtlas')?.addEventListener('click', () => this.ui.goto('atlas', info));
  }

  renderHud() {
    this.hud.innerHTML = `
      <button class="btn tool" id="sPause" aria-pressed="${this.paused}">${this.paused ? 'เล่นต่อ' : 'หยุดการไหล'}</button>
      <label class="slider" for="sSpeed"><span>ความเร็ว</span><input id="sSpeed" type="range" min="0.2" max="3" step="0.1" value="${this.speed}"></label>`;
    this.hud.querySelector('#sPause').addEventListener('click', () => { this.paused = !this.paused; this.renderHud(); });
    this.hud.querySelector('#sSpeed').addEventListener('input', (e) => (this.speed = +e.target.value));
  }

  pointerDown(e) { this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; }
  pointerMove(e) {
    if (!this.drag || !(e.buttons & 1)) return;
    this.yaw = this.drag.yaw - (e.clientX - this.drag.x) * 0.004;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.drag.pitch - (e.clientY - this.drag.y) * 0.004));
  }
  pointerUp() { this.drag = null; }

  click(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    this.rbc.boundingSphere = null;
    this.plt.boundingSphere = null;
    const hits = this.raycaster.intersectObjects([this.rbc, this.plt, ...this.wbcs.map((w) => w.group)], true);
    if (!hits.length) return;
    const h = hits[0];
    let id;
    if (h.object === this.rbc) id = 'rbc';
    else if (h.object === this.plt) id = 'platelet';
    else {
      const root = h.object.userData.pickRoot;
      const w = this.wbcs.find((x) => x.group === root);
      if (!w) return;
      id = w.id;
      w.pulse = 1;
    }
    const isNew = !this.found.has(id);
    this.found.add(id);
    this.renderPanel(id);
    if (isNew && this.found.size === TARGETS.length) this.ui.toast('ภารกิจสำเร็จ! เก็บครบทุกชนิดแล้ว', 'ok');
    else this.ui.toast(isNew ? `พบใหม่: ${byId[id].th}` : byId[id].th, isNew ? 'ok' : '');
  }

  enter() {
    if (!this.built) this.build();
    this.renderPanel();
    this.renderHud();
    this.resize(this.ui.stage.clientWidth, this.ui.stage.clientHeight);
  }

  exit() { this.drag = null; }

  resize(w, h) {
    if (!this.camera || !w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    const k = this.paused ? 0 : dt * this.speed * (26 / this.len);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    this.camT = (this.camT + k * 0.62) % 1;

    this.rbcState.forEach((c, i) => {
      c.t += k * c.v;
      if (!this.paused) c.q.multiply(c.spin);
      this.place(c.t, c.ox, c.oy, p);
      m.compose(p, c.q, s);
      this.rbc.setMatrixAt(i, m);
    });
    this.rbc.instanceMatrix.needsUpdate = true;
    this.pltState.forEach((c, i) => {
      c.t += k * c.v;
      if (!this.paused) c.q.multiply(c.spin);
      this.place(c.t, c.ox, c.oy, p);
      m.compose(p, c.q, s);
      this.plt.setMatrixAt(i, m);
    });
    this.plt.instanceMatrix.needsUpdate = true;
    for (const w of this.wbcs) {
      w.t += k * w.v;
      if (!this.paused) w.roll += dt * 0.5 * this.speed;
      this.place(w.t, w.ox, w.oy, w.group.position);
      w.group.rotation.set(w.roll, w.roll * 0.3, 0);
      w.pulse = Math.max(0, w.pulse - dt * 1.5);
      w.group.scale.setScalar(1 + Math.sin(w.pulse * Math.PI) * 0.25);
    }

    const i = Math.floor(this.camT * this.N) % this.N;
    const T = this.frames.tangents[i], Nn = this.frames.normals[i], B = this.frames.binormals[i];
    this.camera.position.copy(this.lut[i]);
    const dir = new THREE.Vector3()
      .addScaledVector(T, Math.cos(this.yaw) * Math.cos(this.pitch))
      .addScaledVector(B, Math.sin(this.yaw) * Math.cos(this.pitch))
      .addScaledVector(Nn, Math.sin(this.pitch));
    this.camera.up.copy(Nn);
    this.camera.lookAt(p.copy(this.camera.position).add(dir));
  }

  view() { return { scene: this.scene, camera: this.camera }; }
}
