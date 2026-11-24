import { SmearField } from '../smear.js';
import { DIFF_CLASSES, DIFF_SAMPLES, byId } from '../data.js';

const GOALS = [50, 100];

export class DiffMode {
  constructor(ui) {
    this.ui = ui;
    this.field = new SmearField();
    this.panel = document.getElementById('diffPanel');
    this.hud = document.getElementById('diffHud');
    this.pop = document.getElementById('classPop');
    this.badges = document.getElementById('badges');
    this.sample = DIFF_SAMPLES[0];
    this.goal = 50;
    this.pop.innerHTML = DIFF_CLASSES.map((c) => `<button data-c="${c.id}"><kbd>${c.key}</kbd>${c.th}</button>`).join('');
    this.pop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) this.classify(b.dataset.c);
    });
    this.reset();
  }

  reset() {
    this.counts = Object.fromEntries(DIFF_CLASSES.map((c) => [c.id, 0]));
    this.truth = Object.fromEntries(DIFF_CLASSES.map((c) => [c.id, 0]));
    this.correct = 0;
    this.total = 0;
    this.fieldNo = 0;
    this.seed = Math.floor(Math.random() * 1e6);
    this.done = false;
    this.marks = [];
  }

  newField() {
    this.fieldNo++;
    this.seed++;
    this.field.build({ wbc: this.sample.wbc, wbcPerField: [1, 4], plt: [6, 12], rbc: { normal: 1 } }, this.seed);
    this.marks = [];
    this.badges.replaceChildren();
    this.selected = null;
    this.pop.hidden = true;
    this.renderHud();
  }

  get pending() {
    return this.field.cells.filter((c) => c.kind === 'wbc' && !this.marks.find((m) => m.rec === c));
  }

  select(rec, px) {
    this.selected = rec;
    this.field.clearMarkers();
    this.marks.forEach((m) => this.field.ring(m.rec, m.ok ? '#1f9d6b' : '#d6455d', 0.35));
    this.field.ring(rec, '#1f63b4', 0.6);
    const s = this.ui.stage.getBoundingClientRect();
    const x = Math.min(px.x + 14, s.width - 190), y = Math.min(px.y - 10, s.height - 250);
    this.pop.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    this.pop.hidden = false;
  }

  classify(cls) {
    const rec = this.selected;
    if (!rec || this.done) return;
    const truth = rec.id;
    const ok = truth === cls;
    this.counts[cls]++;
    this.truth[truth] = (this.truth[truth] || 0) + 1;
    this.total++;
    if (ok) this.correct++;
    const badge = document.createElement('div');
    badge.className = 'badge ' + (ok ? 'ok' : 'bad');
    badge.textContent = ok ? `✓ ${DIFF_CLASSES.find((c) => c.id === cls).th}` : `✗ ${byId[truth].en.split(' (')[0]}`;
    this.badges.appendChild(badge);
    this.marks.push({ rec, ok, badge });
    this.selected = null;
    this.pop.hidden = true;
    this.field.clearMarkers();
    this.marks.forEach((m) => this.field.ring(m.rec, m.ok ? '#1f9d6b' : '#d6455d', 0.35));
    if (this.total >= this.goal) {
      this.done = true;
      this.renderResult();
    } else {
      this.renderPanel();
      if (!this.pending.length) this.ui.toast('นับครบทุกเซลล์ในฟิลด์นี้แล้ว เลื่อนสไลด์ไปฟิลด์ถัดไปได้เลย');
    }
    this.renderHud();
  }

  renderHud() {
    const left = this.pending.length;
    this.hud.innerHTML = `
      <div class="fieldchip"><small>ฟิลด์</small><b>${this.fieldNo}</b></div>
      <div class="fieldchip"><small>WBC ในฟิลด์นี้ที่ยังไม่นับ</small><b>${left}</b></div>
      <button class="btn primary" id="dNext">เลื่อนสไลด์ →</button>`;
    this.hud.querySelector('#dNext').addEventListener('click', () => {
      if (this.done) return;
      if (this.pending.length) this.ui.toast(`ข้าม ${this.pending.length} เซลล์ที่ยังไม่นับในฟิลด์นี้`, 'warn');
      this.newField();
    });
  }

  renderPanel() {
    const pct = (n) => (this.total ? ((n / this.total) * 100).toFixed(0) : '0');
    this.panel.innerHTML = `
      <p class="eyebrow">Manual differential count</p>
      <h2>นับแยกชนิดเม็ดเลือดขาว</h2>
      <p class="muted">คลิกเม็ดเลือดขาวในกล้อง แล้วเลือกชนิดหรือกดแป้นตัวเลข เหมือนใช้เครื่องนับเซลล์ในห้องแล็บ</p>
      <label class="field-label" for="dSample">ตัวอย่างเลือด</label>
      <select id="dSample">${DIFF_SAMPLES.map((s) => `<option value="${s.id}" ${s.id === this.sample.id ? 'selected' : ''}>${s.th}</option>`).join('')}</select>
      <label class="field-label" for="dGoal">จำนวนที่ต้องนับ</label>
      <select id="dGoal">${GOALS.map((g) => `<option value="${g}" ${g === this.goal ? 'selected' : ''}>${g} เซลล์</option>`).join('')}</select>
      <div class="progress big"><i style="width:${(this.total / this.goal) * 100}%"></i></div>
      <p class="count-line"><b>${this.total}</b> / ${this.goal} เซลล์ · ความแม่นยำ <b>${this.total ? Math.round((this.correct / this.total) * 100) : 0}%</b></p>
      <table class="tally">
        <thead><tr><th>ปุ่ม</th><th>ชนิด</th><th class="num">นับ</th><th class="num">%</th></tr></thead>
        <tbody>${DIFF_CLASSES.map((c) => `<tr><td><kbd>${c.key}</kbd></td><td>${c.th}</td><td class="num">${this.counts[c.id]}</td><td class="num">${pct(this.counts[c.id])}</td></tr>`).join('')}</tbody>
      </table>
      <p class="tip"><b>เทคนิคในแล็บ</b> นับบริเวณ monolayer ที่เม็ดเลือดแดงเรียงชิดกันแต่ไม่ซ้อน และเลื่อนสไลด์แบบ battlement (ซิกแซกแบบกำแพงปราสาท) เพื่อไม่ให้นับเซลล์ซ้ำ</p>
      <button class="btn ghost" id="dRestart">เริ่มนับใหม่</button>`;
    this.panel.querySelector('#dSample').addEventListener('change', (e) => {
      this.sample = DIFF_SAMPLES.find((s) => s.id === e.target.value);
      this.restart();
    });
    this.panel.querySelector('#dGoal').addEventListener('change', (e) => { this.goal = +e.target.value; this.restart(); });
    this.panel.querySelector('#dRestart').addEventListener('click', () => this.restart());
  }

  renderResult() {
    const row = (c) => {
      const u = (this.counts[c.id] / this.total) * 100;
      const t = ((this.truth[c.id] || 0) / this.total) * 100;
      if (!u && !t) return '';
      const diff = Math.abs(u - t);
      return `<tr><td>${c.th}</td><td class="num">${u.toFixed(0)}%</td><td class="num">${t.toFixed(0)}%</td><td class="num ${diff > 5 ? 'bad' : 'ok'}">${diff < 0.5 ? '0' : (u > t ? '+' : '−') + diff.toFixed(0)}</td></tr>`;
    };
    const acc = Math.round((this.correct / this.total) * 100);
    this.panel.innerHTML = `
      <p class="eyebrow">ผลการนับ · ${this.sample.th}</p>
      <h2>ความแม่นยำ ${acc}%</h2>
      <p class="lead">${acc >= 95 ? 'แม่นยำระดับผ่าน proficiency testing' : acc >= 80 ? 'ดีมาก ทบทวนเซลล์ที่แยกผิดอีกเล็กน้อย' : 'ลองกลับไปดูลักษณะเซลล์ใน Atlas แล้วนับใหม่'}</p>
      <table class="tally">
        <thead><tr><th>ชนิด</th><th class="num">คุณนับ</th><th class="num">จริง</th><th class="num">ต่าง</th></tr></thead>
        <tbody>${DIFF_CLASSES.map(row).join('')}</tbody>
      </table>
      <p class="tip"><b>แปลผล</b> ${this.sample.note}</p>
      <p class="muted">ในงานจริง ผลนับ 100 เซลล์มีความคลาดเคลื่อนทางสถิติได้หลายเปอร์เซ็นต์ โดยเฉพาะเซลล์ที่พบน้อย จึงต้องแปลผลเป็นจำนวนสัมบูรณ์ (absolute count) ร่วมด้วยเสมอ</p>
      <button class="btn primary" id="dRestart">นับตัวอย่างใหม่</button>`;
    this.panel.querySelector('#dRestart').addEventListener('click', () => this.restart());
  }

  restart() {
    this.reset();
    this.renderPanel();
    this.newField();
  }

  click(ndc, e, px) {
    if (this.done) return;
    const rec = this.field.pick(ndc);
    if (!rec) { this.pop.hidden = true; return; }
    if (rec.kind !== 'wbc') {
      this.ui.toast(rec.kind === 'plt' ? 'นั่นคือเกล็ดเลือด ให้นับเฉพาะเม็ดเลือดขาว' : 'นั่นคือเม็ดเลือดแดง ให้นับเฉพาะเม็ดเลือดขาว');
      return;
    }
    if (this.marks.find((m) => m.rec === rec)) { this.ui.toast('เซลล์นี้นับไปแล้ว'); return; }
    this.select(rec, px);
  }

  key(e) {
    const c = DIFF_CLASSES.find((d) => d.key === e.key);
    if (c && this.selected) this.classify(c.id);
    if (e.key === 'Escape') { this.pop.hidden = true; this.selected = null; }
  }

  enter() {
    this.badges.replaceChildren();
    if (!this.fieldNo) this.restart();
    else {
      if (this.done) this.renderResult(); else this.renderPanel();
      this.marks.forEach((m) => this.badges.appendChild(m.badge));
      this.renderHud();
    }
  }

  exit() {
    this.pop.hidden = true;
    this.badges.replaceChildren();
  }

  resize(w, h) { this.field.resize(w, h); }

  update() {
    const k = this.field.pxPerUm;
    for (const m of this.marks) {
      const p = this.field.toScreen(m.rec);
      m.badge.style.transform = `translate(${(p.x + m.rec.r * k * 0.6).toFixed(1)}px, ${(p.y - m.rec.r * k * 0.9).toFixed(1)}px)`;
    }
  }

  view() { return { scene: this.field.scene, camera: this.field.camera }; }
}
