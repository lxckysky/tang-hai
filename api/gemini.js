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

เกณฑ์การตัดสินใจ (อิงจากข้อเท็จจริงในชื่อรายการและบริบทธุรกิจไทย):
1. รายการที่มีคำว่า "จ่ายบิล" หรือชำระเงินให้ร้านค้า/บริษัท:
   - "หนึ่ง นม นัว", "นมสด", "ขนมหวาน", "บิงซู", "เบเกอรี่" → FOOD (ของหวาน/เครื่องดื่ม)
   - "หมาล่า", "หมาล่าฮับ", "หม้อไฟ", "ชาบู", "สุกี้", "โออิชิ", "ราเมน" → FOOD (ร้านอาหาร)
   - "ข้าวเหนียว", "มหาเฮง", "ร้านค้าออมสิน", "ตามสั่ง", "ก๋วยเตี๋ยว" → FOOD (อาหารสตรีทฟู้ด)
   - "JENKONGKLAI", "เจนก้องไกล", "JPARK", "ที่จอดรถ" → TRANSPORT (บริหารจัดการที่จอดรถ)
   - "GCOO", "BEAM", "SCOOTER", "สกู๊ตเตอร์" → TRANSPORT (ยานพาหนะเดินทางระยะสั้น)
   - "PTT", "ปตท", "พีทีที", "RITTIDOL OIL", "BANGCHAK", "บางจาก", "CALTEX", "SHELL", "น้ำมัน" → TRANSPORT (สถานีบริการน้ำมัน)
   - "SF CINEMA", "เอส เอฟ ซีเนม่า", "MAJOR CINEPLEX", "เมเจอร์", "ซีเนม่า", "โรงภาพยนตร์" → SHOPPING (บันเทิง/ชมภาพยนตร์)
   - "CONSORTIUM OF THAI MEDICA", "MEDICA", "MEDICAL", "อัลติเมด", "คลินิก", "โรงพยาบาล", "ร้านยา" → EDUCATION_HEALTH (สุขภาพ/เวชภัณฑ์)
   - "นิติบุคคลอาคารชุด", "ไอดีโอ", "IDEO", "คอนโด", "หอพัก", "ค่าส่วนกลาง", "การไฟฟ้า", "ประปา" → BILLS (ค่าใช้จ่ายที่อยู่อาศัย/บิล)
2. ธุรกิจและบริษัททั่วไป (บจก. / จำกัด / PUBLIC COMPANY / LTD):
   - ให้วิเคราะห์ประเภทธุรกิจหลักจากชื่อบริษัท อย่าตอบ UNKNOWN ทันที ให้คิดตามประเภทธุรกิจจริงในประเทศไทย
3. โอนเงินให้บุคคลธรรมดา (ชื่อ-นามสกุลจริง บุคคลทั่วไป):
   - ให้จัดเป็น TRANSFER_PERSON เท่านั้น
4. ถ้ารายการใดไม่สามารถระบุได้จริงๆ ให้ใส่ UNKNOWN

รายการที่ต้องวิเคราะห์:
${JSON.stringify(safeItems)}

งานที่ 2: สรุปภาพรวมพฤติกรรมการเงินสั้นๆ 3 ข้อ (summaryBullets) จากข้อมูลที่มีจริง (ห้ามกุเรื่อง)

ตอบกลับเป็น JSON เท่านั้น:
{"items":[{"key":"...","category":"...","hint":"..."}],"summaryBullets":["...","...","..."]}`;
    }

    const candidateModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

    const hasUnknownCompany = safeItems.some(item => {
      const k = ((item.key || '') + ' ' + (item.desc || '')).toUpperCase();
      return k.includes('COMPANY') || k.includes('LIMITED') || k.includes('บจก') ||
             k.includes('PUBLIC') || k.includes('LTD') || k.includes('PART.');
    });

    let lastError = null;
    let parsedData = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const supportsGrounding = (model === 'gemini-2.0-flash' || model === 'gemini-2.5-flash');
        const useGrounding = hasUnknownCompany && supportsGrounding;

        const payload = useGrounding
          ? {
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.2 }
            }
          : {
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
            };

        let geminiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        });

        // ถ้าเรียกแบบมี Google Search Tool แล้วติด 400 ให้ retry แบบ standard json ทันที
        if (!geminiRes.ok && useGrounding && (geminiRes.status === 400 || geminiRes.status === 404)) {
          geminiRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
            })
          });
        }

        if (!geminiRes.ok) {
          const errBody = await geminiRes.text();
          lastError = `Gemini API (${model}) Error ${geminiRes.status}: ${errBody}`;
          // ถ้า 429 (โควตาโมเดลเต็ม), 404, 400 หรือ 503 -> สลับไปลองโมเดลถัดไปทันที
          if (geminiRes.status === 429 || geminiRes.status === 404 || geminiRes.status === 400 || geminiRes.status === 503) {
            continue;
          }
          break;
        }

        const data = await geminiRes.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const allText = parts.map(p => p.text || '').filter(Boolean).join('\n');
        let cleaned = allText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*"items"[\s\S]*\}/);
        parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
        break;
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
