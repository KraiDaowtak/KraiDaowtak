import { CELLS, byId, enOf } from '../data.js';

const LEVELS = {
  basic: { th: 'พื้นฐาน', note: 'เซลล์ปกติ 8 ชนิด', pool: () => CELLS.filter((c) => c.group === 'normal') },
  rbc: { th: 'เม็ดเลือดแดง', note: 'รูปร่างและสิ่งเจือปน', pool: () => CELLS.filter((c) => c.group === 'rbc-shape' || c.group === 'rbc-incl' || c.id === 'rbc') },
  all: { th: 'ทั้งหมด', note: `${CELLS.length} ชนิด`, pool: () => CELLS },
};
const ROUND = 10;

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class QuizMode {
  constructor(viewer, ui) {
    this.viewer = viewer;
    this.ui = ui;
    this.el = document.getElementById('quizPanel');
    this.level = 'basic';
    this.best = {};
    try { this.best = JSON.parse(localStorage.getItem('hv:quizBest') || '{}'); } catch (e) { this.best = {}; }
    this.state = null;
  }

  start(level = this.level) {
    this.level = level;
    const pool = LEVELS[level].pool();
    const order = [];
    while (order.length < ROUND) order.push(...shuffle(pool.slice()));
    this.state = { order: order.slice(0, ROUND), i: 0, score: 0, streak: 0, bestStreak: 0, missed: [], answered: false, hinted: false };
    this.ask();
  }

  ask() {
    const s = this.state;
    const cell = s.order[s.i];
    const pool = LEVELS[this.level].pool();
    // Distractors prefer the same group so the choice is about morphology, not category.
    const same = shuffle(pool.filter((c) => c.id !== cell.id && c.group === cell.group));
    const other = shuffle(CELLS.filter((c) => c.id !== cell.id && c.group !== cell.group));
    s.options = shuffle([cell, ...[...same, ...other].slice(0, 3)]);
    s.answered = false;
    s.hinted = false;
    this.viewer.setLabels(false);
    this.viewer.setCell(cell.id, 1 + Math.floor(Math.random() * 999));
    this.viewer.holder.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * Math.PI * 2, 0);
    this.render();
  }

  answer(idx) {
    const s = this.state;
    if (s.answered) return;
    s.answered = true;
    const cell = s.order[s.i];
    const ok = s.options[idx].id === cell.id;
    s.picked = idx;
    if (ok) {
      s.streak++;
      s.score += s.hinted ? 5 : 10;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else {
      s.streak = 0;
      s.missed.push(cell.id);
    }
    this.viewer.setLabels(true);
    this.render();
  }

  next() {
    const s = this.state;
    s.i++;
    if (s.i >= ROUND) {
      if (!this.best[this.level] || s.score > this.best[this.level]) {
        this.best[this.level] = s.score;
        try { localStorage.setItem('hv:quizBest', JSON.stringify(this.best)); } catch (e) { /* ignore */ }
      }
      this.renderEnd();
      return;
    }
    this.ask();
  }

  renderLevelPicker() {
    return `<div class="seg" role="radiogroup" aria-label="ระดับ">${Object.entries(LEVELS)
      .map(([k, v]) => `<button role="radio" data-level="${k}" aria-checked="${k === this.level}"><b>${v.th}</b><small>${v.note}</small></button>`)
      .join('')}</div>`;
  }

  render() {
    const s = this.state;
    const cell = s.order[s.i];
    const letters = ['1', '2', '3', '4'];
    this.el.innerHTML = `
      <p class="eyebrow">นักสืบสัณฐานวิทยา</p>
      <h2>เซลล์นี้คืออะไร?</h2>
      ${this.renderLevelPicker()}
      <div class="scorebar">
        <div><small>ข้อ</small><b>${s.i + 1}<span>/${ROUND}</span></b></div>
        <div><small>คะแนน</small><b>${s.score}</b></div>
        <div><small>ถูกติดกัน</small><b>${s.streak}</b></div>
      </div>
      <div class="progress"><i style="width:${(s.i / ROUND) * 100}%"></i></div>
      <p class="muted">หมุนและซูมโมเดลเพื่อสังเกต nucleus granule และรูปทรง จากนั้นเลือกคำตอบ (กดปุ่ม 1–4 ได้)</p>
      <div class="options">${s.options.map((o, i) => {
        let cls = '';
        if (s.answered) cls = o.id === cell.id ? 'right' : i === s.picked ? 'wrong' : 'dim';
        return `<button class="opt ${cls}" data-i="${i}" ${s.answered ? 'disabled' : ''}><kbd>${letters[i]}</kbd><span>${o.th}${enOf(o) ? `<small>${enOf(o)}</small>` : ''}</span></button>`;
      }).join('')}</div>
      ${s.answered ? `
        <div class="feedback ${s.options[s.picked].id === cell.id ? 'ok' : 'bad'}">
          <b>${s.options[s.picked].id === cell.id ? 'ถูกต้อง' : `ยังไม่ใช่ คำตอบคือ ${cell.th}`}</b>
          <ul>${cell.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
        </div>
        <div class="row"><button class="btn primary" id="qNext">${s.i + 1 >= ROUND ? 'ดูผลคะแนน' : 'ข้อต่อไป'} →</button>
        <button class="btn ghost" id="qAtlas">เปิดใน Atlas</button></div>`
      : `<button class="btn ghost" id="qHint">ขอคำใบ้: แสดงป้ายกำกับ (ได้ 5 คะแนนแทน 10)</button>`}
    `;
    this.bind();
    this.el.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => this.answer(+b.dataset.i)));
    this.el.querySelector('#qNext')?.addEventListener('click', () => this.next());
    this.el.querySelector('#qAtlas')?.addEventListener('click', () => this.ui.goto('atlas', cell.id));
    this.el.querySelector('#qHint')?.addEventListener('click', () => {
      s.hinted = true;
      this.viewer.setLabels(true);
      this.el.querySelector('#qHint').disabled = true;
    });
  }

  renderEnd() {
    const s = this.state;
    const pct = Math.round((s.score / (ROUND * 10)) * 100);
    const grade = pct >= 90 ? 'ระดับนักเทคนิคการแพทย์มืออาชีพ' : pct >= 70 ? 'ผ่านฉลุย' : pct >= 50 ? 'ใกล้แล้ว ทบทวนอีกนิด' : 'ลองเปิด Atlas ทบทวนก่อนนะ';
    const missed = [...new Set(s.missed)];
    this.el.innerHTML = `
      <p class="eyebrow">สรุปผล · ${LEVELS[this.level].th}</p>
      <h2>${s.score} คะแนน</h2>
      <p class="lead">${grade}</p>
      <div class="scorebar">
        <div><small>ความแม่นยำ</small><b>${pct}%</b></div>
        <div><small>ถูกติดกันสูงสุด</small><b>${s.bestStreak}</b></div>
        <div><small>สถิติสูงสุด</small><b>${this.best[this.level] ?? s.score}</b></div>
      </div>
      ${missed.length ? `<h3>เซลล์ที่ควรทบทวน</h3><div class="chips">${missed.map((id) => `<button class="chip" data-id="${id}">${byId[id].th}</button>`).join('')}</div>` : '<p class="tip"><b>สมบูรณ์แบบ</b> ตอบถูกทุกข้อ ลองระดับที่ยากขึ้นดู</p>'}
      ${this.renderLevelPicker()}
      <div class="row"><button class="btn primary" id="qAgain">เล่นอีกรอบ</button></div>`;
    this.bind();
    this.el.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => this.ui.goto('atlas', b.dataset.id)));
    this.el.querySelector('#qAgain').addEventListener('click', () => this.start());
  }

  bind() {
    this.el.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => this.start(b.dataset.level)));
  }

  key(e) {
    if (!this.state) return;
    if (!this.state.answered && ['1', '2', '3', '4'].includes(e.key)) this.answer(+e.key - 1);
    else if (this.state.answered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (this.state.i < ROUND) this.next();
    }
  }

  enter() {
    const v = this.viewer;
    v.controls.enabled = true;
    v.autoRotate = true;
    v.setStain(false);
    v.setCompare(false);
    v.setSlice(0);
    if (!this.state || this.state.i >= ROUND) this.start();
    else { v.setCell(this.state.order[this.state.i].id, 11); this.render(); v.setLabels(this.state.answered || this.state.hinted); }
  }

  exit() {
    this.viewer.controls.enabled = false;
    this.viewer.labelLayer.hidden = true;
  }

  update(dt) { this.viewer.update(dt); }
  view() { return { scene: this.viewer.scene, camera: this.viewer.camera }; }
}
