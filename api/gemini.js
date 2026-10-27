/**
 * api/gemini.js
 * Vercel Serverless Function (Backend Proxy สำหรับเรียกใช้ Gemini 2.5 Flash)
 *
 * ประโยชน์:
 * 1. ผู้ใช้งานทุกคนที่เข้าผ่านลิงก์เว็บจริงสามารถกดใช้ "โหมด Gemini AI" ได้ทันทีโดยไม่ต้องกรอก API Key เอง
 * 2. ซ่อนค่า GEMINI_API_KEY ไว้ใน Environment Variables ฝั่ง Server ของ Vercel
 *    ทำให้คีย์ไม่ปรากฏบน GitHub และไม่รั่วไหลไปที่ Browser ของผู้ใช้
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในหน้า Environment Variables ของ Vercel'
    });
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ไม่พบรายการสำหรับวิเคราะห์' });
    }

    // จำกัดจำนวนรายการต่อ 1 คำขอ (ไม่เกิน 40 รายการที่ไม่ซ้ำกัน) เพื่อคุมโควตาและป้องกันการยิง API เกินขนาด
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
    const url = isVertexKey
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: isVertexKey
        ? { responseMimeType: 'application/json', temperature: 0.2 }
        : { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: `Gemini Upstream Error (${geminiRes.status})`
      });
    }

    const data = await geminiRes.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawJson);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
