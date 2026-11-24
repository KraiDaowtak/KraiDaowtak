// "Reading a cell" basics. Framework: Shiro Miwa, Atlas of Blood Cells
// (1 size & shape, 2 N/C ratio, 3 nuclear shape, 4 chromatin, 5 nucleoli, plus cytoplasm features).

// Every attribute a learner can describe, with the options used by the cell builder and the worksheet.
export const ATTRS = {
  size: {
    th: 'ขนาดเซลล์', options: [
      { id: 'small', th: 'เล็ก', note: '< 10 µm' },
      { id: 'medium', th: 'กลาง', note: '10–15 µm' },
      { id: 'large', th: 'ใหญ่', note: '> 15 µm' },
    ],
  },
  nc: {
    th: 'N/C ratio', options: [
      { id: 'high', th: 'สูง', note: 'นิวเคลียสเกือบเต็มเซลล์' },
      { id: 'moderate', th: 'ปานกลาง', note: 'ราวครึ่งหนึ่ง' },
      { id: 'low', th: 'ต่ำ', note: 'ไซโทพลาซึมมาก' },
    ],
  },
  nshape: {
    th: 'รูปร่างนิวเคลียส', options: [
      { id: 'round', th: 'กลม/รี' },
      { id: 'kidney', th: 'รูปไต/พับ' },
      { id: 'band', th: 'เกือกม้า (band)' },
      { id: 'bilobed', th: '2 lobe' },
      { id: 'multilobed', th: '3–5 lobe' },
      { id: 'hyperseg', th: '≥ 6 lobe' },
    ],
  },
  chromatin: {
    th: 'โครมาติน', options: [
      { id: 'fine', th: 'ละเอียดโปร่ง', note: 'เซลล์ตัวอ่อน' },
      { id: 'lacy', th: 'ลายลูกไม้', note: 'หลวม เป็นร่างแห' },
      { id: 'clumped', th: 'จับเป็นก้อนหยาบ', note: 'เซลล์ตัวแก่' },
      { id: 'pyknotic', th: 'ทึบเข้มมาก', note: 'pyknotic' },
    ],
  },
  nucleoli: {
    th: 'นิวคลีโอลัส', options: [
      { id: 'absent', th: 'ไม่พบ' },
      { id: 'present', th: 'พบ' },
    ],
  },
  cyto: {
    th: 'สีไซโทพลาซึม', options: [
      { id: 'pink', th: 'ชมพูอ่อน', swatch: '#ecc9d8' },
      { id: 'skyblue', th: 'ฟ้าใส', swatch: '#9cc8ef' },
      { id: 'greyblue', th: 'เทาอมฟ้า', swatch: '#b3b4d4' },
      { id: 'deepblue', th: 'น้ำเงินเข้ม', swatch: '#3e68b6' },
      { id: 'skirt', th: 'ซีดกลาง ขอบน้ำเงินเข้ม', swatch: 'linear-gradient(90deg,#2f62b8,#dfe9f6 45%,#dfe9f6 55%,#2f62b8)' },
      { id: 'salmon', th: 'ชมพูส้ม (มีฮีโมโกลบิน)', swatch: '#d9a3a8' },
    ],
  },
  margin: {
    th: 'ขอบเซลล์', options: [
      { id: 'smooth', th: 'เรียบ' },
      { id: 'irregular', th: 'ไม่เรียบ มีชายครุย' },
      { id: 'scalloped', th: 'เว้าโอบเซลล์ข้างเคียง' },
    ],
  },
  hof: {
    th: 'บริเวณใสข้างนิวเคลียส (hof)', options: [
      { id: 'absent', th: 'ไม่พบ' },
      { id: 'present', th: 'พบ' },
    ],
  },
  granules: {
    th: 'แกรนูล', options: [
      { id: 'none', th: 'ไม่มี' },
      { id: 'fine', th: 'ละเอียด สีชมพูม่วง' },
      { id: 'azur', th: 'Azurophilic ไม่กี่เม็ด', note: 'สีแดงม่วง' },
      { id: 'orange', th: 'ใหญ่ สีส้มแดง' },
      { id: 'dark', th: 'ใหญ่ สีน้ำเงินดำ' },
    ],
  },
  vacuoles: {
    th: 'แวคิวโอล', options: [
      { id: 'absent', th: 'ไม่พบ' },
      { id: 'present', th: 'พบ' },
    ],
  },
  inclusion: {
    th: 'Inclusion body', options: [
      { id: 'none', th: 'ไม่มี' },
      { id: 'auer', th: 'Auer rod' },
      { id: 'dohle', th: 'Döhle body' },
    ],
  },
};

// Typical description of each nucleated cell, used for matching and to grade the worksheet.
export const MORPH = {
  neutrophil: { size: 'medium', nc: 'low', nshape: 'multilobed', chromatin: 'clumped', nucleoli: 'absent', cyto: 'pink', margin: 'smooth', hof: 'absent', granules: 'fine', vacuoles: 'absent', inclusion: 'none' },
  band: { size: 'medium', nc: 'low', nshape: 'band', chromatin: 'clumped', nucleoli: 'absent', cyto: 'pink', margin: 'smooth', hof: 'absent', granules: 'fine', vacuoles: 'absent', inclusion: 'none' },
  hypersegmented: { size: 'medium', nc: 'low', nshape: 'hyperseg', chromatin: 'clumped', nucleoli: 'absent', cyto: 'pink', margin: 'smooth', hof: 'absent', granules: 'fine', vacuoles: 'absent', inclusion: 'none' },
  eosinophil: { size: 'medium', nc: 'low', nshape: 'bilobed', chromatin: 'clumped', nucleoli: 'absent', cyto: 'pink', margin: 'smooth', hof: 'absent', granules: 'orange', vacuoles: 'absent', inclusion: 'none' },
  basophil: { size: 'medium', nc: 'moderate', nshape: 'bilobed', chromatin: 'clumped', nucleoli: 'absent', cyto: 'pink', margin: 'smooth', hof: 'absent', granules: 'dark', vacuoles: 'absent', inclusion: 'none' },
  lymphocyte: { size: 'small', nc: 'high', nshape: 'round', chromatin: 'clumped', nucleoli: 'absent', cyto: 'skyblue', margin: 'smooth', hof: 'absent', granules: 'none', vacuoles: 'absent', inclusion: 'none' },
  reactive_lymph: { size: 'large', nc: 'low', nshape: 'round', chromatin: 'lacy', nucleoli: 'absent', cyto: 'skirt', margin: 'scalloped', hof: 'absent', granules: 'none', vacuoles: 'absent', inclusion: 'none' },
  monocyte: { size: 'large', nc: 'moderate', nshape: 'kidney', chromatin: 'lacy', nucleoli: 'absent', cyto: 'greyblue', margin: 'irregular', hof: 'absent', granules: 'fine', vacuoles: 'present', inclusion: 'none' },
  plasma_cell: { size: 'medium', nc: 'moderate', nshape: 'round', chromatin: 'clumped', nucleoli: 'absent', cyto: 'deepblue', margin: 'smooth', hof: 'present', granules: 'none', vacuoles: 'absent', inclusion: 'none' },
  myeloblast: { size: 'large', nc: 'high', nshape: 'round', chromatin: 'fine', nucleoli: 'present', cyto: 'skyblue', margin: 'smooth', hof: 'absent', granules: 'none', vacuoles: 'absent', inclusion: 'auer' },
  nrbc: { size: 'small', nc: 'moderate', nshape: 'round', chromatin: 'pyknotic', nucleoli: 'absent', cyto: 'salmon', margin: 'smooth', hof: 'absent', granules: 'none', vacuoles: 'absent', inclusion: 'none' },
};

// Cells used in the worksheet drill (hypersegmented is left out: it differs from a neutrophil only by lobe count).
export const DRILL_CELLS = ['neutrophil', 'band', 'eosinophil', 'basophil', 'lymphocyte', 'reactive_lymph', 'monocyte', 'plasma_cell', 'myeloblast', 'nrbc'];
export const DRILL_ROWS = ['size', 'nc', 'nshape', 'chromatin', 'nucleoli', 'cyto', 'granules', 'vacuoles', 'hof'];

// Which keypoint each worksheet row trains, so weak rows can point back to a lesson.
export const ROW_STEP = { size: 'size', nc: 'nc', nshape: 'nshape', chromatin: 'chromatin', nucleoli: 'nucleoli', cyto: 'cyto', hof: 'cyto', margin: 'cyto', granules: 'granules', vacuoles: 'vacuoles', inclusion: 'inclusion' };

// The guided lesson. `no` is the keypoint number in the source framework; cytoplasm features are unnumbered there.
export const STEPS = [
  {
    id: 'size', no: 1, th: 'ขนาดและรูปร่างของเซลล์', en: 'Size and shape of cell',
    focus: ['cyto', 'ruler'], controls: ['size'],
    lead: 'ขั้นแรกของการอ่านเซลล์คือกะขนาด โดยใช้เม็ดเลือดแดงปกติ (7–8 µm) ที่อยู่ข้าง ๆ เป็นไม้บรรทัด แล้วดูว่าเซลล์กลม รี หรือรูปร่างไม่แน่นอน',
    keys: ['เล็กกว่า 10 µm: small lymphocyte, NRBC', 'ใหญ่กว่า 15 µm: monocyte, blast, reactive lymphocyte', 'เซลล์ตัวอ่อนในไขกระดูกมักใหญ่กว่าเซลล์ตัวแก่ในสายเดียวกัน'],
    examples: ['lymphocyte', 'neutrophil', 'monocyte'],
  },
  {
    id: 'nc', no: 2, th: 'สัดส่วนนิวเคลียสต่อไซโทพลาซึม', en: 'Ratio of nucleus to cytoplasm (N/C ratio)',
    focus: ['nucleus', 'cyto'], controls: ['nc'],
    lead: 'เทียบพื้นที่ที่นิวเคลียสกินในเซลล์เมื่อมองจากด้านบน N/C ratio สูงบอกว่าเซลล์ยังอ่อนหรือไซโทพลาซึมยังสร้างไม่มาก เมื่อเซลล์เจริญขึ้น ไซโทพลาซึมจะเพิ่มและ N/C ลดลง',
    keys: ['สูง: blast, small lymphocyte', 'ปานกลาง: monocyte, plasma cell', 'ต่ำ: neutrophil, eosinophil, reactive lymphocyte'],
    examples: ['myeloblast', 'lymphocyte', 'neutrophil'],
  },
  {
    id: 'nshape', no: 3, th: 'รูปร่างของนิวเคลียส', en: 'Shape of nucleus',
    focus: ['nucleus'], controls: ['nshape'],
    lead: 'รูปร่างนิวเคลียสบอกทั้งสายเซลล์และระยะการเจริญ สายนิวโทรฟิลเริ่มจากนิวเคลียสกลม เว้าเป็นรูปไต เป็นเกือกม้า แล้วจึงแบ่งเป็น lobe ดูตำแหน่งด้วยว่าอยู่กลางเซลล์หรือชิดขอบ (eccentric)',
    keys: ['กลมชิดขอบ: plasma cell', 'รูปไตหรือพับไปมา: monocyte', 'เกือกม้า → 3–5 lobe: band → segmented neutrophil', '≥ 6 lobe: hypersegmented (ขาด B12/โฟเลต)'],
    examples: ['band', 'neutrophil', 'monocyte', 'plasma_cell'],
  },
  {
    id: 'chromatin', no: 4, th: 'ลักษณะโครงสร้างโครมาติน', en: 'Characteristics of nuclear chromatin structure',
    focus: ['nucleus'], controls: ['chromatin'],
    lead: 'โครมาตินจะหดตัวแน่นขึ้นเมื่อเซลล์แก่ตัว จากละเอียดโปร่งในเซลล์ตัวอ่อน เป็นลายลูกไม้ แล้วจับเป็นก้อนหยาบ จนทึบเข้มทั้งก้อน (pyknotic) ในเซลล์ที่ใกล้หมดอายุหรือ NRBC',
    keys: ['ละเอียดโปร่ง: blast', 'ลายลูกไม้: monocyte', 'ก้อนหยาบ: lymphocyte, neutrophil, plasma cell (แบบหน้าปัดนาฬิกา)', 'ทึบเข้ม: orthochromic normoblast (NRBC)'],
    examples: ['myeloblast', 'monocyte', 'lymphocyte', 'nrbc'],
  },
  {
    id: 'nucleoli', no: 5, th: 'นิวคลีโอลัส: มีหรือไม่ ขนาด จำนวน สี', en: 'Presence or absence, size, number and color of nucleoli',
    focus: ['nucleoli', 'nucleus'], dim: ['nucleus'], controls: ['nucleoli'],
    lead: 'นิวคลีโอลัสเป็นแหล่งสร้างไรโบโซม จึงเห็นชัดในเซลล์ที่กำลังแบ่งตัวและสังเคราะห์โปรตีนมาก มองเป็นวงสีฟ้าอ่อนในนิวเคลียส ให้บันทึกทั้งจำนวน ขนาด และสี',
    keys: ['พบนิวคลีโอลัสชัด: บอกว่าเป็นเซลล์ตัวอ่อน (blast)', 'Myeloblast มักมี 2–5 อัน ขนาดเล็กถึงกลาง', 'เซลล์ตัวแก่ในเลือดปกติไม่ควรเห็นนิวคลีโอลัส'],
    examples: ['myeloblast'],
  },
  {
    id: 'cyto', no: null, th: 'สี ขอบ และบริเวณใสข้างนิวเคลียส', en: 'Color, marginal shape and juxtanuclear light area of cytoplasm',
    focus: ['cyto', 'hof'], controls: ['cyto', 'margin', 'hof'],
    lead: 'สีน้ำเงินมาจาก RNA ยิ่งน้ำเงินเข้มยิ่งสร้างโปรตีนมาก ส่วนสีชมพูส้มมาจากฮีโมโกลบินหรือแกรนูล ดูขอบว่าเรียบ มีชายครุย หรือเว้าโอบเซลล์ข้างเคียง และหาบริเวณใสข้างนิวเคลียส (hof) ซึ่งคือ Golgi apparatus',
    keys: ['น้ำเงินเข้ม + hof: plasma cell', 'ฟ้าใส: lymphocyte', 'เทาอมฟ้าแบบกระจกฝ้า ขอบไม่เรียบ: monocyte', 'ซีดกลาง ขอบน้ำเงินเข้มโอบ RBC: reactive lymphocyte'],
    examples: ['plasma_cell', 'monocyte', 'reactive_lymph'],
  },
  {
    id: 'granules', no: null, th: 'มีหรือไม่มีแกรนูล', en: 'Presence or absence of granules',
    focus: ['granules'], controls: ['granules'],
    lead: 'ดูว่ามีแกรนูลไหม แล้วจึงดูขนาด สี และความหนาแน่น แกรนูลเป็นตัวแยกเซลล์สาย granulocyte ทั้งสามชนิดออกจากกันได้ชัดที่สุด',
    keys: ['ละเอียดสีชมพูม่วง: neutrophil', 'ใหญ่กลมสีส้มแดง: eosinophil', 'ใหญ่สีน้ำเงินดำบังนิวเคลียส: basophil', 'Azurophilic ไม่กี่เม็ด: promyelocyte, large granular lymphocyte'],
    examples: ['neutrophil', 'eosinophil', 'basophil'],
  },
  {
    id: 'vacuoles', no: null, th: 'มีหรือไม่มีแวคิวโอล', en: 'Presence or absence of vacuoles',
    focus: ['vacuoles'], controls: ['vacuoles'],
    lead: 'แวคิวโอลเป็นช่องใสในไซโทพลาซึม พบได้ใน monocyte ปกติ แต่ถ้าพบใน neutrophil จำนวนมากร่วมกับ toxic granulation บ่งถึงการติดเชื้อรุนแรงหรือ sepsis',
    keys: ['Monocyte: พบได้ปกติ', 'Neutrophil มีแวคิวโอล: toxic change, sepsis', 'แวคิวโอลจาก EDTA ค้างนานเป็น artifact ได้'],
    examples: ['monocyte'],
  },
  {
    id: 'inclusion', no: null, th: 'มีหรือไม่มี inclusion body', en: 'Presence or absence of inclusion bodies',
    focus: ['inclusion'], controls: ['inclusion'],
    lead: 'Inclusion body คือโครงสร้างที่ไม่ควรพบในเซลล์ปกติ ต้องบอกให้ได้ว่าเป็นอะไร เพราะหลายชนิดชี้การวินิจฉัยได้ทันที',
    keys: ['Auer rod: แท่งสีแดงชมพูใน myeloblast ยืนยัน AML', 'Döhle body: ปื้นสีฟ้าอ่อนที่ขอบ neutrophil พบในการติดเชื้อ การอักเสบ', 'ในเม็ดเลือดแดง: Howell-Jolly, basophilic stippling, เชื้อมาลาเรีย'],
    examples: ['myeloblast', 'howell_jolly', 'malaria_ring'],
  },
];

// Starting cell for the lesson, close to the teaching diagram: a large cell with every feature visible.
export const DEFAULT_STATE = {
  size: 'large', nc: 'moderate', nshape: 'round', chromatin: 'fine', nucleoli: 'present',
  cyto: 'skyblue', margin: 'irregular', hof: 'present', granules: 'azur', vacuoles: 'present', inclusion: 'dohle',
};
