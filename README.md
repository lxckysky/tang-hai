# TangHai (ตังค์หาย) — Privacy-First Multi-Bank Statement Analyzer & AI Categorizer

> **Web Programming · โจทย์ก่อนวันสัมภาษณ์ Young Webmaster Camp (YWC)**  
> เว็บแอปพลิเคชันสำหรับปลดล็อก แกะรอย และจัดหมวดหมู่ไฟล์ e-Statement ธนาคาร (PDF) อัตโนมัติด้วยสถาปัตยกรรม **100% Client-Side Parsing** ผสาน **Zero-Config Hybrid AI Categorization (Google Gemini Flash)** เพื่อค้นหา "รายจ่ายใช้ชีวิตจริง (True Personal Spend)" โดยไม่ส่งไฟล์การเงินส่วนตัวออกนอกเครื่องผู้ใช้

---

## ข้อมูลสำคัญสำหรับวันสัมภาษณ์ (YWC Submission Info)

| สิ่งที่ต้องเตรียมมาวันสัมภาษณ์ | รายละเอียด |
| :--- | :--- |
| **Live URL (เปิดใช้งานได้จริง)** | **[https://tang-hai-nu.vercel.app/](https://tang-hai-nu.vercel.app/)** |
| **GitHub Link (Source Code)** | **[https://github.com/lxckysky/tang-hai](https://github.com/lxckysky/tang-hai)** |
| **Tech Stack** | **Frontend:** HTML5, Tailwind CSS (Mobile-First Responsive Design), Vanilla JavaScript (ES6+)<br>**PDF & Client-Side Engine:** Mozilla `PDF.js` (ถอดรหัสผ่านและสกัดพิกัดข้อความใน Browser RAM 100%)<br>**Backend / Serverless:** Vercel Serverless Functions (Node.js Runtime, ES Module)<br>**AI & LLM Model:** Google Gemini Flash API (`gemini-2.5-flash` / `gemini-2.0-flash` พร้อม Model Fallback)<br>**Persistence:** Browser `localStorage` (Zero-Database Privacy Architecture) |

---

## สำหรับกรรมการสัมภาษณ์: ทดสอบระบบได้ใน 30 วินาที (Quick Judge Guide)

กรรมการสามารถเปิด **[Live URL (https://tang-hai-nu.vercel.app/)](https://tang-hai-nu.vercel.app/)** แล้วทดสอบฟีเจอร์หลักได้ทันทีโดยไม่ต้องใช้ไฟล์ธนาคารส่วนตัว และ **ไม่ต้องตั้งค่า API Key ใดๆ ทั้งสิ้น (AI ทำงานอัตโนมัติ 100%)**:

1. **กดปุ่ม `"สเตทเมนต์ SCB (Full Details)"` ในหน้าแรก:**
   - ระบบจะจำลองสเตทเมนต์ที่มีทั้งร้านอาหาร, บิลค่าไฟ/เน็ต, โอนข้ามบัญชีตัวเอง (`SCB`, `KBank`), รายการเงินผ่านมือ และรายการโอนให้บุคคล
   - **Gemini AI** จะทำงานอัตโนมัติทันทีเพื่อสรุปภาพรวมพฤติกรรมการเงิน และแยกยอด **"รายจ่ายใช้ชีวิตจริง (True Personal Spend)"** ออกจาก **"ยอดเงินออกหน้าสเตทเมนต์"** ที่บวมเพราะโอนข้ามบัญชีตัวเอง
2. **กดปุ่ม `"สเตทเมนต์ KTB (Code-Level)"`:**
   - ทดสอบกรณีสเตทเมนต์ธนาคารที่ไม่มีชื่อร้านค้า (แสดงเฉพาะรหัส ISO เช่น `POS`, `CW`, `D/D`, `FE01`) ระบบจะถอดรหัสธุรกรรมให้อัตโนมัติ
3. **ทดสอบระบบ Human-in-the-Loop & Auto-Propagation:**
   - ไปที่แท็บ **`จัดหมวดหมู่`** หรือ **`รายการทั้งหมด`** ลองเปลี่ยนหมวดหมู่หรือพิมพ์บันทึกช่วยจำให้รายการโอนบุคคล (เช่น `นาย สมชาย ใจดี` $\rightarrow$ พิมพ์ว่า *"ร้านข้าวมันไก่หน้ามอ"*) แล้วกด **บันทึก**
   - สังเกตว่าระบบจะ **อัปเดตทุกรายการที่โอนให้บุคคลนี้ทั้งเดือนพร้อมกันทันที** และจดจำลงสมุดช่วยจำสำหรับเดือนถัดไป
4. **ทดสอบด้วยไฟล์ PDF e-Statement จริง (รองรับไฟล์ติดรหัสผ่าน):**
   - ลากไฟล์ PDF สเตทเมนต์จากธนาคารใดก็ได้ (SCB, KBank, KTB, BBL, ttb, BAY) ลงในกล่องอัปโหลด ระบบจะปลดล็อกรหัสผ่านในเครื่องและให้ AI วิเคราะห์ให้อัตโนมัติทันที

---

## 1. ที่มาของปัญหา (Problem Statement)

การจดบันทึกรายรับ-รายจ่ายทุกวันเป็นเรื่องยากในชีวิตจริงเมื่อทุกอย่างจ่ายผ่าน QR PromptPay แต่เมื่อดาวน์โหลดไฟล์ **e-Statement (PDF)** รายเดือนจากธนาคารมาดูย้อนหลัง กลับพบปัญหาใหญ่ 4 ข้อ:
1. **ไฟล์ PDF ติดรหัสผ่าน & ความเป็นส่วนตัว (Data Privacy):** ไฟล์สเตทเมนต์มีข้อมูลการเงินที่อ่อนไหว ผู้ใช้ไม่สบายใจที่จะอัปโหลดไฟล์ PDF ทั้งฉบับขึ้นเซิร์ฟเวอร์ภายนอก
2. **โอนเงินข้ามบัญชีตัวเอง (Self-Transfer Distortion):** คนรุ่นใหม่มักมีหลายบัญชี (เช่น โอนจากบัญชีเก็บเงิน KBank มาบัญชีใช้จ่าย SCB) ทำให้ยอดเงินออกรวมในสเตทเมนต์ดูสูงเกินรายจ่ายจริงหลายเท่า (ยอดเงินบวม)
3. **เงินผ่านมือและการหารค่าใช้จ่ายกับเพื่อน (Split Bills & Pass-Throughs):** การออกเงินค่าอาหารให้เพื่อนก่อนแล้วเพื่อนโอนคืน หรือเงินผ่านมือก้อนใหญ่ ทำให้สัดส่วนรายจ่ายเพี้ยน
4. **ชื่อรายการอ่านไม่ออกและต้องนึกซ้ำทุกเดือน:** สเตทเมนต์ไทยมีทั้งชื่อบริษัทจดทะเบียน (`MINOR FOOD`, `JENKONGKLAI`), รหัสธุรกรรม หรือชื่อบุคคล PromptPay ที่ถ้าไม่มีระบบช่วยจำ ต้องมานั่งไล่นึกใหม่ทุกเดือน

---

## 2. สถาปัตยกรรมระบบและจุดเด่นเชิงวิศวกรรม (System Architecture & Engineering Highlights)

```text
[ผู้ใช้เลือกไฟล์ PDF e-Statement หรือกดปุ่ม Demo Data]
         │
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 1. Client-Side Browser (ปลอดภัย 100%)                 │
│                                                                      │
│ • PDF.js Decryption: ปลดล็อกรหัสผ่านใน RAM ไม่ส่งไฟล์ออกนอกเครื่อง     │
│ • Coordinate Clustering: จัดกลุ่มแกน Y (4.5pt) แก้ปัญหาสระลอยภาษาไทย  │
│ • Universal Balance-Delta: คำนวณ ΔBalance = currBalance - prevBalance│
│ • 3-Tier Pre-Filtering: คัดกรองโอนบัญชีตัวเอง + สมุดจำ + กฎพื้นฐานฟรี │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ ส่งเฉพาะ "ชื่อร้านค้าที่ไม่คุ้นเคย (Set Deduplicated)"
                                 │ (ตัดยอดเงินรายบรรทัดและเลขบัญชีออก)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              2. Vercel Serverless Proxy (/api/gemini)                │
│                                                                      │
│ • ซ่อน GEMINI_API_KEY ในฝั่ง Server ผู้ใช้เข้าเว็บแล้ว AI ทำงานทันที    │
│ • เรียกใช้ Google Gemini Flash (2.5 -> 2.0 -> 2.0-Lite Fallback)     │
│ • จำแนกหมวดหมู่ตามข้อเท็จจริงธุรกิจไทย + สรุป Insights พฤติกรรมการเงิน  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│           3. Real-Time Responsive Dashboard & LocalStorage           │
│                                                                      │
│ • แสดงรายจ่ายใช้ชีวิตจริง (หักโอนบัญชีตัวเองและเงินผ่านมือออกแล้ว)        │
│ • แสดงป้ายกำกับรายการหารเพื่อน / เงินโอนคืน / เงินผ่านมืออัตโนมัติ       │
│ • แก้ไขหมวดหมู่ 1 ครั้ง อัปเดตทุกบรรทัดที่ชื่อตรงกันทั้งเดือนทันที           │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 100% Client-Side PDF Decryption & Universal Multi-Bank Parser (`js/pdfParser.js`)
* **ถอดรหัสเอกสารในเครื่องผู้ใช้:** ใช้ `PDF.js` ปลดล็อกรหัสผ่านและอ่านข้อมูลพิกัดข้อความในเบราว์เซอร์ โดยไม่มีการส่งไฟล์ PDF หรือรหัสผ่านออกนอกเครื่องแม้แต่ไบต์เดียว
* **Smart Multi-Bank Column Layout Engine:** ตรวจจับโครงสร้างคอลัมน์ของแต่ละธนาคารอัตโนมัติ (KBank, SCB, BBL, Krungthai, ttb, Krungsri):
  * **ดึงชื่อเจ้าของบัญชีครบถ้วน:** รองรับคำนำหน้า ด.ญ., ด.ช., เด็กหญิง, เด็กชาย, นาย, นางสาว, น.ส., นาง, MR., MS. ฯลฯ
  * **รองรับเลขที่บัญชี 4 กลุ่ม:** เช่น `011-8-35708-6` ของกสิกรไทย และ 3 กลุ่มของไทยพาณิชย์
  * **Multi-line Description Merger:** ผสานข้อความคำอธิบายรายการที่ยาวเกิน 1 บรรทัด (เช่น `CPN SLY FOOD PATIO (ชื่อบัญชี: บมจ. เซ็นทรัลพัฒนา)` หรือ `TikTok Shop (Serviced by PIPO)`) กลับเข้าสู่รายการเดียวกันอย่างสมบูรณ์
* **Universal Balance-Delta Parser:** แทนที่จะเขียน Regex เจาะจงแต่ละธนาคาร ระบบใช้สมการคณิตศาสตร์เปรียบเทียบผลต่างยอดคงเหลือ:
  $$\Delta \text{Balance} = \text{currBalance} - \text{prevBalance}$$
  * ถ้า $\Delta \text{Balance} > 0$ $\rightarrow$ เงินเข้า (`Credit`)
  * ถ้า $\Delta \text{Balance} < 0$ $\rightarrow$ เงินออก (`Debit`)  
  ช่วยให้รองรับสเตทเมนต์ได้ทุกธนาคารอย่างแม่นยำ แม้แต่ละธนาคารจะเรียงคอลัมน์ต่างกัน
* **Multi-Statement Cross-Bank Merger:** กดปุ่ม **`+ เพิ่มสเตทเมนต์`** เพื่อนำบัญชีที่ 2 และ 3 จากต่างธนาคารมารวมเป็นก้อนเดียวได้

### 2.2 การตัดยอดโอนบัญชีตัวเอง & ตรวจจับเงินหารเพื่อน (`js/categorizer.js`)
* **Self-Transfer Elimination & Stem Matching:** ดึงชื่อเจ้าของบัญชีจากหัวกระดาษ และตรวจจับธุรกรรมที่ชื่อผู้รับตรงกับชื่อตนเอง (รองรับการตัดคำด้วย `++` ของธนาคาร เช่น `ด.ญ. ทอฝัน สุทธิ++` หรือ `นาย ศาศวรรต จิตรส+`) แล้วแยกออกเป็นหมวดหมู่ `SELF_TRANSFER` ไม่นับรวมใน **รายจ่ายใช้ชีวิตจริง (True Personal Spend)**
* **Split & Pass-Through Detector:** ตรวจจับธุรกรรมที่มีเงินเข้า-ออกเท่ากันในวันเดียวกัน (`PASS_THROUGH` / `REIMBURSED`) หรือมียอดโอนเข้าเท่าๆ กันจากหลายคนก่อนจ่ายบิลก้อนใหญ่ (`SPLIT_BILL`) พร้อมแสดงป้ายกำกับบนตารางทันที
* **3-Tier Categorization Flow:**
  1. **Tier 1 (Memory & Regex Rules):** ตรวจสอบจากประวัติที่ผู้ใช้เคยตั้งชื่อไว้ในเครื่อง (`localStorage`) และกฎร้านค้าพื้นฐานฟรี 0 บาท
  2. **Tier 2 (Deduplicated AI Batch):** กรองเฉพาะชื่อร้านค้าที่ไม่ซ้ำกัน (`Set Deduplication`) ก่อนส่งไปให้ Gemini AI เพื่อประหยัดโควตาและลด Token การเรียก API ได้กว่า 70–85%
  3. **Tier 3 (Priority Review Queue):** ดึงรายการที่ไม่รู้จักมาเรียงจาก **ยอดเงินมากสุด $\rightarrow$ น้อยสุด** พร้อมแสดง **คำใบ้จาก AI** เพื่อให้ระบุได้เสร็จในไม่กี่คลิก

### 2.3 Zero-Config Serverless AI Proxy & Seamless Fallback (`api/gemini.js`)
* เชื่อมต่อ Gemini API ผ่าน Vercel Serverless Function เพื่อซ่อน `GEMINI_API_KEY` ไว้ในเซิร์ฟเวอร์ ผู้ใช้ทั่วไปหรือกรรมการเข้าเว็บแล้วอัปโหลดไฟล์หรือกดดูตัวอย่าง **AI จะทำงานอัตโนมัติทันทีโดยไม่ต้องตั้งค่า API Key เอง**
* มาพร้อมระบบ **Model Fallback Chain** (`gemini-2.5-flash` $\rightarrow$ `gemini-2.0-flash` $\rightarrow$ `gemini-2.0-flash-lite`) และหากออฟไลน์จะสลับไปใช้ **Smart Heuristic Rule Engine** ทันทีโดยไม่ทำให้หน้าเว็บค้าง

### 2.4 Mobile-First Responsive Dashboard (`index.html`, `js/app.js`)
* รองรับทุกอุปกรณ์ทั้ง Desktop (ตารางข้อมูลละเอียด) และ iPhone/Mobile (การ์ดรายการแนวตั้ง + Bottom Tab Bar)
* มีแถบ **สัดส่วนรายจ่ายภาพรวม (Stacked Distribution Bar)** และระบบ **Category Modal Drill-down** เพื่อเจาะดูรายการย่อยในแต่ละหมวดได้ทันที
* **ปุ่มลองข้อมูลตัวอย่าง (Demo Data):** สำหรับให้กรรมการกดทดสอบระบบได้ทันทีใน 1 วินาที โดยไม่ต้องมีไฟล์ PDF จริง

---

## 3. โครงสร้างโปรเจกต์ (Project Structure)

```text
tang-hai/
├── index.html               # ส่วนติดต่อผู้ใช้หลัก 4 หน้า Responsive (Overview, Priority, Transactions, Accounts)
├── vercel.json              # กำหนด Routing และ Serverless Handler สำหรับ Vercel
├── package.json             # ประกาศ Module Type และ Metadata สำหรับ Vercel Node Runtime
├── api/
│   └── gemini.js            # Vercel Serverless Proxy สำหรับเรียก Gemini Flash API พร้อม Model Fallback
├── js/
│   ├── pdfParser.js         # ตัวปลดล็อกรหัสผ่าน PDF และ Universal Balance-Delta Parser
│   ├── categorizer.js       # อัลกอริทึมจัดหมวดหมู่ 3 ชั้น, ตรวจจับโอนบัญชีตัวเอง และ Smart Heuristic Hints
│   ├── memoryStore.js       # ระบบสมุดช่วยจำชื่อร้านค้า (Local Normalizer & Rule Persistence)
│   ├── sampleData.js        # หมวดหมู่มาตรฐาน, ระบบสร้างหมวดหมู่ใหม่ (Custom Categories) และข้อมูล Demo
│   ├── config.local.example.js # แม่แบบการตั้งค่า API Key สำหรับการรันแบบ Local
│   └── app.js               # State Management, Multi-view Navigation, Event Listeners และ Export CSV
└── README.md                # เอกสารประกอบโปรเจกต์และแนวทางสัมภาษณ์
```

---

## 4. ขั้นตอนการ Deploy ขึ้น Vercel (Deployment Guide)

1. **Push โค้ดขึ้น GitHub Repository ของคุณ:**
   ```bash
   git add .
   git commit -m "feat: ready for vercel deployment"
   git push origin main
   ```
2. **สร้างโปรเจกต์บน Vercel:**
   * เข้าสู่ระบบที่ [vercel.com](https://vercel.com)
   * กด **`Add New...`** $\rightarrow$ **`Project`**
   * เลือก Repository `tang-hai` แล้วกด **`Import`**
3. **ตั้งค่า Environment Variable (สำหรับ Gemini AI):**
   * ในหน้า Configure Project หัวข้อ **Environment Variables**:
     * **Key:** `GEMINI_API_KEY`
     * **Value:** ใส่ API Key ของคุณ (แนะนำให้ใช้คีย์จาก [Google AI Studio](https://aistudio.google.com/))
   * กด **`Deploy`**
4. **ทดสอบ Live URL:**
   * เมื่อ Deploy เสร็จสิ้น จะได้ Live URL (เช่น `https://tang-hai.vercel.app`) สามารถเปิดทดสอบและส่งให้กรรมการได้ทันที

---

## 5. แนวทางการอธิบายโค้ดในวันสัมภาษณ์ (Talking Points)

* **Q: ทำไมเลือกทำโปรเจกต์นี้?**
  * *A:* มองจากปัญหาจริงที่คนรอบตัวและตัวเองเจอ คือสเตทเมนต์ธนาคารอ่านยาก ยอดเงินโอนไปมาระหว่างบัญชีตัวเองทำให้รายจ่ายบวม และคนไม่อยากอัปโหลดไฟล์ส่วนตัวขึ้นเว็บ จึงต้องการสร้าง Web App ที่ประมวลผลเร็ว ปลอดภัย และแก้ปัญหานี้ได้แบบ 100% Client-Side
* **Q: ทำไมเลือก Vanilla JS และ PDF.js แทนที่จะใช้ Framework ใหญ่ๆ?**
  * *A:* สเตทเมนต์มีขนาดไฟล์และความซับซ้อนของ Array การใช้ Vanilla JS ทำให้แอปพลิเคชันโหลดเร็วมาก ไม่มี Bundle Size ขนาดใหญ่ และควบคุม DOM รวมถึง Memory ของเบราว์เซอร์ได้ละเอียด โดยเฉพาะการทำงานร่วมกับ PDF.js
* **Q: จัดการเรื่องความปลอดภัยของ API Key และข้อมูลผู้ใช้อย่างไร?**
  * *A:* 
    1. ข้อมูลสเตทเมนต์ประมวลผลใน Browser ของผู้ใช้เท่านั้น ไม่มีการส่งเนื้อหาไฟล์ขึ้นเซิร์ฟเวอร์
    2. API Key ฝั่งการใช้งานจริง ถูกซ่อนไว้ใน Vercel Serverless Function Proxy (`/api/gemini`) ไม่เคยถูกเปิดเผยใน Client Code
    3. ส่งเฉพาะชื่อร้านค้าที่ไม่คุ้นเคยไปถาม AI (ตัดยอดเงินและชื่อบุคคลส่วนตัวออก) เพื่อรักษาความปลอดภัยข้อมูลขั้นสูงสุด
