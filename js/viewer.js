// Single-cell 3D viewer shared by the Atlas and Quiz modes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCell, disposeCell, rbcMesh } from './cells.js';

const BG_GLASS = new THREE.Color('#f3ede4');

// Photo-studio cyclorama: a bright pool of light fading to lilac at the edges.
function studioBackdrop() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 0, 512);
  lin.addColorStop(0, '#f3f6f9');
  lin.addColorStop(0.62, '#e4eaf0');
  lin.addColorStop(1, '#cbd5df');
  g.fillStyle = lin;
  g.fillRect(0, 0, 512, 512);
  const glow = g.createRadialGradient(256, 190, 10, 256, 230, 330);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 512, 512);
  const warm = g.createRadialGradient(70, 40, 0, 70, 40, 260);
  warm.addColorStop(0, 'rgba(206,224,242,0.6)');
  warm.addColorStop(1, 'rgba(206,224,242,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft ambient-occlusion blob that sits right under the cell.
function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(22,42,64,0.55)');
  r.addColorStop(0.5, 'rgba(22,42,64,0.22)');
  r.addColorStop(1, 'rgba(22,42,64,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export class CellViewer {
  constructor(renderer, dom, labelLayer) {
    this.renderer = renderer;
    this.labelLayer = labelLayer;
    this.scene = new THREE.Scene();
    this.studio = studioBackdrop();
    this.scene.background = this.studio;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
    this.camera.position.set(12, 11, 16);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 90;
    this.controls.enabled = false;

    const hemi = new THREE.HemisphereLight('#ffffff', '#bccad8', 1.5);
    const key = new THREE.DirectionalLight('#fff6ee', 2.6);
    key.position.set(9, 22, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    const rim = new THREE.DirectionalLight('#a8c3df', 1.2);
    rim.position.set(-14, 6, -12);
    const under = new THREE.DirectionalLight('#ffd6de', 0.45);
    under.position.set(0, -10, 4);
    this.scene.add(hemi, key, rim, under);

    // 5 µm reference grid under the cell, on a floor that catches its shadow.
    this.grid = new THREE.GridHelper(60, 12, '#98aabd', '#c6d1dc');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.75;
    this.scene.add(this.grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ color: '#1b2f45', opacity: 0.3 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.blob = contactShadow();
    this.scene.add(this.blob);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.compareRef = null;
    this.current = null;
    this.labels = [];
    this.showLabels = true;
    this.autoRotate = true;
    this.stain = false;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);
    this.slice = 0;
    this._camGoal = null;
    this._tmp = new THREE.Vector3();
  }

  setCell(id, seed = 7) {
    return this.setObject(buildCell(id, seed));
  }

  // Show any built object ({ group, labels, radius }). keepView keeps rotation and camera,
  // used when a cell is rebuilt live while the learner adjusts it.
  setObject(cell, { keepView = false } = {}) {
    if (this.current) {
      this.holder.remove(this.current.group);
      disposeCell(this.current.group);
    }
    this.current = cell;
    this.holder.add(cell.group);
    if (!keepView) this.holder.rotation.set(0, 0, 0);
    cell.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const floorY = -Math.max(3, cell.radius * 0.75);
    this.grid.position.y = floorY;
    this.floor.position.y = floorY - 0.02;
    this.blob.position.y = floorY + 0.02;
    this.blob.scale.setScalar(cell.radius * 2.6);
    this._buildLabels();
    this.setCompare(!!this.compareRef);
    if (!keepView) this.frame();
    return cell;
  }

  setLabelList(labels) {
    if (!this.current) return;
    this.current.labels = labels;
    this._buildLabels();
  }

  frame() {
    const r = this.current ? this.current.radius : 5;
    const extra = this.compareRef ? r + 5 : 0;
    const dist = (r + extra * 0.5) * 4.4 + 8;
    this.controls.target.set(extra * 0.5, 0, 0);
    const dir = this.stain ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0.55, 0.55, 0.75).normalize();
    this._camGoal = this.controls.target.clone().addScaledVector(dir, dist);
  }

  setStain(on) {
    this.stain = on;
    this.scene.background = on ? BG_GLASS : this.studio;
    this.grid.visible = this.floor.visible = this.blob.visible = !on;
    this.frame();
  }

  setCompare(on) {
    if (this.compareRef) {
      this.scene.remove(this.compareRef);
      this.compareRef = null;
    }
    if (on && this.current) {
      const ref = rbcMesh('normal');
      ref.castShadow = true;
      ref.position.set(this.current.radius + 5, this.grid.position.y + 1.2, 0);
      this.compareRef = ref;
      this.scene.add(ref);
    }
  }

  setSlice(v) {
    // v in [0,1]: 0 = whole cell, 1 = cut through almost everything.
    this.slice = v;
    const r = this.current ? this.current.radius + 1 : 8;
    this.clipPlane.constant = v <= 0.001 ? 1000 : r - v * 2 * r;
  }

  get clippingPlanes() {
    return this.slice > 0.001 ? [this.clipPlane] : [];
  }

  _buildLabels() {
    this.labelLayer.replaceChildren();
    this.labels = (this.current?.labels || []).map((l) => {
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `<i></i><span><b>${l.th}</b><em>${l.en}</em></span>`;
      this.labelLayer.appendChild(el);
      return { ...l, el };
    });
    this.labelLayer.hidden = !this.showLabels;
  }

  setLabels(on) {
    this.showLabels = on;
    this.labelLayer.hidden = !on;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w;
    this.h = h;
  }

  update(dt) {
    if (this._camGoal) {
      this.camera.position.lerp(this._camGoal, 1 - Math.pow(0.001, dt));
      if (this.camera.position.distanceTo(this._camGoal) < 0.05) this._camGoal = null;
    }
    if (this.autoRotate && !this.stain) this.holder.rotation.y += dt * 0.25;
    this.controls.update();
    if (this.showLabels && this.labels.length) {
      const camDir = this._tmp;
      for (const l of this.labels) {
        const p = this.holder.localToWorld(l.p.clone());
        const toCam = camDir.copy(this.camera.position).sub(p).normalize();
        const facing = toCam.dot(p.clone().sub(this.controls.target).normalize());
        p.project(this.camera);
        const x = (p.x * 0.5 + 0.5) * this.w, y = (-p.y * 0.5 + 0.5) * this.h;
        const clipped = this.slice > 0.001 && this.clipPlane.distanceToPoint(this.holder.localToWorld(l.p.clone())) < 0;
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        l.el.classList.toggle('back', facing < -0.35 || clipped);
      }
    }
  }
}
