import * as THREE from 'three';
import { CellViewer } from './viewer.js';
import { AtlasMode } from './modes/atlas.js';
import { StreamMode } from './modes/stream.js';
import { QuizMode } from './modes/quiz.js';
import { DiffMode } from './modes/diff.js';
import { CasesMode } from './modes/cases.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const canvas = $('#gl');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#loading').innerHTML = '<p>เบราว์เซอร์นี้ไม่รองรับ WebGL จึงแสดงโมเดล 3 มิติไม่ได้ ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นใหม่</p>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ui = {
  stage, canvas,
  labels: $('#labels'),
  toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.className = 'toast'), 2600);
  },
};

const viewer = new CellViewer(renderer, canvas, ui.labels);
const modes = {
  atlas: new AtlasMode(viewer, ui),
  stream: new StreamMode(renderer, ui),
  quiz: new QuizMode(viewer, ui),
  diff: new DiffMode(ui),
  cases: new CasesMode(ui),
};
ui.goto = (mode, arg) => setMode(mode, arg);

let active = null;
function setMode(id, arg) {
  if (!modes[id]) id = 'atlas';
  if (active) active.exit();
  active = modes[id];
  document.body.dataset.mode = id;
  document.querySelectorAll('[data-for]').forEach((el) => {
    el.hidden = !el.dataset.for.split(' ').includes(id);
  });
  document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === id)));
  resize();
  active.enter(arg);
  try { localStorage.setItem('hv:mode', id); } catch (e) { /* storage unavailable */ }
}

document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  viewer.resize(w, h);
  Object.values(modes).forEach((m) => m.resize?.(w, h));
}
new ResizeObserver(resize).observe(stage);

// Click (not drag) detection on the canvas.
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; active?.pointerDown?.(e); });
canvas.addEventListener('pointermove', (e) => active?.pointerMove?.(e));
canvas.addEventListener('pointerup', (e) => {
  active?.pointerUp?.(e);
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  active?.click?.(ndc, e, { x: e.clientX - r.left, y: e.clientY - r.top });
});
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  active?.key?.(e);
});

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (active) {
    active.update(dt);
    const { scene, camera, clipping = [] } = active.view();
    renderer.clippingPlanes = clipping;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}

let start = 'atlas';
try { start = localStorage.getItem('hv:mode') || 'atlas'; } catch (e) { /* ignore */ }
const hash = location.hash.replace('#', '');
if (modes[hash]) start = hash;
setMode(start);
$('#loading').hidden = true;
loop();
