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
1. "จ่ายบิล ..." หมายความว่าจ่ายเงินให้ธุรกิจ/ร้านค้า/บริษัท ไม่ใช่บุคคล ให้วิเคราะห์ชื่อหลัง "จ่ายบิล" แล้วจัดหมวดตามประเภทธุรกิจ:
   - จ่ายบิล + ชื่อร้านอาหาร (เช่น โออิชิ, หมาล่า, ราเมน, ก๋วยเตี๋ยว) → FOOD
   - จ่ายบิล + ปตท / พีทีที / PTT / OIL / STATION / น้ำมัน → TRANSPORT
   - จ่ายบิล + นิติบุคคล / อาคารชุด / คอนโด / ค่าส่วนกลาง → BILLS
   - จ่ายบิล + ชื่อบริษัท (บจก. / จำกัด / LTD) → วิเคราะห์ธุรกิจหลักของบริษัทนั้น
2. วิเคราะห์จากชื่อร้านค้า/ผู้รับ ใช้ความรู้เกี่ยวกับธุรกิจจริงในไทย:
   - PTT, ปตท, พีทีที, BANGCHAK, บางจาก, SHELL, CALTEX, SUSCO, RITTIDOL OIL → TRANSPORT
   - โออิชิ, หมาล่า, MK, ชาบู, ราเมน, RAMEN, ก๋วยเตี๋ยว, ข้าว, SUSHI, PIZZA → FOOD
   - BTS, MRT, GRAB, Bolt, รถไฟ, ทางด่วน → TRANSPORT
   - นิติบุคคลอาคารชุด, ส่วนกลาง, หอพัก, คอนโด, CONDO → BILLS
   - การไฟฟ้า, ประปา, AIS, TRUE, DTAC, NETFLIX, SPOTIFY → BILLS
3. "โอนไป SCB/KBNK/KTB + ชื่อนิติบุคคล/บริษัท" → จัดหมวดตามประเภทธุรกิจนั้น (ไม่ใช่ TRANSFER_PERSON)
4. กรณีโอนเงินให้บุคคลธรรมดา (ชื่อ-นามสกุลจริง ไม่ใช่ชื่อร้านค้า หรือ PromptPay ไม่ระบุปลายทาง):
   - ใช้ TRANSFER_PERSON เท่านั้น ห้ามเดาว่าเป็นค่าอาหารหรือค่าหอ
5. ถ้าไม่สามารถระบุได้จากชื่อ ใส่ UNKNOWN

**สำคัญ**: ก่อนตอบ UNKNOWN ให้ใช้ความรู้เกี่ยวกับบริษัทจดทะเบียน (SET/MAI), แบรนด์ไทย, และธุรกิจทั่วไปในประเทศไทยเพื่อระบุประเภท ถ้ายังไม่แน่ใจ ให้ค้นหาข้อมูลเพิ่มเติมก่อน

รายการที่ต้องวิเคราะห์:
${JSON.stringify(safeItems)}

งานที่ 2: สรุปภาพรวมพฤติกรรมการเงินสั้นๆ 3 ข้อ (summaryBullets) จากข้อมูลที่มีจริง (ห้ามกุเรื่อง)

ตอบกลับเป็น JSON เท่านั้น (ไม่มีข้อความอื่น ไม่มี markdown):
{"items":[{"key":"...","category":"...","hint":"..."}],"summaryBullets":["...","...","..."]}`;
    }

    const isVertexKey = apiKey.startsWith('AQ.');
    const candidateModels = isVertexKey
      ? ['gemini-2.0-flash']
      : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    // ตรวจว่ามีรายการที่เป็น "ชื่อบริษัทไม่รู้จัก" หรือเปล่า
    // ถ้ามี → เปิด Google Search Grounding ให้ Gemini ค้นหาข้อมูลก่อนตอบ
    const hasUnknownCompany = safeItems.some(item => {
      const k = (item.key || '').toUpperCase();
      return k.includes('COMPANY') || k.includes('LIMITED') || k.includes('บจก') ||
             k.includes('PUBLIC') || k.includes('LTD') || k.includes('PART.');
    });

    let lastError = null;
    let parsedData = null;

    for (const model of candidateModels) {
      try {
        const url = isVertexKey
          ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        // เปิด Google Search Grounding เมื่อมีชื่อบริษัทที่ไม่คุ้นเคย
        // และใช้ gemini-2.0-flash ขึ้นไปเท่านั้น (1.5 flash ไม่รองรับ google_search tool)
        const supportsGrounding = !isVertexKey && (model === 'gemini-2.5-flash' || model === 'gemini-2.0-flash');
        const useGrounding = hasUnknownCompany && supportsGrounding;

        const payload = useGrounding
          ? {
              // Grounding mode: ค้น Google ก่อนตอบ — ไม่ใช้ responseMimeType (incompatible with tools)
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              tools: [{ google_search: {} }],
              generationConfig: { temperature: 0.2 }
            }
          : {
              // Standard mode: ตอบ JSON โดยตรง
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
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
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        if (useGrounding) {
          // Grounding response เป็น text ธรรมดา — ดึง JSON block ออกมา
          const jsonMatch = rawText.match(/\{[\s\S]*"items"[\s\S]*\}/);
          parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);
        } else {
          parsedData = JSON.parse(rawText);
        }
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
