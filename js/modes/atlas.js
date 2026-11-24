import { CELLS, GROUPS, byId } from '../data.js';

const RBC_UM = 7.8;

export function sizeBar(cell) {
  // Relative size against a normal RBC, drawn to scale (max 20 µm).
  const pct = (um) => Math.min(100, (um / 20) * 100).toFixed(1);
  return `
    <div class="sizebar" aria-label="เทียบขนาดกับเม็ดเลือดแดง">
      <div class="sb-row"><span>เซลล์นี้</span><i style="width:${pct(cell.um)}%" class="sb-cell"></i><b>${cell.size}</b></div>
      <div class="sb-row"><span>RBC ปกติ</span><i style="width:${pct(RBC_UM)}%" class="sb-rbc"></i><b>7–8 µm</b></div>
      <div class="sb-axis"><span>0</span><span>5</span><span>10</span><span>15</span><span>20 µm</span></div>
    </div>`;
}

export function cellCard(cell) {
  return `
    <p class="eyebrow">${GROUPS.find((g) => g.id === cell.group).th}</p>
    <h2>${cell.th}</h2>
    <p class="en">${cell.en}</p>
    ${sizeBar(cell)}
    <p class="lead">${cell.desc}</p>
    <h3>ลักษณะสำคัญที่ต้องจำ</h3>
    <ul class="keys">${cell.keys.map((k) => `<li>${k}</li>`).join('')}</ul>
    <h3>ความสำคัญทางคลินิก</h3>
    <p>${cell.clinic}</p>
    ${cell.tip ? `<p class="tip"><b>เกร็ดความรู้</b> ${cell.tip}</p>` : ''}`;
}

export class AtlasMode {
  constructor(viewer, ui) {
    this.viewer = viewer;
    this.ui = ui;
    this.list = document.getElementById('cellList');
    this.info = document.getElementById('atlasInfo');
    this.search = document.getElementById('cellSearch');
    this.id = 'neutrophil';
    try { this.id = localStorage.getItem('hv:cell') || this.id; } catch (e) { /* ignore */ }
    if (!byId[this.id]) this.id = 'neutrophil';
    this.renderList();
    this.search.addEventListener('input', () => this.renderList());

    const tool = (id, fn) => {
      const b = document.getElementById(id);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        fn(on);
      });
      return b;
    };
    tool('tRotate', (on) => (this.viewer.autoRotate = on));
    tool('tLabels', (on) => this.viewer.setLabels(on));
    tool('tStain', (on) => this.viewer.setStain(on));
    tool('tCompare', (on) => { this.viewer.setCompare(on); this.viewer.frame(); });
    const slice = document.getElementById('tSlice');
    slice.addEventListener('input', () => this.viewer.setSlice(slice.value / 100));
    document.getElementById('tReset').addEventListener('click', () => this.viewer.frame());
  }

  renderList() {
    const q = this.search.value.trim().toLowerCase();
    this.list.innerHTML = GROUPS.map((g) => {
      const items = CELLS.filter((c) => c.group === g.id && (!q || (c.th + ' ' + c.en).toLowerCase().includes(q)));
      if (!items.length) return '';
      return `<div class="grp"><p class="grp-h">${g.th}<small>${g.en}</small></p>${items
        .map((c) => `<button class="cell-btn" data-id="${c.id}" aria-current="${c.id === this.id}"><span>${c.th}</span><small>${c.en}</small></button>`)
        .join('')}</div>`;
    }).join('') || '<p class="empty">ไม่พบเซลล์ที่ตรงกับคำค้น</p>';
    this.list.querySelectorAll('.cell-btn').forEach((b) => b.addEventListener('click', () => this.select(b.dataset.id)));
  }

  select(id) {
    this.id = id;
    try { localStorage.setItem('hv:cell', id); } catch (e) { /* ignore */ }
    this.list.querySelectorAll('.cell-btn').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)));
    this.viewer.setCell(id, 7);
    this.viewer.setSlice(document.getElementById('tSlice').value / 100);
    this.info.innerHTML = cellCard(byId[id]);
    this.ui.photos?.show(id);
    this.info.scrollTop = 0;
  }

  enter(arg) {
    const v = this.viewer;
    v.controls.enabled = true;
    v.autoRotate = document.getElementById('tRotate').getAttribute('aria-pressed') === 'true';
    v.setLabels(document.getElementById('tLabels').getAttribute('aria-pressed') === 'true');
    v.setStain(document.getElementById('tStain').getAttribute('aria-pressed') === 'true');
    v.setCompare(document.getElementById('tCompare').getAttribute('aria-pressed') === 'true');
    this.select(arg && byId[arg] ? arg : this.id);
  }

  exit() {
    this.viewer.controls.enabled = false;
    this.viewer.setSlice(0);
    this.viewer.labelLayer.hidden = true;
  }

  resize() {}
  update(dt) { this.viewer.update(dt); }
  view() { return { scene: this.viewer.scene, camera: this.viewer.camera, clipping: this.viewer.clippingPlanes }; }
}
