/**
 * api/gemini.js
 * Vercel Serverless Function (Backend Proxy สำหรับเรียกใช้ Gemini API)
 *
 * สถาปัตยกรรมความปลอดภัย & ประโยชน์:
 * 1. ผู้ใช้ทุกคนที่เข้าเว็บผ่าน Live URL สามารถใช้โหมด Gemini AI ได้ทันทีโดยไม่ต้องใส่ API Key
 * 2. ซ่อนค่า GEMINI_API_KEY ไว้ใน Environment Variables ฝั่ง Server ของ Vercel
 * 3. มีระบบ Fallback ระหว่างโมเดล (Gemini 2.5 Flash -> Gemini 2.0 Flash -> Gemini 1.5 Flash)
 * 4. รองรับหมวดหมู่เฉพาะบุคคล (Personalized Custom Categories) และการแนะนำหมวดหมู่ตามไลฟ์สไตล์
 */

export default async function handler(req, res) {
  // รองรับ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Environment Variables ของ Vercel (โปรดใส่ Key ใน Vercel Dashboard Settings -> Environment Variables)'
    });
  }

  try {
    const { items, customCategories, promptOverride } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ไม่พบรายการสำหรับวิเคราะห์' });
    }

    // จำกัดจำนวนรายการต่อคำขอ (ไม่เกิน 40 รายการที่ไม่ซ้ำกัน) เพื่อคุมโควตาและประสิทธิภาพ
    const safeItems = items.slice(0, 40);

    let promptText = '';
    if (promptOverride && typeof promptOverride === 'string') {
      promptText = promptOverride;
    } else {
      const defaultCatDesc = [
        'FOOD (อาหารและเครื่องดื่ม)',
        'GROCERY (ของใช้/ของชำ/สะดวกซื้อ)',
        'TRANSPORT (การเดินทาง/รถไฟฟ้า/น้ำมัน)',
        'SHOPPING (ช้อปปิ้ง/ออนไลน์/เสื้อผ้า)',
        'EDUCATION_HEALTH (การศึกษา/ยา/คลินิก/สุขภาพ)',
        'BILLS (ค่าไฟ/ค่าเน็ต/ค่าหอ/บิล)',
        'WALLET (เติมเงิน e-Wallet)',
        'CASH_ATM (ถอนเงินสด)',
        'TRANSFER_PERSON (โอนให้บุคคล/เพื่อน/บุคคลธรรมดา)',
        'UNKNOWN (อื่นๆ)'
      ];

      if (Array.isArray(customCategories)) {
        for (const c of customCategories) {
          if (c && c.id && c.label) {
            defaultCatDesc.push(`${c.id} (${c.label})`);
          }
        }
      }

      promptText = `คุณคือผู้เชี่ยวชาญวิเคราะห์สเตทเมนต์ธนาคารไทย และระบบผู้ช่วยจัดหมวดหมู่การเงินส่วนบุคคลอัตโนมัติ (Automated Personal Finance Categorizer)
งานที่ 1: วิเคราะห์รายการใช้จ่ายต่อไปนี้ และเลือก category ที่ถูกต้องที่สุดจาก:
${defaultCatDesc.join(', ')}

เกณฑ์การตัดสินใจอย่างแม่นยำ (สำคัญมาก):
1. ดูชื่อผู้รับ (key), ยอดเงิน (amount) และเวลา (time) ประกอบกัน:
   - รายการที่เป็นชื่อร้านค้า, ตลาด, ข้าว, กาแฟ, ชา, ขนม หรือยอดโอน 25 - 200 บาท ในช่วงเวลามื้ออาหาร (07:00-09:30, 11:30-14:00, 17:30-21:30) แม้จะเป็นการโอน PromptPay ให้จัดเป็น "FOOD" (อาหารและเครื่องดื่ม)
   - ยอดโอนค่าที่พัก, ค่าหอพัก, อพาร์ตเมนต์, คอนโด, หรือค่าบิลรายเดือน (ปกติ 2,500 - 15,000 บาท ช่วงต้นเดือน/สิ้นเดือน หรือมีคำว่า เดอะเรสซิเดนซ์, หอพัก, คอนโด) ให้จัดเป็น "BILLS"
   - ยอดโอนค่าเดินทาง, รถไฟฟ้า, แท็กซี่, วินมอเตอร์ไซค์, น้ำมัน ให้จัดเป็น "TRANSPORT"
   - ยอดซื้อสินค้า, ช้อปปิ้ง, เสื้อผ้า, สั่งของออนไลน์ ให้จัดเป็น "SHOPPING"
   - ยอดค่าหนังสือ, ค่ายา, โรงพยาบาล, คลินิก ให้จัดเป็น "EDUCATION_HEALTH"
2. กรณีโอนเงินให้บุคคล (PromptPay หรือชื่อบุคคล):
   - ถ้าดูจากยอดเงินและเวลาแล้วเข้าข่ายค่าอาหาร ให้ระบุเป็น "FOOD" พร้อม hint เช่น "ค่าอาหาร/สแกนจ่ายร้านค้า"
   - ถ้าเป็นการโอนให้เพื่อน/บุคคลทั่วไปที่ไม่มีบริบทของค่าอาหาร/สินค้า/บริการ (เช่น โอนเลขกลมๆ คืนเงิน) จึงจัดเป็น "TRANSFER_PERSON" (โอนให้บุคคล)
3. รายการที่ไม่สามารถระบุได้จริงๆ ให้ใส่ "UNKNOWN" (อื่นๆ)

รายการที่ต้องวิเคราะห์:
${JSON.stringify(safeItems)}

งานที่ 2: วิเคราะห์พฤติกรรมการใช้จ่ายเฉพาะบุคคล (Personalized Spending Choices):
แนะนำหมวดหมู่ใหม่ที่ตรงกับไลฟ์สไตล์ของผู้ใช้นี้ 1-2 หมวดหมู่ใน "suggestedCustomCategories": [{"label": "ชื่อหมวดหมู่ที่แนะนำ", "reason": "เหตุผลสั้นๆ"}]

งานที่ 3: เขียนสรุปภาพรวมพฤติกรรมการเงินสั้นๆ 3 ข้อ (summaryBullets) เช่น สัดส่วนค่ากิน, ค่าที่พัก, หรือพฤติกรรมเด่น

ตอบกลับเป็น JSON เท่านั้น:
{
  "items": [{"key": "...", "category": "...", "hint": "..."}],
  "suggestedCustomCategories": [{"label": "...", "reason": "..."}],
  "summaryBullets": ["...", "...", "..."]
}`;
    }

    const isVertexKey = apiKey.startsWith('AQ.');
    const candidateModels = isVertexKey
      ? ['gemini-2.0-flash']
      : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    let lastError = null;
    let parsedData = null;

    for (const model of candidateModels) {
      try {
        const url = isVertexKey
          ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        };

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!geminiRes.ok) {
          const errBody = await geminiRes.text();
          lastError = `Gemini API (${model}) Error ${geminiRes.status}: ${errBody}`;
          if (geminiRes.status === 404 || geminiRes.status === 400) {
            continue;
          }
          break;
        }

        const data = await geminiRes.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        parsedData = JSON.parse(rawJson);
        break; // สำเร็จแล้ว
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!parsedData) {
      return res.status(502).json({
        error: `ไม่สามารถเรียก Gemini API ได้ (${lastError || 'Unknown Error'})`
      });
    }

    return res.status(200).json(parsedData);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
