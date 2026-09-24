// Single-cell 3D viewer shared by the Atlas and Quiz modes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCell, disposeCell, rbcMesh } from './cells.js';

const BG_DARK = new THREE.Color('#141120');
const BG_GLASS = new THREE.Color('#efe7dc');

export class CellViewer {
  constructor(renderer, dom, labelLayer) {
    this.renderer = renderer;
    this.labelLayer = labelLayer;
    this.scene = new THREE.Scene();
    this.scene.background = BG_DARK.clone();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
    this.camera.position.set(12, 11, 16);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 90;
    this.controls.enabled = false;

    const hemi = new THREE.HemisphereLight('#f4ecff', '#2a1f3a', 1.1);
    const key = new THREE.DirectionalLight('#fff4ea', 2.2);
    key.position.set(8, 14, 10);
    const rim = new THREE.DirectionalLight('#8fb0ff', 1.3);
    rim.position.set(-12, 4, -10);
    const under = new THREE.DirectionalLight('#ffd6de', 0.5);
    under.position.set(0, -10, 4);
    this.scene.add(hemi, key, rim, under);

    // 5 µm reference grid under the cell.
    this.grid = new THREE.GridHelper(60, 12, '#4b3f6b', '#2c2540');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.scene.add(this.grid);

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
    if (this.current) {
      this.holder.remove(this.current.group);
      disposeCell(this.current.group);
    }
    const cell = buildCell(id, seed);
    this.current = cell;
    this.holder.add(cell.group);
    this.holder.rotation.set(0, 0, 0);
    this.grid.position.y = -Math.max(3, cell.radius * 0.75);
    this._buildLabels();
    this.setCompare(!!this.compareRef);
    this.frame();
    return cell;
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
    this.scene.background.copy(on ? BG_GLASS : BG_DARK);
    this.grid.visible = !on;
    this.frame();
  }

  setCompare(on) {
    if (this.compareRef) {
      this.scene.remove(this.compareRef);
      this.compareRef = null;
    }
    if (on && this.current) {
      const ref = rbcMesh('normal');
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
