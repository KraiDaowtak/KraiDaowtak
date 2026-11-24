import { buildTeachingCell, spotlight, pulse, ncPercent, diameterUm } from '../teach.js';
import { ATTRS, MORPH, STEPS, DEFAULT_STATE, DRILL_CELLS, DRILL_ROWS, ROW_STEP } from '../basics-data.js';
import { byId } from '../data.js';

const optTh = (attr, id) => ATTRS[attr].options.find((o) => o.id === id)?.th ?? id;
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Rank the reference cells by how many described features agree with `state`.
function matchCells(state) {
  const keys = Object.keys(ATTRS);
  return Object.entries(MORPH)
    .map(([id, m]) => ({ id, score: keys.filter((k) => m[k] === state[k]).length, total: keys.length }))
    .sort((a, b) => b.score - a.score);
}

function chipRow(attr, value, name) {
  const a = ATTRS[attr];
  return `<div class="attr-row" role="radiogroup" aria-label="${a.th}">
    <p class="attr-h">${a.th}</p>
    <div class="attr-chips">${a.options.map((o) => `
      <button role="radio" class="attr-chip" data-attr="${attr}" data-val="${o.id}" data-name="${name}" aria-checked="${o.id === value}">
        ${o.swatch ? `<i class="sw" style="background:${o.swatch}"></i>` : ''}<span>${o.th}${o.note ? `<small>${o.note}</small>` : ''}</span>
      </button>`).join('')}</div>
  </div>`;
}

export class BasicsMode {
  constructor(viewer, ui) {
    this.viewer = viewer;
    this.ui = ui;
    this.panel = document.getElementById('basicsPanel');
    this.hud = document.getElementById('basicsHud');
    this.tab = 'learn';
    this.step = 0; // 0..STEPS.length (last = summary)
    this.state = { ...DEFAULT_STATE };
    this.cell = null;
    this.time = 0;
    this.drill = null;
    this.stats = { cells: 0, ids: 0, rows: {} };
    try { Object.assign(this.stats, JSON.parse(localStorage.getItem('hv:basicsStats') || '{}')); } catch (e) { /* ignore */ }
    this.panel.addEventListener('click', (e) => this.onClick(e));
  }

  get isSummary() { return this.step >= STEPS.length; }
  get cur() { return STEPS[this.step]; }

  // ---------- Lesson

  rebuild(keepView = true) {
    this.cell = buildTeachingCell(this.state);
    this.viewer.setObject({ group: this.cell.group, labels: [], radius: this.cell.radius }, { keepView });
    this.applyStep();
  }

  applyStep() {
    const c = this.cell, a = c.anchors, s = this.state;
    if (this.isSummary) {
      spotlight(c, null);
      this.viewer.setLabelList([]);
      return;
    }
    const st = this.cur;
    spotlight(c, st.focus, st.dim || []);
    const L = (p, th, en) => (p ? [{ p, th, en }] : []);
    const labels = {
      size: L(a.ruler, `เส้นผ่านศูนย์กลาง ≈ ${diameterUm(c)} µm`, `${optTh('size', s.size)} · RBC = 7.5 µm`),
      nc: [...L(a.nucleusTop, `นิวเคลียสกินพื้นที่ ~${ncPercent(c)}%`, 'Nucleus'), ...L(a.cytoEdge, 'ไซโทพลาซึม', 'Cytoplasm')],
      nshape: L(a.nucleusTop, `นิวเคลียส${optTh('nshape', s.nshape)}`, 'Nuclear shape'),
      chromatin: L(a.nucleusSide, `โครมาติน${optTh('chromatin', s.chromatin)}`, 'Chromatin pattern'),
      nucleoli: s.nucleoli === 'present' ? L(a.nucleolus, 'นิวคลีโอลัส 3 อัน สีฟ้าอ่อน', 'Nucleoli') : L(a.nucleusTop, 'ไม่พบนิวคลีโอลัส', 'No nucleoli'),
      cyto: [...L(a.cytoTop, `สี${optTh('cyto', s.cyto)}`, 'Cytoplasm color'), ...L(a.cytoEdge, `ขอบ${optTh('margin', s.margin)}`, 'Marginal shape'),
        ...(s.hof === 'present' ? L(a.hof, 'Hof: บริเวณใสข้างนิวเคลียส', 'Juxtanuclear light area') : [])],
      granules: s.granules === 'none' ? L(a.cytoTop, 'ไม่มีแกรนูล', 'Agranular') : L(a.granules, `แกรนูล${optTh('granules', s.granules)}`, 'Granules'),
      vacuoles: s.vacuoles === 'present' ? L(a.vacuole, 'แวคิวโอล', 'Vacuole') : L(a.cytoTop, 'ไม่พบแวคิวโอล', 'No vacuoles'),
      inclusion: s.inclusion === 'none' ? L(a.cytoTop, 'ไม่พบ inclusion body', 'None') : L(a.inclusion, optTh('inclusion', s.inclusion), 'Inclusion body'),
    }[st.id];
    this.viewer.setLabelList(labels);
  }

  goStep(i) {
    this.step = Math.max(0, Math.min(STEPS.length, i));
    this.applyStep();
    this.renderLearn();
    this.renderHud();
    this.panel.closest('.panel').scrollTop = 0;
  }

  renderNav() {
    const btn = (i, label, cls = '') => `<button class="kp ${cls}" data-step="${i}" aria-current="${i === this.step}" title="${i < STEPS.length ? STEPS[i].th : 'สรุป'}">${label}</button>`;
    const cytoLabels = { cyto: 'สี · ขอบ · hof', granules: 'แกรนูล', vacuoles: 'แวคิวโอล', inclusion: 'Inclusion' };
    return `<div class="kp-nav">
      <div class="kp-group"><small>หลัก 5 ข้อ</small><div>${STEPS.filter((s) => s.no).map((s) => btn(STEPS.indexOf(s), s.no, 'num')).join('')}</div></div>
      <div class="kp-group"><small>ลักษณะไซโทพลาซึม</small><div>${STEPS.filter((s) => !s.no).map((s) => btn(STEPS.indexOf(s), cytoLabels[s.id])).join('')}${btn(STEPS.length, 'สรุป', 'sum')}</div></div>
    </div>`;
  }

  matchCard() {
    const top = matchCells(this.state).slice(0, 3);
    const best = top[0];
    return `<div class="match">
      <p class="eyebrow">เซลล์ในแบบจำลองตอนนี้ใกล้เคียงกับ</p>
      <button class="match-best" data-atlas="${best.id}"><b>${byId[best.id].th}</b><span>${best.score}/${best.total} ลักษณะตรงกัน · ดูใน Atlas →</span></button>
      <p class="muted">รองลงมา: ${top.slice(1).map((m) => `${byId[m.id].th} (${m.score})`).join(', ')}</p>
    </div>`;
  }

  renderLearn() {
    let body;
    if (this.isSummary) {
      body = `
        <p class="eyebrow">สรุป · บันทึกลักษณะเซลล์</p>
        <h2>อ่านเซลล์ครบทุกหลัก</h2>
        <p class="lead">นักเทคนิคการแพทย์บรรยายเซลล์ตามลำดับนี้ทุกครั้ง แล้วจึงสรุปชื่อเซลล์ เพื่อไม่ให้ข้ามลักษณะสำคัญ ด้านล่างคือรายงานของเซลล์ที่คุณประกอบไว้</p>
        <table class="tally report"><tbody>${Object.keys(ATTRS).map((k) => `<tr><th>${ATTRS[k].th}</th><td>${optTh(k, this.state[k])}</td></tr>`).join('')}</tbody></table>
        ${this.matchCard()}
        <div class="row"><button class="btn primary" data-tab="drill">ไปฝึกอ่านเซลล์จริง →</button><button class="btn ghost" data-reset>เริ่มจากเซลล์ตัวอย่างใหม่</button></div>`;
    } else {
      const st = this.cur;
      const readout = st.id === 'size' ? `<p class="readout">เส้นผ่านศูนย์กลาง <b>${diameterUm(this.cell)} µm</b> · ประมาณ <b>${(diameterUm(this.cell) / 7.5).toFixed(1)}×</b> ของ RBC</p>`
        : st.id === 'nc' ? `<p class="readout">นิวเคลียสกินพื้นที่ <b>${ncPercent(this.cell)}%</b> ของเซลล์เมื่อมองจากด้านบน</p>` : '';
      body = `
        <p class="eyebrow">${st.no ? `หลักข้อ ${st.no} จาก 5` : 'ลักษณะของไซโทพลาซึม'}</p>
        <h2>${st.th}</h2>
        <p class="en">${st.en}</p>
        <p class="lead">${st.lead}</p>
        <div class="try"><p class="try-h">ลองปรับในแบบจำลอง</p>${st.controls.map((k) => chipRow(k, this.state[k], 'learn')).join('')}${readout}</div>
        <h3>สิ่งที่ควรสังเกต</h3>
        <ul class="keys">${st.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
        <h3>ดูตัวอย่างในเซลล์จริง</h3>
        <div class="chips">${st.examples.map((id) => `<button class="chip" data-atlas="${id}">${byId[id].th}</button>`).join('')}</div>
        ${this.matchCard()}
        <div class="row">
          <button class="btn ghost" data-step="${this.step - 1}" ${this.step === 0 ? 'disabled' : ''}>← ก่อนหน้า</button>
          <button class="btn primary" data-step="${this.step + 1}">${this.step === STEPS.length - 1 ? 'สรุป' : 'หลักถัดไป'} →</button>
        </div>`;
    }
    this.panel.innerHTML = `${this.tabs()}${this.renderNav()}${body}
      <p class="credit">กรอบแนวคิด: Shiro Miwa, <i>Atlas of Blood Cells</i></p>`;
  }

  // ---------- Drill

  newDrill() {
    const pool = DRILL_CELLS.filter((id) => id !== this.drill?.id);
    const id = pool[Math.floor(Math.random() * pool.length)];
    this.drill = { id, answers: {}, checked: false, options: null, picked: null };
    this.viewer.setCell(id, 1 + Math.floor(Math.random() * 999));
    this.viewer.setLabels(false);
    this.renderDrill();
    this.panel.closest('.panel').scrollTop = 0;
  }

  checkDrill() {
    const d = this.drill, truth = MORPH[d.id];
    d.checked = true;
    this.stats.cells++;
    DRILL_ROWS.forEach((k) => {
      const r = (this.stats.rows[k] ||= { ok: 0, n: 0 });
      r.n++;
      if (d.answers[k] === truth[k]) r.ok++;
    });
    d.options = shuffle([d.id, ...shuffle(DRILL_CELLS.filter((x) => x !== d.id)).slice(0, 3)]);
    this.save();
    this.renderDrill();
  }

  identify(id) {
    const d = this.drill;
    if (d.picked) return;
    d.picked = id;
    if (id === d.id) this.stats.ids++;
    this.save();
    this.viewer.setLabels(true);
    this.renderDrill();
  }

  save() {
    try { localStorage.setItem('hv:basicsStats', JSON.stringify(this.stats)); } catch (e) { /* ignore */ }
  }

  weakest() {
    const rows = Object.entries(this.stats.rows).filter(([, r]) => r.n >= 2).map(([k, r]) => ({ k, pct: r.ok / r.n }));
    rows.sort((a, b) => a.pct - b.pct);
    return rows[0] && rows[0].pct < 0.8 ? rows[0] : null;
  }

  renderDrill() {
    const d = this.drill, truth = MORPH[d.id];
    const done = DRILL_ROWS.filter((k) => d.answers[k]).length;
    const right = DRILL_ROWS.filter((k) => d.answers[k] === truth[k]).length;
    const weak = this.weakest();
    const totalRows = Object.values(this.stats.rows).reduce((s, r) => s + r.n, 0);
    const okRows = Object.values(this.stats.rows).reduce((s, r) => s + r.ok, 0);
    const rows = DRILL_ROWS.map((k, i) => {
      let mark = '';
      if (d.checked) mark = d.answers[k] === truth[k] ? '<em class="ok">✓</em>' : `<em class="bad">✗ ที่ถูกคือ ${optTh(k, truth[k])}</em>`;
      return `<div class="ws-row ${d.checked ? (d.answers[k] === truth[k] ? 'is-ok' : 'is-bad') : ''}">
        <span class="ws-n">${i + 1}</span>${chipRow(k, d.answers[k], 'drill')}${mark}</div>`;
    }).join('');
    this.panel.innerHTML = `${this.tabs()}
      <p class="eyebrow">ฝึกอ่านเซลล์ · ใบบันทึกลักษณะ</p>
      <h2>บรรยายเซลล์นี้ทีละหลัก</h2>
      <p class="muted">หมุนดูเซลล์ในกล้อง (ลองเปิดมุมกล้องจุลทรรศน์ด้านล่าง) เลือกลักษณะให้ครบ 9 ข้อ แล้วกดตรวจ จากนั้นจึงระบุชื่อเซลล์</p>
      <div class="scorebar">
        <div><small>เซลล์ที่ฝึก</small><b>${this.stats.cells}</b></div>
        <div><small>บรรยายถูก</small><b>${totalRows ? Math.round((okRows / totalRows) * 100) : 0}%</b></div>
        <div><small>ระบุชื่อถูก</small><b>${this.stats.ids}</b></div>
      </div>
      ${weak ? `<p class="tip"><b>ควรทบทวน</b> ${ATTRS[weak.k].th} ตอบถูก ${Math.round(weak.pct * 100)}% <button class="linkish" data-review="${ROW_STEP[weak.k]}">เปิดบทเรียน →</button></p>` : ''}
      <div class="worksheet">${rows}</div>
      ${!d.checked ? `<button class="btn primary" data-check ${done < DRILL_ROWS.length ? 'disabled' : ''}>ตรวจคำบรรยาย (${done}/${DRILL_ROWS.length})</button>` : `
        <p class="readout">บรรยายถูก <b>${right}/${DRILL_ROWS.length}</b> ข้อ</p>
        <h3>จากลักษณะทั้งหมด เซลล์นี้คืออะไร?</h3>
        <div class="options">${d.options.map((id, i) => {
          let cls = '';
          if (d.picked) cls = id === d.id ? 'right' : id === d.picked ? 'wrong' : 'dim';
          return `<button class="opt ${cls}" data-pick="${id}" ${d.picked ? 'disabled' : ''}><kbd>${i + 1}</kbd><span>${byId[id].th}<small>${byId[id].en}</small></span></button>`;
        }).join('')}</div>
        ${d.picked ? `<div class="feedback ${d.picked === d.id ? 'ok' : 'bad'}"><b>${d.picked === d.id ? 'ถูกต้อง' : `คำตอบคือ ${byId[d.id].th}`}</b>
          <p>${byId[d.id].th}: ${DRILL_ROWS.map((k) => `${ATTRS[k].th}${optTh(k, truth[k])}`).join(' · ')}</p></div>
          <div class="row"><button class="btn primary" data-next>เซลล์ถัดไป →</button><button class="btn ghost" data-atlas="${d.id}">เปิดใน Atlas</button></div>` : ''}`}
      <p class="credit">กรอบแนวคิด: Shiro Miwa, <i>Atlas of Blood Cells</i></p>`;
  }

  // ---------- Shared

  tabs() {
    return `<div class="seg two" role="tablist" aria-label="รูปแบบการเรียน">
      <button role="tab" data-tab="learn" aria-selected="${this.tab === 'learn'}"><b>เรียนรู้ทีละหลัก</b><small>ประกอบเซลล์ 3 มิติ</small></button>
      <button role="tab" data-tab="drill" aria-selected="${this.tab === 'drill'}"><b>ฝึกอ่านเซลล์</b><small>ใบบันทึก 9 ข้อ</small></button>
    </div>`;
  }

  setTab(tab) {
    this.tab = tab;
    if (tab === 'learn') {
      this.viewer.setStain(false);
      this.viewer.setLabels(true);
      this.rebuild(false);
      this.renderLearn();
    } else {
      this.newDrill();
    }
    this.renderHud();
  }

  renderHud() {
    if (this.tab === 'learn') {
      const title = this.isSummary ? 'สรุป' : `${this.cur.no ? this.cur.no + '. ' : ''}${this.cur.th}`;
      this.hud.innerHTML = `
        <button class="btn" data-hstep="${this.step - 1}" ${this.step === 0 ? 'disabled' : ''} aria-label="หลักก่อนหน้า">←</button>
        <span class="hud-title">${title}</span>
        <button class="btn" data-hstep="${this.step + 1}" ${this.isSummary ? 'disabled' : ''} aria-label="หลักถัดไป">→</button>`;
    } else {
      this.hud.innerHTML = `<button class="btn tool" data-hstain aria-pressed="${this.viewer.stain}">มุมกล้องจุลทรรศน์</button>
        <button class="btn tool" data-hrot aria-pressed="${this.viewer.autoRotate}">หมุนอัตโนมัติ</button>`;
    }
    this.hud.querySelectorAll('[data-hstep]').forEach((b) => b.addEventListener('click', () => this.goStep(+b.dataset.hstep)));
    this.hud.querySelector('[data-hstain]')?.addEventListener('click', () => { this.viewer.setStain(!this.viewer.stain); this.renderHud(); });
    this.hud.querySelector('[data-hrot]')?.addEventListener('click', () => { this.viewer.autoRotate = !this.viewer.autoRotate; this.renderHud(); });
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const ds = b.dataset;
    if (ds.tab) return this.setTab(ds.tab);
    if (ds.step !== undefined) return this.goStep(+ds.step);
    if (ds.atlas) return this.ui.goto('atlas', ds.atlas);
    if (ds.attr) {
      if (ds.name === 'learn') {
        this.state[ds.attr] = ds.val;
        this.rebuild(true);
        this.renderLearn();
      } else if (!this.drill.checked) {
        this.drill.answers[ds.attr] = ds.val;
        this.renderDrill();
      }
      return;
    }
    if ('reset' in ds) { this.state = { ...DEFAULT_STATE }; this.rebuild(false); this.goStep(0); return; }
    if ('check' in ds) return this.checkDrill();
    if (ds.pick) return this.identify(ds.pick);
    if ('next' in ds) return this.newDrill();
    if (ds.review) {
      this.tab = 'learn';
      this.viewer.setStain(false);
      this.viewer.setLabels(true);
      this.rebuild(false);
      this.goStep(STEPS.findIndex((s) => s.id === ds.review));
    }
  }

  key(e) {
    if (this.tab === 'learn') {
      if (e.key === 'ArrowRight') this.goStep(this.step + 1);
      if (e.key === 'ArrowLeft') this.goStep(this.step - 1);
    } else if (this.drill?.checked && !this.drill.picked && ['1', '2', '3', '4'].includes(e.key)) {
      this.identify(this.drill.options[+e.key - 1]);
    }
  }

  enter() {
    const v = this.viewer;
    v.controls.enabled = true;
    v.autoRotate = true;
    v.setCompare(false);
    v.setSlice(0);
    this.setTab(this.tab);
  }

  exit() {
    this.viewer.controls.enabled = false;
    this.viewer.setStain(false);
    this.viewer.labelLayer.hidden = true;
  }

  update(dt) {
    this.time += dt;
    if (this.tab === 'learn' && this.cell && this.viewer.current?.group === this.cell.group) pulse(this.cell, this.time);
    this.viewer.update(dt);
  }

  view() { return { scene: this.viewer.scene, camera: this.viewer.camera }; }
}
