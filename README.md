# TangHai (ตังค์หาย) — Multi-Bank Statement Analyzer & AI Categorizer
> **Web Programming · โปรเจกต์ก่อนวันสัมภาษณ์ Young Webmaster Camp (YWC)**  
> ระบบแกะรอยและจัดหมวดหมู่ไฟล์ e-Statement ธนาคารรายเดือนอัตโนมัติ เพื่อดูพฤติกรรมการใช้จ่ายที่แท้จริง รองรับการรวมหลายบัญชีข้ามธนาคารและประมวลผลร่วมกับ AI

---

## 📌 ข้อมูลสำคัญสำหรับการส่งงาน (Submission Details)

* **Live URL (ใช้งานได้จริง):** `https://tang-hai.vercel.app` *(หรือ URL ที่คุณได้จากการ Deploy บน Vercel)*
* **GitHub Repository:** `https://github.com/lxckysky/tang-hai`
* **Tech Stack:**
  * **Frontend:** HTML5, Tailwind CSS (Utility-First Responsive Design), Vanilla JavaScript (ES6+)
  * **PDF & Client-Side Engine:** `PDF.js` (Mozilla) — ถอดรหัสและดึงข้อมูล Text จาก PDF ใน Browser 100%
  * **Backend / Serverless:** Vercel Serverless Functions (Node.js Runtime, ES Module)
  * **AI & LLM Model:** Google Gemini Flash API (`gemini-2.5-flash` / `gemini-2.0-flash`) พร้อมระบบ Model Fallback
  * **Local Storage & Memory:** Browser `localStorage` (Privacy-First, ไม่มีฐานข้อมูลภายนอกเก็บข้อมูลการเงิน)

---

## 1. ที่มาของปัญหา (Problem Statement)
การจดบันทึกรายรับ-รายจ่ายทุกวันเป็นเรื่องยากในชีวิตจริง แต่เมื่อดาวน์โหลดไฟล์ **e-Statement (PDF)** รายเดือนจากธนาคารมาดู กลับพบปัญหาใหญ่ 3 ข้อ:
1. **ไฟล์ PDF ติดรหัสผ่าน & ความเป็นส่วนตัว (Data Privacy):** ไฟล์สเตทเมนต์มีข้อมูลการเงินที่อ่อนไหว ผู้ใช้ไม่สบายใจที่จะอัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์ภายนอก
2. **โอนเงินข้ามบัญชีตัวเอง (Self-Transfer):** คนรุ่นใหม่มักมีหลายบัญชี (เช่น บัญชีเงินเดือน KBank โอนไป SCB เพื่อสแกนจ่าย) ทำให้ยอดเงินออกรวมในสเตทเมนต์ดูสูงเกินรายจ่ายจริง (ยอดเงินบวม)
3. **ชื่อรายการอ่านไม่ออก:** สเตทเมนต์ไทยมักขึ้นเป็นรหัสเครื่อง, สาขา หรือชื่อบุคคล PromptPay ที่นึกไม่ออกว่าคือค่าอะไร

---

## 2. นวัตกรรมและสถาปัตยกรรมระบบ (Key Features & Architecture)

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
* **ปุ่มตรวจสอบคอลัมน์ด้วย AI (AI Column Alignment):** ผู้ใช้สามารถกดให้ AI ตรวจสอบความถูกต้องของการเรียงคอลัมน์ วันที่, เวลา, ช่องทาง, ยอดเงินเข้า/ออก, คงเหลือ และรายละเอียดได้ในคลิกเดียว
* **Multi-Statement Cross-Bank Merger:** กดปุ่ม **`+ เพิ่มสเตทเมนต์`** เพื่อนำบัญชีที่ 2 และ 3 จากต่างธนาคารมารวมเป็นก้อนเดียวได้

### 2.2 การตัดยอดโอนบัญชีตัวเอง & หมวดหมู่เฉพาะบุคคล (Personalized Categorization) (`js/categorizer.js`)
* **Self-Transfer Elimination & Stem Matching:** ดึงชื่อเจ้าของบัญชีจากหัวกระดาษ และตรวจจับธุรกรรมที่ชื่อผู้รับตรงกับชื่อตนเอง (รองรับการตัดคำด้วย `++` ของธนาคาร เช่น `ด.ญ. ทอฝัน สุทธิ++` หรือ `นาย ศาศวรรต จิตรส+`) แล้วแยกออกเป็นหมวดหมู่ `SELF_TRANSFER` ไม่นับรวมใน **รายจ่ายใช้ชีวิตจริง (True Personal Spend)**
* **ระบบแก้ไข/ระบุชื่อเจ้าของบัญชี (Manual & Aliases Override):** หากสเตทเมนต์ใดไม่มีชื่อเจ้าของบัญชีพิมพ์อยู่ ผู้ใช้สามารถกดปุ่ม **✏️ แก้ไข/ระบุชื่อ** เพื่อใส่ชื่อหรือชื่อเล่น PromptPay ได้ทันที ระบบจะคำนวณยอดโอนบัญชีตัวเองใหม่แบบเรียลไทม์
* **Personalized Spending Choices & Lifestyle Presets:** เพราะพฤติกรรมของแต่ละคนไม่เหมือนกัน ระบบมี:
  * พรีเซ็ตหมวดหมู่เฉพาะทาง: ทาสสัตว์เลี้ยง 🐾, ค่าหอพัก/คอนโด 🏠, วัยเรียน/ชีทสรุป 🎓, สายเกมเมอร์ & ไอที 🎮, ส่งให้ที่บ้าน 👨‍👩‍👧, ธุรกิจ/ค้าขาย 💼
  * **AI Lifestyle Recommendation:** Gemini AI วิเคราะห์พฤติกรรมเฉพาะของคุณ และแนะนำหมวดหมู่ใหม่ที่ตรงใจให้กดเพิ่มได้ทันที
* **3-Tier Categorization Flow:**
  1. **Tier 1 (Memory & Regex Rules):** ตรวจสอบจากประวัติที่ผู้ใช้เคยตั้งชื่อไว้ในเครื่อง (`localStorage`) และกฎร้านค้าพื้นฐาน
  2. **Tier 2 (Deduplicated AI Batch):** กรองเฉพาะชื่อร้านค้าที่ไม่ซ้ำกัน (`Set Deduplication`) ก่อนส่งไปให้ Gemini AI เพื่อประหยัดโควตาและลด Token การเรียก API ได้กว่า 70-80%
  3. **Tier 3 (Priority Review Queue):** ดึงรายการที่ไม่รู้จักมาเรียงจาก **ยอดเงินมากสุด $\rightarrow$ น้อยสุด** พร้อมแสดง **✨ คำใบ้จาก AI** เพื่อให้ระบุได้เสร็จในไม่กี่คลิก

### 2.3 Serverless Proxy & Seamless Fallback (`api/gemini.js`)
* เชื่อมต่อ Gemini API ผ่าน Vercel Serverless Function เพื่อซ่อน `GEMINI_API_KEY` ไว้ในเซิร์ฟเวอร์ ผู้ใช้ทั่วไปเข้าเว็บแล้วกดใช้ AI ได้ทันที
* หากไม่มี API Key หรือ AI ออฟไลน์ ระบบจะสลับไปใช้ **Smart Heuristic Rule Engine** ทันที เพื่อไม่ให้ประสบการณ์ผู้ใช้หยุดชะงัก

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
