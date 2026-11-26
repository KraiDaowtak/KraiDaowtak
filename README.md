# HemaVerse 3D

แพลตฟอร์มเรียนรู้ **สัณฐานวิทยาเซลล์เม็ดเลือด (Blood cell morphology)** แบบ 3 มิติบนเว็บ สำหรับนักศึกษาเทคนิคการแพทย์ แพทย์ และผู้สนใจโลหิตวิทยา ใช้ได้บนเบราว์เซอร์ทันที ไม่ต้องติดตั้งโปรแกรม

## โหมดการเรียน

| โหมด | สิ่งที่ทำได้ |
| --- | --- |
| **หลักการอ่านเซลล์** | เรียนหลักการบรรยายเซลล์ 5 ข้อ (ขนาดและรูปร่าง, N/C ratio, รูปร่าง nucleus, chromatin, nucleolus) และลักษณะ cytoplasm (สี ขอบ hof, granule, vacuole, inclusion body) ตามกรอบของ Shiro Miwa, *Atlas of Blood Cells* แต่ละหลักไฮไลต์ส่วนนั้นบนเซลล์ 3 มิติที่ปรับลักษณะได้สด พร้อมบอกว่าเซลล์ที่ประกอบขึ้นใกล้เคียงเซลล์จริงชนิดใด และมีโหมดฝึกกรอกใบบันทึกลักษณะ 9 ข้อก่อนระบุชื่อเซลล์ |
| **Atlas 3D** | สำรวจโมเดล 3 มิติ 33 ชนิด หมุน ซูม ดูป้ายกำกับโครงสร้าง ตัดขวางดูภายในเซลล์ สลับเป็นมุมกล้องจุลทรรศน์ และเทียบขนาดกับเม็ดเลือดแดงปกติบนตาราง 5 µm |
| **ล่องหลอดเลือด** | นั่งไปกับกระแสเลือดใน venule ลากเพื่อหันมอง คลิกเซลล์ที่ลอยผ่านเพื่อเก็บให้ครบ 8 ชนิด พร้อมเห็น axial streaming, margination และ leukocyte rolling |
| **นักสืบเซลล์** | ควิซ 10 ข้อจากโมเดล 3 มิติที่หมุนแบบสุ่ม 3 ระดับ (พื้นฐาน / เม็ดเลือดแดง / ทั้งหมด) มีคะแนน สถิติ และคำอธิบายหลังตอบ |
| **นับแยกชนิด** | จำลองการทำ manual differential count ใต้เลนส์ 100× oil คลิกเม็ดเลือดขาวแล้วกดแป้น 1–8 เหมือนเครื่องนับเซลล์ เลือกตัวอย่างได้ 4 แบบ (ปกติ, ติดเชื้อแบคทีเรีย, พยาธิ/ภูมิแพ้, ไข้เลือดออก) แล้วเทียบผลกับค่าจริง |
| **กรณีศึกษา** | 13 กรณีศึกษาพร้อมประวัติ ผลแล็บ และสไลด์เสมือนที่เลื่อนดูได้หลาย field เช่น IDA, β-thal/HbE, G6PD deficiency, มาลาเรีย P. falciparum, TTP, AML, CLL, multiple myeloma หลังตอบสามารถไฮไลต์เซลล์สำคัญบนสไลด์ได้ |

## เซลล์ที่มีในระบบ

- **เซลล์ปกติ:** RBC, segmented neutrophil, band, eosinophil, basophil, lymphocyte, monocyte, platelet
- **รูปร่างและขนาดเม็ดเลือดแดง:** microcytic hypochromic, macro-ovalocyte, polychromasia, spherocyte, target cell, sickle cell, schistocyte, elliptocyte/pencil cell, teardrop, echinocyte, acanthocyte, stomatocyte, bite cell
- **สิ่งเจือปนและการเรียงตัว:** Howell-Jolly body, basophilic stippling, Pappenheimer bodies, Heinz bodies, malaria ring form, NRBC, rouleaux
- **เม็ดเลือดขาวผิดปกติ:** hypersegmented neutrophil, myeloblast with Auer rod, reactive lymphocyte, plasma cell, smudge cell

## ภาพจริงจากกล้องจุลทรรศน์

ในโหมด Atlas มีกล่อง "ภาพจริงจากกล้องจุลทรรศน์" ที่มุมขวาบนของภาพ 3 มิติ แสดงภาพถ่ายจริงของเซลล์ที่เลือกเทียบกับโมเดล เพิ่มภาพได้ 2 วิธี

- **บน claude.ai:** ผู้ที่มีสิทธิ์แก้ไข artifact (Owner/Editor) จะเห็นปุ่ม "+ เพิ่มภาพจริง" อัปโหลดไฟล์ JPG/PNG/WebP พร้อมคำอธิบายและที่มา ทุกคนที่เปิดหน้าจะเห็นภาพทันที และลบได้จากกล่องเดียวกัน
- **บน GitHub Pages หรือเซิร์ฟเวอร์ของตัวเอง:** วางไฟล์ภาพในโฟลเดอร์ `photos/` แล้วระบุใน `photos/manifest.json` โดยใช้ id ของเซลล์ (ดูได้จาก `js/data.js`)

```json
{
  "neutrophil": [
    { "src": "photos/neutrophil-01.jpg", "caption": "nucleus 4 lobe", "credit": "Wright stain, 100× oil" }
  ]
}
```

## รายละเอียดทางวิทยาศาสตร์

- ทุกโมเดลสร้างด้วยโค้ด (procedural) ในหน่วยไมโครเมตรจริง จึงเทียบขนาดระหว่างเซลล์ได้ถูกสัดส่วน
- รูปทรงเม็ดเลือดแดงคำนวณจากสมการ **Evans–Fung (1972)** ที่วัดจากเม็ดเลือดแดงมนุษย์ แล้วปรับพารามิเตอร์เพื่อสร้าง poikilocyte แต่ละชนิด
- สีของเม็ดเลือดแดงคำนวณจากความหนาเฉพาะจุด บริเวณที่บางจึงติดสีจางเป็น central pallor เหมือนภาพใต้กล้องจริง (ลองกด "มุมกล้องจุลทรรศน์" กับ target cell)
- chromatin ของ nucleus ใช้ fractal noise ปรับความหยาบตามชนิดเซลล์ เช่น lymphocyte จับกลุ่มหนา blast ละเอียดโปร่ง plasma cell แบบหน้าปัดนาฬิกา

> เนื้อหาเพื่อการศึกษา ไม่ใช้แทนการวินิจฉัยทางการแพทย์

## วิธีเปิดใช้งาน

เป็นเว็บแบบ static ไม่มีขั้นตอน build เปิดผ่าน web server ใดก็ได้ (ES modules เปิดจาก `file://` โดยตรงไม่ได้)

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

เผยแพร่ด้วย GitHub Pages ได้ทันที: Settings → Pages → Deploy from branch → เลือก branch และโฟลเดอร์ `/ (root)`

ต้องใช้เบราว์เซอร์ที่รองรับ WebGL 2 และ import maps (Chrome, Edge, Firefox, Safari 16.4 ขึ้นไป) โหลด Three.js 0.160.0 จาก jsDelivr

## โครงสร้างไฟล์

```
index.html          หน้าหลักและ layout
css/style.css       ธีมและ layout (รองรับจอมือถือ)
js/main.js          renderer, การสลับโหมด, event ของ pointer/keyboard
js/cells.js         เครื่องสร้างโมเดลเซลล์ 3 มิติทั้งหมด (µm)
js/noise.js         value noise, fbm และตัวสุ่มแบบกำหนด seed
js/viewer.js        ตัวแสดงเซลล์เดี่ยว (Atlas และ Quiz ใช้ร่วมกัน)
js/smear.js         สไลด์เสมือนใต้เลนส์ 100× oil
js/data.js          เนื้อหาเซลล์ ตัวอย่างการนับ และกรณีศึกษา (ภาษาไทย)
js/basics-data.js   หลักการอ่านเซลล์ ตัวเลือกลักษณะ และตารางลักษณะของเซลล์อ้างอิง
js/teach.js         เซลล์สอน 3 มิติที่ปรับลักษณะได้และไฮไลต์ทีละส่วน
js/photos.js        กล่องภาพจริงจากกล้องจุลทรรศน์
photos/             ภาพจริงและ manifest.json
js/modes/*.js       โหมด basics, atlas, stream, quiz, diff, cases
```

## เพิ่มเนื้อหา

- **เซลล์ใหม่:** เพิ่มข้อมูลใน `CELLS` (`js/data.js`) และเพิ่ม `case` ใน `buildCell()` (`js/cells.js`)
- **กรณีศึกษาใหม่:** เพิ่ม object ใน `CASES` โดยกำหนดสัดส่วนเซลล์บนสไลด์ใน `smear.rbc` และ `smear.wbc`

## แอปอื่นใน repo นี้

- [`nong-tao/`](nong-tao/index.html) **มังกรน้อยคู่สุขภาพ**: บันทึกอาหาร วิตามิน การนอน และน้ำของตัวเอง แล้วลูกมังกร 3 มิติจะโต แข็งแรง และอารมณ์ดีตามการดูแลตัวเองของเรา เป็นไฟล์ HTML ไฟล์เดียว เปิดในเบราว์เซอร์ได้ทันที ข้อมูลเก็บใน localStorage ของเครื่อง
