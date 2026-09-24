import { SmearField } from '../smear.js';
import { CASES, byId } from '../data.js';

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class CasesMode {
  constructor(ui) {
    this.ui = ui;
    this.field = new SmearField();
    this.panel = document.getElementById('casePanel');
    this.hud = document.getElementById('casesHud');
    this.peek = document.getElementById('peek');
    this.idx = 0;
    this.results = {};
    try { this.results = JSON.parse(localStorage.getItem('hv:cases') || '{}'); } catch (e) { this.results = {}; }
    this.magnifier = false;
    this.hints = 0;
  }

  get case() { return CASES[this.idx]; }

  open(i) {
    this.idx = i;
    this.order = shuffle(this.case.options.map((_, k) => k));
    this.hints = 0;
    this.fieldNo = 0;
    this.seed = 1000 + i * 97;
    this.picked = null;
    this.newField();
    this.renderPanel();
  }

  newField() {
    this.fieldNo++;
    this.seed++;
    this.field.build(this.case.smear, this.seed);
    this.peek.hidden = true;
    if (this.highlight) this.mark(this.highlight);
    this.renderHud();
  }

  mark(id) {
    this.highlight = id;
    this.field.clearMarkers();
    const hits = this.field.cells.filter((c) => c.id === id);
    hits.forEach((c) => this.field.ring(c, '#e0457b', 0.45));
    return hits.length;
  }

  answer(k) {
    if (this.picked !== null) return;
    this.picked = k;
    const ok = k === this.case.answer;
    const score = ok ? Math.max(1, 3 - this.hints) : 0;
    this.results[this.case.id] = { ok, score };
    try { localStorage.setItem('hv:cases', JSON.stringify(this.results)); } catch (e) { /* ignore */ }
    this.renderPanel();
  }

  renderHud() {
    this.hud.innerHTML = `
      <div class="fieldchip"><small>ฟิลด์</small><b>${this.fieldNo}</b></div>
      <button class="btn tool" id="cMag" aria-pressed="${this.magnifier}">แว่นขยาย: คลิกเซลล์เพื่อดูชื่อ</button>
      <button class="btn primary" id="cNext">เลื่อนสไลด์ →</button>`;
    this.hud.querySelector('#cNext').addEventListener('click', () => this.newField());
    this.hud.querySelector('#cMag').addEventListener('click', (e) => {
      this.magnifier = !this.magnifier;
      e.currentTarget.setAttribute('aria-pressed', String(this.magnifier));
      if (!this.magnifier) this.peek.hidden = true;
    });
  }

  renderPanel() {
    const c = this.case;
    const total = Object.values(this.results).reduce((s, r) => s + r.score, 0);
    const answered = this.picked !== null;
    const res = this.results[c.id];
    this.panel.innerHTML = `
      <div class="case-top">
        <p class="eyebrow">เคสคลินิก · คะแนนรวม ${total}/${CASES.length * 3}</p>
        <div class="case-nav" role="tablist" aria-label="เลือกเคส">${CASES.map((k, i) => {
          const r = this.results[k.id];
          return `<button role="tab" data-i="${i}" aria-selected="${i === this.idx}" class="${r ? (r.ok ? 'ok' : 'bad') : ''}" title="${k.title}">${i + 1}</button>`;
        }).join('')}</div>
      </div>
      <h2>${c.title}</h2>
      <p class="lead">${c.story}</p>
      <div class="labs"><small>ผลตรวจทางห้องปฏิบัติการ</small>${c.labs.split(' · ').map((l) => `<span>${l}</span>`).join('')}</div>
      <h3>ดูสไลด์ทางซ้าย แล้วเลือกการวินิจฉัยที่เป็นไปได้มากที่สุด</h3>
      <div class="options">${this.order.map((k, n) => {
        let cls = '';
        if (answered) cls = k === c.answer ? 'right' : k === this.picked ? 'wrong' : 'dim';
        return `<button class="opt ${cls}" data-k="${k}" ${answered ? 'disabled' : ''}><kbd>${n + 1}</kbd><span>${c.options[k]}</span></button>`;
      }).join('')}</div>
      ${!answered && res ? `<p class="muted">เคยทำเคสนี้แล้ว (${res.ok ? 'ถูก' : 'ผิด'}) ตอบใหม่เพื่อทบทวนได้</p>` : ''}
      ${!answered ? `<p class="muted">คะแนน: ตอบถูก 3 คะแนน หักคะแนนละ 1 ทุกครั้งที่ใช้แว่นขยายก่อนตอบ (ใช้ไปแล้ว ${this.hints} ครั้ง)</p>` : `
        <div class="feedback ${this.picked === c.answer ? 'ok' : 'bad'}">
          <b>${this.picked === c.answer ? `ถูกต้อง +${res.score} คะแนน` : `คำตอบคือ ${c.options[c.answer]}`}</b>
          <p>${c.explain}</p>
        </div>
        <h3>ลักษณะสำคัญบนสไลด์นี้ (คลิกเพื่อไฮไลต์ในกล้อง)</h3>
        <div class="chips">${c.findings.map((id) => `<button class="chip" data-f="${id}" aria-pressed="${this.highlight === id}">${byId[id].th}</button>`).join('')}</div>
        <div class="row">
          ${this.idx < CASES.length - 1 ? '<button class="btn primary" id="cNextCase">เคสถัดไป →</button>' : ''}
          <button class="btn ghost" id="cAtlas">ดูเซลล์ใน Atlas 3D</button>
        </div>`}`;
    this.panel.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { this.highlight = null; this.open(+b.dataset.i); }));
    this.panel.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => this.answer(+b.dataset.k)));
    this.panel.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      const n = this.mark(b.dataset.f);
      this.panel.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.ui.toast(n ? `พบ ${byId[b.dataset.f].th} ${n} เซลล์ในฟิลด์นี้` : 'ฟิลด์นี้ไม่มีเซลล์ชนิดนี้ ลองเลื่อนสไลด์');
    }));
    this.panel.querySelector('#cNextCase')?.addEventListener('click', () => { this.highlight = null; this.open(this.idx + 1); });
    this.panel.querySelector('#cAtlas')?.addEventListener('click', () => this.ui.goto('atlas', c.findings[0]));
  }

  click(ndc, e, px) {
    if (!this.magnifier) {
      this.ui.toast('เปิด "แว่นขยาย" ด้านล่างเพื่อคลิกดูชื่อเซลล์');
      return;
    }
    const rec = this.field.pick(ndc);
    if (!rec) { this.peek.hidden = true; return; }
    if (this.picked === null) {
      this.hints++;
      this.renderPanel();
    }
    const cell = byId[rec.id] || byId.rbc;
    this.peek.innerHTML = `<b>${cell.th}</b><small>${cell.en}</small>`;
    this.peek.style.transform = `translate(${px.x + 12}px, ${px.y + 12}px)`;
    this.peek.hidden = false;
  }

  key(e) {
    if (this.picked === null && ['1', '2', '3', '4'].includes(e.key)) this.answer(this.order[+e.key - 1]);
  }

  enter() {
    if (this.order) { this.renderPanel(); this.renderHud(); }
    else this.open(0);
  }

  exit() { this.peek.hidden = true; }
  resize(w, h) { this.field.resize(w, h); }
  update() {}
  view() { return { scene: this.field.scene, camera: this.field.camera }; }
}
