// Real microscope photographs beside the 3D model.
// Two sources: (1) photos/manifest.json in the repository (static hosting), and
// (2) on claude.ai, photos teachers upload from the page (assets + db capabilities).
import { byId } from './data.js';

const ASSET_ID = /^[A-Za-z0-9_-]{16,64}$/;
const REPO_SRC = /^photos\/[\w\-./]+\.(jpe?g|png|webp|gif)$/i;
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

export class RealPhotos {
  constructor(ui) {
    this.ui = ui;
    this.card = document.getElementById('photoCard');
    this.box = document.getElementById('photoBox');
    this.repo = {};
    this.shared = {};
    this.cell = 'neutrophil';
    this.idx = 0;
    this.collapsed = false;
    this.adding = false;
    this.busy = false;
    this.confirmDelete = null;
    try { this.collapsed = localStorage.getItem('hv:photosCollapsed') === '1'; } catch (e) { /* ignore */ }
    this.card.addEventListener('click', (e) => this.onClick(e));
    this.card.addEventListener('submit', (e) => { e.preventDefault(); this.upload(); });
    this.box.addEventListener('click', (e) => { if (e.target === this.box || e.target.closest('[data-close]')) this.box.hidden = true; });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.box.hidden = true; });
    this.render();
    this.loadRepo();
    this.connect();
  }

  async loadRepo() {
    try {
      const r = await fetch('photos/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      const json = await r.json();
      for (const [cell, list] of Object.entries(json || {})) {
        if (!byId[cell] || !Array.isArray(list)) continue;
        this.repo[cell] = list.filter((p) => p && REPO_SRC.test(p.src || '') && !p.src.includes('..'))
          .map((p) => ({ src: p.src, caption: clip(p.caption, 200), credit: clip(p.credit, 120) }));
      }
      this.render();
    } catch (e) { /* no manifest: nothing to show */ }
  }

  async connect() {
    const claude = window.claude;
    if (!claude?.use) return;
    const [db, assets] = await Promise.all([claude.use('db'), claude.use('assets')]);
    this.db = db;
    this.assets = assets; // non-null only for people who can edit the artifact
    if (!db) { this.render(); return; }
    this.loading = true;
    const timer = setTimeout(() => { this.loading = false; this.stale = true; this.render(); }, 10000);
    db.collection('photos').orderBy('createdAt').onSnapshot((snap) => {
      clearTimeout(timer);
      this.loading = false;
      if (!snap.metadata.fromCache) this.stale = false;
      const next = {};
      snap.docs.forEach((d) => {
        const v = d.data() || {};
        if (!byId[v.cell] || !ASSET_ID.test(v.asset || '')) return;
        (next[v.cell] ||= []).push({ docId: d.id, asset: v.asset, src: '/_blob/' + v.asset, caption: clip(v.caption, 200), credit: clip(v.credit, 120) });
      });
      this.shared = next;
      this.render();
    }, () => { clearTimeout(timer); this.loading = false; this.render(); });
    this.render();
  }

  get list() { return [...(this.shared[this.cell] || []), ...(this.repo[this.cell] || [])]; }

  show(cell) {
    this.cell = cell;
    this.idx = 0;
    this.adding = false;
    this.confirmDelete = null;
    this.render();
  }

  render() {
    const list = this.list;
    if (this.idx >= list.length) this.idx = Math.max(0, list.length - 1);
    const p = list[this.idx];
    const cellTh = byId[this.cell]?.th || '';
    const canAdd = !!this.assets && !!this.db;
    this.card.classList.toggle('collapsed', this.collapsed);
    if (this.collapsed) {
      this.card.innerHTML = `<button class="pc-pill" data-expand>ภาพจริง <b>${list.length}</b></button>`;
      return;
    }
    let body;
    if (p) {
      body = `
        <figure class="pc-fig">
          <button class="pc-img" data-zoom aria-label="ขยายภาพ"><img alt="" src="${p.src}"></button>
          <figcaption><span class="pc-cap"></span><small class="pc-credit"></small></figcaption>
        </figure>
        ${list.length > 1 ? `<div class="pc-nav"><button class="btn" data-prev aria-label="ภาพก่อนหน้า">←</button><span>${this.idx + 1} / ${list.length}</span><button class="btn" data-next aria-label="ภาพถัดไป">→</button></div>` : ''}
        ${canAdd && p.docId ? `<button class="linkish danger" data-del="${p.docId}">${this.confirmDelete === p.docId ? 'กดอีกครั้งเพื่อยืนยันการลบ' : 'ลบภาพนี้'}</button>` : ''}`;
    } else {
      body = `<div class="pc-empty"><p>ยังไม่มีภาพจริงของ<br><b></b></p><small>${canAdd ? 'เพิ่มภาพจากกล้องจุลทรรศน์ได้ที่ปุ่มด้านล่าง' : this.db ? 'อาจารย์ผู้ดูแลจะเพิ่มภาพให้' : 'เพิ่มไฟล์ไว้ในโฟลเดอร์ photos/ และระบุใน photos/manifest.json'}</small></div>`;
    }
    const form = canAdd ? (this.adding ? `
      <form class="pc-form">
        <label for="pcFile">ไฟล์ภาพ (JPG, PNG, WebP ไม่เกิน 20 MB)</label>
        <input id="pcFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required>
        <label for="pcCaption">คำอธิบายภาพ</label>
        <input id="pcCaption" type="text" maxlength="200" placeholder="เช่น นิวเคลียส 4 lobe แกรนูลละเอียด">
        <label for="pcCredit">ที่มา / การย้อม / กำลังขยาย</label>
        <input id="pcCredit" type="text" maxlength="120" placeholder="เช่น Wright stain, 100× oil, อ.สมชาย">
        <div class="row"><button class="btn primary" type="submit" ${this.busy ? 'disabled' : ''}>${this.busy ? 'กำลังอัปโหลด…' : 'อัปโหลด'}</button><button class="btn ghost" type="button" data-cancel>ยกเลิก</button></div>
      </form>` : `<button class="btn pc-add" data-add>+ เพิ่มภาพจริงของ${cellTh}</button>`) : '';
    this.card.innerHTML = `
      <div class="pc-head"><p>ภาพจริงจากกล้องจุลทรรศน์${this.loading ? ' <small>กำลังโหลด…</small>' : this.stale ? ' <small>อาจยังไม่อัปเดต</small>' : ''}</p>
        <button class="pc-min" data-collapse aria-label="ย่อกล่องภาพจริง">–</button></div>
      ${body}${form}`;
    // Teacher-entered text goes in as text, never markup.
    if (p) {
      this.card.querySelector('.pc-cap').textContent = p.caption || cellTh;
      this.card.querySelector('.pc-credit').textContent = p.credit || '';
      this.card.querySelector('img').alt = p.caption || `ภาพจริงของ${cellTh}`;
    } else {
      this.card.querySelector('.pc-empty b').textContent = cellTh;
    }
  }

  async upload() {
    const file = this.card.querySelector('#pcFile')?.files?.[0];
    if (!file || this.busy) return;
    const caption = this.card.querySelector('#pcCaption').value.trim();
    const credit = this.card.querySelector('#pcCredit').value.trim();
    this.busy = true;
    this.render();
    const cell = this.cell;
    try {
      const res = await this.assets.upload(file);
      await this.db.collection('photos').add({ cell, asset: res.id, caption, credit, createdAt: Date.now() });
      this.adding = false;
      this.ui.toast('เพิ่มภาพแล้ว ทุกคนที่เปิดหน้านี้จะเห็นภาพนี้', 'ok');
    } catch (e) {
      const msg = {
        too_large: 'ไฟล์ใหญ่เกิน 20 MB ลองย่อขนาดภาพก่อน',
        unsupported_type: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF',
        quota_or_state: 'พื้นที่เก็บภาพเต็มแล้ว ลองลบภาพที่ไม่ใช้ก่อน',
        quota_exceeded: 'พื้นที่เก็บข้อมูลเต็มแล้ว ลองลบภาพที่ไม่ใช้ก่อน',
        rate_limited: 'อัปโหลดถี่เกินไป รอสักครู่แล้วลองใหม่',
      }[e?.code] || 'อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง';
      this.ui.toast(msg, 'warn');
    }
    this.busy = false;
    this.idx = 0;
    this.render();
  }

  async remove(docId) {
    const p = (this.shared[this.cell] || []).find((x) => x.docId === docId);
    if (!p) return;
    try {
      await this.db.doc('photos/' + docId).delete();
      await this.assets.delete(p.asset).catch(() => {});
      this.ui.toast('ลบภาพแล้ว');
    } catch (e) {
      this.ui.toast('ลบภาพไม่สำเร็จ ลองใหม่อีกครั้ง', 'warn');
    }
    this.confirmDelete = null;
  }

  zoom() {
    const p = this.list[this.idx];
    if (!p) return;
    this.box.innerHTML = `<figure><img alt=""><figcaption><b></b><small></small></figcaption></figure><button class="btn" data-close>ปิด</button>`;
    const img = this.box.querySelector('img');
    img.src = p.src;
    img.alt = p.caption || '';
    this.box.querySelector('figcaption b').textContent = `${byId[this.cell].th}${p.caption ? ' · ' + p.caption : ''}`;
    this.box.querySelector('figcaption small').textContent = p.credit || '';
    this.box.hidden = false;
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    const n = this.list.length;
    if ('collapse' in ds || 'expand' in ds) {
      this.collapsed = 'collapse' in ds;
      try { localStorage.setItem('hv:photosCollapsed', this.collapsed ? '1' : '0'); } catch (err) { /* ignore */ }
    } else if ('prev' in ds) this.idx = (this.idx - 1 + n) % n;
    else if ('next' in ds) this.idx = (this.idx + 1) % n;
    else if ('zoom' in ds) return this.zoom();
    else if ('add' in ds) this.adding = true;
    else if ('cancel' in ds) this.adding = false;
    else if (ds.del) {
      if (this.confirmDelete === ds.del) return this.remove(ds.del);
      this.confirmDelete = ds.del;
    } else return;
    this.render();
  }
}
