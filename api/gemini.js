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
งานที่ 1: วิเคราะห์รายการใช้จ่ายต่อไปนี้ และเลือก category ที่ตรงกับข้อเท็จจริงที่สุดจาก:
${defaultCatDesc.join(', ')}

เกณฑ์การตัดสินใจ (ห้ามเดาสุ่ม อิงจากข้อเท็จจริงในชื่อรายการเท่านั้น):
1. วิเคราะห์จากชื่อร้านค้า/ผู้รับ (key):
   - ถ้ามีชื่อร้านค้า, บริการ, บริษัท, แบรนด์ หรือคีย์เวิร์ดชัดเจน ให้จัดหมวดตามประเภทธุรกิจจริง (เช่น GRAB, 7-11, BTS, UNIQLO, NETFLIX, โรงพยาบาล)
   - ถ้าชื่อมีคำว่า หอพัก, คอนโด, เรสซิเดนซ์, การไฟฟ้า, ประปา, ค่าเน็ต ให้จัดเป็น "BILLS"
2. กรณีโอนเงินให้บุคคล (ชื่อ-นามสกุล บุคคลธรรมดา หรือ PromptPay):
   - ห้ามเดาเอาเองว่าเป็นค่าอาหารหรือค่าหอจากเวลาและยอดเงินเด็ดขาด เพราะไม่มีทางรู้ว่าโอนให้บุคคลนั้นด้วยเหตุผลใด
   - รายการที่เป็นชื่อบุคคลธรรมดา ให้จัดเป็น "TRANSFER_PERSON" (โอนให้บุคคล) เสมอ ยกเว้นชื่อนั้นจะมีคำระบุชัดเจนว่าเป็นร้านค้า
3. ถ้ารายการใดไม่สามารถระบุได้จริงๆ จากชื่อ ให้ใส่ "UNKNOWN" (อื่นๆ) เพื่อให้ผู้ใช้ระบุเอง

รายการที่ต้องวิเคราะห์:
${JSON.stringify(safeItems)}

งานที่ 2: สรุปภาพรวมพฤติกรรมการเงินสั้นๆ 3 ข้อ (summaryBullets) จากข้อมูลที่มีจริง (ห้ามกุเรื่อง)

ตอบกลับเป็น JSON เท่านั้น:
{
  "items": [{"key": "...", "category": "...", "hint": "..."}],
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
