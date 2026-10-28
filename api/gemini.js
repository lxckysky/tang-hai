/**
 * api/gemini.js
 * Vercel Serverless Function (Backend Proxy สำหรับเรียกใช้ Gemini API)
 *
 * สถาปัตยกรรมความปลอดภัย & ประโยชน์:
 * 1. ผู้ใช้ทุกคนที่เข้าเว็บผ่าน Live URL สามารถใช้โหมด Gemini AI ได้ทันทีโดยไม่ต้องใส่ API Key
 * 2. ซ่อนค่า GEMINI_API_KEY ไว้ใน Environment Variables ฝั่ง Server ของ Vercel
 *    ทำให้คีย์ไม่ปรากฏบน GitHub และไม่รั่วไหลไปยัง Client Browser
 * 3. มีระบบ Fallback ระหว่างโมเดล (Gemini 2.5 Flash -> Gemini 2.0 Flash -> Gemini 1.5 Flash)
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
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ไม่พบรายการสำหรับวิเคราะห์' });
    }

    // จำกัดจำนวนรายการต่อคำขอ (ไม่เกิน 40 รายการที่ไม่ซ้ำกัน) เพื่อคุมโควตาและประสิทธิภาพ
    const safeItems = items.slice(0, 40);

    const promptText = `คุณคือผู้เชี่ยวชาญวิเคราะห์สเตทเมนต์ธนาคารไทย
งานที่ 1: วิเคราะห์รายการโอนเงินต่อไปนี้ แล้วเดาหมวดหมู่และเขียนคำใบ้ภาษาไทยสั้นๆ (ไม่เกิน 7 คำ)
กฎสำคัญ:
- ถ้าเป็นชื่อบริษัท/ร้านค้า ให้เลือก category จาก [FOOD, GROCERY, TRANSPORT, SHOPPING, EDUCATION_HEALTH, BILLS, WALLET]
- ถ้าเป็นชื่อบุคคลล้วนๆ (เช่น นาย..., น.ส...., นาง...) ที่ไม่รู้ชื่อร้าน ให้ใส่ category เป็น "UNKNOWN" เสมอ (เพื่อให้เจ้าของระบุเอง) แต่เขียน hint ภาษาไทยช่วยเดาจากยอดเงินและเวลาโอน

รายการ: ${JSON.stringify(safeItems)}

งานที่ 2: เขียนสรุปภาพรวมการเงินสั้นๆ 3 ข้อ (summaryBullets)

ตอบกลับเป็น JSON เท่านั้น:
{"items":[{"key":"...","category":"...","hint":"..."}],"summaryBullets":["...","...","..."]}`;

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
          // ถ้าเป็น 404 (ไม่มีโมเดลนี้) หรือ 400 ให้ลองโมเดลถัดไป
          if (geminiRes.status === 404 || geminiRes.status === 400) {
            continue;
          }
          // ถ้าเป็น 403 (Permission Denied / Service Disabled) ให้หยุดและส่ง error ชัดเจน
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

    if (parsedData) {
      return res.status(200).json(parsedData);
    }

    return res.status(502).json({
      error: lastError || 'ไม่สามารถวิเคราะห์ข้อมูลจาก Gemini API ได้'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
