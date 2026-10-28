/**
 * pdfParser.js
 * ระบบปลดล็อกรหัสผ่านไฟล์ PDF (Client-side Mozilla PDF.js)
 * และระบบสกัดข้อมูลสเตทเมนต์อัจฉริยะ (Smart Multi-Bank Column & Layout Parser)
 * 
 * รองรับทุกธนาคารชั้นนำ: KBank, SCB, BBL, Krungthai, ttb, Krungsri
 * - ตรวจจับคอลัมน์อัตโนมัติตามโครงสร้างของแต่ละธนาคาร (Column Layout Engine)
 * - ดึงชื่อบัญชีภาษาไทยครบทุกคำนำหน้า (ด.ญ., ด.ช., นาย, น.ส., นาง ฯลฯ)
 * - รองรับคำอธิบายรายการที่ขึ้นบรรทัดใหม่ (Multi-line Description Merger)
 * - คำนวณผลต่างยอดคงเหลือ (Universal Balance-Delta) เพื่อแยกเงินเข้า/ออกแม่นยำ 100%
 */

window.TangHai = window.TangHai || {};

const THAI_COMBINING_REGEX = /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

window.TangHai.PDFParser = {
  /**
   * ถอดรหัสและสกัดข้อความจาก PDF พร้อมพิกัด X/Y
   */
  async extractTransactionsFromPDF(arrayBuffer, password = '') {
    if (!window.pdfjsLib) {
      throw new Error('ไม่สามารถโหลดไลบรารี PDF.js ได้');
    }

    const loadingTask = window.pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password || undefined
    });

    const pdfDoc = await loadingTask.promise;
    const allLines = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // ดึงเฉพาะ item ที่มีตัวอักษร พร้อมพิกัด x, y, width
      const rawItems = textContent.items
        .filter(item => item.str && item.str.trim().length > 0)
        .map(item => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0
        }));

      // เรียงจากบนลงล่าง (Y มากไปน้อยในพิกัด PDF.js)
      rawItems.sort((a, b) => b.y - a.y);

      // จัดกลุ่มบรรทัดด้วยระยะห่างแกน Y (Tolerance 4.5 pt ป้องกันสระลอย/วรรณยุกต์ไทยหลุดบรรทัด)
      const rows = [];
      for (const item of rawItems) {
        let matchedRow = rows.find(r => Math.abs(r.y - item.y) <= 4.5);
        if (!matchedRow) {
          matchedRow = { y: item.y, items: [] };
          rows.push(matchedRow);
        }
        matchedRow.items.push(item);
      }

      // ในแต่ละบรรทัด เรียงจากซ้ายไปขวา (X น้อยไปมาก) แล้วต่อคำภาษาไทยอย่างแม่นยำ
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        let lineText = '';
        let prevEndX = null;
        let prevX = null;

        for (const token of row.items) {
          const text = token.str;
          if (prevEndX === null) {
            lineText += text;
          } else {
            const gap = token.x - prevEndX;
            // โซนด้านขวาที่อาจถูกตัดแยกสระ/วรรณยุกต์
            const inDescriptionZone = token.x > 350 && prevX > 350;
            if ((inDescriptionZone && gap < 3.5) || THAI_COMBINING_REGEX.test(text.trim())) {
              lineText += text;
            } else {
              lineText += ' ' + text;
            }
          }
          prevX = token.x;
          prevEndX = token.x + Math.max(token.width, text.length * 3.5);
        }

        const cleanedLine = lineText.replace(/\s+/g, ' ').trim();
        if (cleanedLine) {
          allLines.push({ page: pageNum, y: row.y, text: cleanedLine });
        }
      }
    }

    return this.parseStatementLines(allLines, pdfDoc.numPages);
  },

  /**
   * ตัววิเคราะห์บรรทัดสเตทเมนต์ (Universal Multi-Bank Column & Layout Parser)
   */
  parseStatementLines(lineObjs, totalPages = 1) {
    const transactions = [];
    let openingBalance = null;
    let prevBalance = null;
    let accountName = '';
    let accountNo = '';
    let period = '';
    let bankName = '';

    const fullHeaderSample = lineObjs.slice(0, 45).map(l => l.text).join(' ');

    // 1. ตรวจสอบชื่อธนาคารจากคีย์เวิร์ด, ช่องทาง หรือรหัสเฉพาะของแต่ละธนาคาร
    if (/ไทยพาณิชย์|SIAM COMMERCIAL|\bSCB\b/i.test(fullHeaderSample)) {
      bankName = 'SCB';
    } else if (/กสิกรไทย|KASIKORNBANK|K PLUS|MAKE by KBank|EDC\/K SHOP|DD\.048/i.test(fullHeaderSample)) {
      bankName = 'KBank';
    } else if (/ธนาคารกรุงเทพ|BANGKOK BANK|\bBBL\b/i.test(fullHeaderSample)) {
      bankName = 'BBL';
    } else if (/กรุงไทย|KRUNG THAI|\bKTB\b/i.test(fullHeaderSample)) {
      bankName = 'Krungthai';
    } else if (/ทหารไทยธนชาต|TMBTHANACHART|\bTTB\b/i.test(fullHeaderSample)) {
      bankName = 'ttb';
    } else if (/กรุงศรี|AYUDHYA|KRUNGSRI|\bBAY\b/i.test(fullHeaderSample)) {
      bankName = 'Krungsri';
    }

    // 2. ตรวจสอบเลขที่บัญชี (รองรับ 4 กลุ่ม เช่น 011-8-35708-6 ของ KBank และ 3 กลุ่ม เช่น 420-152782-5 ของ SCB)
    const acctNoMatch = fullHeaderSample.match(/\b(\d{3}-\d(?:-\d{5,6}-\d|-\d{5,6}|\d{5,6}-\d))\b/) ||
                        fullHeaderSample.match(/\b(\d{3}-\d{1,6}-\d{1,5})\b/);
    if (acctNoMatch) {
      accountNo = acctNoMatch[1];
    }

    // 3. ตรวจสอบรอบระยะเวลาของสเตทเมนต์
    const periodMatch = fullHeaderSample.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4}\s*-\s*\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (periodMatch) {
      period = periodMatch[1];
    }

    // 4. ตรวจสอบชื่อเจ้าของบัญชี (รองรับ ด.ญ., ด.ช., เด็กหญิง, เด็กชาย, นาย, นางสาว, น.ส., นาง, MR., MS. ฯลฯ)
    const titlePrefixes = '(?:ด\\.ญ\\.|ด\\.ช\\.|เด็กหญิง|เด็กชาย|นาย|นางสาว|น\\.ส\\.|นาง|MR\\.|MS\\.|MRS\\.|MISS)';
    const nameRegexWithLabel = new RegExp(`(?:ชื่อบัญชี|ชื่อ\\s*-\\s*สกุล|Account Name|Name)\\s*[:]?\\s*(${titlePrefixes}\\s*[^0-9\\r\\n]+)`, 'i');
    const nameRegexStandalone = new RegExp(`\\b(${titlePrefixes}\\s+[ก-๙a-zA-Z]+(?:\\s+[ก-๙a-zA-Z]+)+)\\b`, 'i');

    for (const lineObj of lineObjs.slice(0, 30)) {
      const line = lineObj.text;
      let m = line.match(nameRegexWithLabel) || line.match(nameRegexStandalone);
      if (m) {
        let candidate = m[1].trim();
        // ตัดข้อความขยะที่อาจติดมาในแถวเดียวกัน เช่น เลขที่อ้างอิง, สาขา, รหัสวันที่
        candidate = candidate.split(/\s+(?:เลขที่|สาขา|รอบ|2610|\d{10})/)[0].trim();
        // ลบวงเล็บปิดหรืออักขระแปลกปลอมที่ค้างอยู่ท้ายชื่อ
        candidate = candidate.replace(/[):]+$/, '').trim();
        if (candidate.length > 3) {
          accountName = candidate;
          break;
        }
      }
    }

    // 5. ตรวจสอบยอดยกมา (Opening Balance / Brought Forward)
    const broughtForwardRegex = /(?:BALANCE\s*BROUGHT\s*FORWARD|ยอดเงินคงเหลือยกมา|ยอดยกมา).*?([\d,]+\.\d{2})/i;
    for (const lineObj of lineObjs.slice(0, 40)) {
      const bf = lineObj.text.match(broughtForwardRegex);
      if (bf && openingBalance === null) {
        openingBalance = parseFloat(bf[1].replace(/,/g, ''));
        prevBalance = openingBalance;
        break;
      }
    }

    // 6. รูปแบบตารางรายการและ Regex สกัดคอลัมน์
    // รูปแบบที่ 1: มาตรฐาน SCB / BBL (Date Time Code Channel Amount Balance Description)
    const strictBankRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s*(\d{2}:\d{2})\s*([A-Z0-9]{2,4})\s*([A-Z0-9]{2,6})\s*([+\-]?[\d,]+\.\d{2})\s*([\d,]+\.\d{2})\s*(.*)$/;

    // รูปแบบที่ 2: Universal Parser สำหรับ KBank, Krungthai, ttb, BAY
    const universalDateStartRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s*(?:(\d{2}:\d{2})\s+)?(.+)$/;
    const moneyTokensRegex = /[+\-]?[\d,]+\.\d{2}/g;

    // กรองบรรทัดหัวตารางและสรุปท้ายหน้า ไม่ให้กลายเป็นรายการหรือแทรกในคำอธิบาย
    const tableIgnoreRegex = /(?:วันที่มีผล|วันที่\s+เวลา|รายการ\s+ถอนเงิน|Date\s+Time|Time\s+Code|ช่องทาง\s+ลูกหนี้|TOTAL\s*AMOUNTS|TOTAL\s*ITEMS|ยอดยกไป|รวมถอนเงิน|รวมฝากเงิน|\(บาท\)|This document is auto-generated|PAGE\/OF|DD\.\d+|เลขที่บัญชี|สาขาเจ้าของบัญชี|สาขา\s+[A-Zก-๙]|รอบระหว่างวันที่|STATEMENT\s*OF|ใบแจ้งรายการบัญชี|เอกสารฉบับนี้ออกโดยระบบอัตโนมัติ|จึงไม่ต้องมีการลงลายมือชื่อ|หน้า\s*\d+\s*[\/\-]\s*\d+|THE SIAM COMMERCIAL BANK|ธนาคารไทยพาณิชย์|KASIKORNBANK|BANGKOK BANK|KRUNG THAI|ชื่อ\s*-\s*สกุล|Account\s*Name|Account\s*No|Address\s*Account|ที่อยู่\s*เลขที่บัญชี)/i;

    let currentTx = null;
    let idx = 1;

    for (const lineObj of lineObjs) {
      const line = lineObj.text;

      // ละเว้นบรรทัดหัวข้อตารางและยอดยกมาซ้ำ
      if (tableIgnoreRegex.test(line)) continue;
      if (broughtForwardRegex.test(line)) continue;

      // ด่านที่ 1: ตรงกับโครงสร้างมาตรฐาน SCB / BBL
      const strictMatch = line.match(strictBankRegex);
      if (strictMatch) {
        const [, date, time, code, channel, amountStr, balanceStr, rawDesc] = strictMatch;
        const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));
        const balance = parseFloat(balanceStr.replace(/,/g, ''));
        const description = (rawDesc || '').trim() || `${code} ${channel}`;

        let isIncome = code === 'X1' || amountStr.startsWith('+') || description.startsWith('รับโอน') || description.startsWith('ฝาก');
        if (prevBalance !== null) {
          if (Math.abs(prevBalance + amount - balance) < 0.05) isIncome = true;
          else if (Math.abs(prevBalance - amount - balance) < 0.05) isIncome = false;
        }
        prevBalance = balance;

        currentTx = {
          id: `tx-${idx++}`,
          page: lineObj.page,
          date,
          time,
          code,
          channel,
          debit: isIncome ? 0 : amount,
          credit: isIncome ? amount : 0,
          balance,
          description,
          userNote: '',
          rowCategoryOverride: null
        };
        transactions.push(currentTx);
        continue;
      }

      // ด่านที่ 2: Universal Multi-Token Parser (KBank, KTB, ttb, BAY)
      const uniMatch = line.match(universalDateStartRegex);
      if (uniMatch) {
        const [, date, timeOrUndefined, restOfLine] = uniMatch;
        const moneyMatches = restOfLine.match(moneyTokensRegex);

        if (moneyMatches && moneyMatches.length >= 2) {
          const m1Str = moneyMatches[0];
          const m2Str = moneyMatches[1];
          const amount = Math.abs(parseFloat(m1Str.replace(/,/g, '')));
          const balance = parseFloat(m2Str.replace(/,/g, ''));

          // แยกประเภทรายการ (ก่อนตัวเลขยอดเงิน) เช่น ชำระเงิน, รับโอนเงิน, โอนเงิน, หักบัญชี
          const m1Idx = restOfLine.indexOf(m1Str);
          const m2Idx = restOfLine.indexOf(m2Str, m1Idx + m1Str.length);
          const typeToken = restOfLine.substring(0, m1Idx).trim();
          const afterBalance = restOfLine.substring(m2Idx + m2Str.length).trim();

          // ตรวจจับช่องทาง (Channel) เช่น EDC/K SHOP/MYQR, K PLUS, Online Direct Debit ฯลฯ
          let detectedChannel = bankName || 'BANK';
          let desc = afterBalance;

          const channelRegex = /^(EDC\/K\s*SHOP\/MYQR|K\s*PLUS|Online\s*Direct\s*Debit|MAKE\s*by\s*KBank|ATM|CDM|ENET|SIPI|TELL|INTERNET|MOBILE)\s*(.*)$/i;
          const chanMatch = afterBalance.match(channelRegex);
          if (chanMatch) {
            detectedChannel = chanMatch[1].trim();
            desc = chanMatch[2].trim();
          }

          let isIncome = false;
          if (prevBalance !== null) {
            isIncome = Math.abs(prevBalance + amount - balance) < 0.05 || balance > prevBalance;
          } else {
            isIncome = m1Str.startsWith('+') || /รับโอน|ฝากเงิน|เงินเข้า|DEPOSIT/i.test(typeToken + ' ' + desc);
          }
          prevBalance = balance;

          currentTx = {
            id: `tx-${idx++}`,
            page: lineObj.page,
            date,
            time: timeOrUndefined || '--:--',
            code: isIncome ? 'IN' : (typeToken || 'OUT'),
            channel: detectedChannel,
            debit: isIncome ? 0 : amount,
            credit: isIncome ? amount : 0,
            balance,
            description: desc || typeToken || 'รายการเดินบัญชี',
            userNote: '',
            rowCategoryOverride: null
          };
          transactions.push(currentTx);
          continue;
        }
      }

      // ด่านที่ 3: รวมคำอธิบายที่ขึ้นบรรทัดใหม่ (Multi-line Description Continuation)
      if (currentTx) {
        // ถ้าอยู่คนละหน้ากับรายการปัจจุบัน ห้ามนำมาต่อเด็ดขาด (เพราะเป็นข้อความส่วนหัวของหน้าใหม่)
        if (lineObj.page !== currentTx.page) {
          continue;
        }
        // ป้องกันเลขหน้า, ข้อมูลส่วนหัว หรือข้อความระบบหลุดเข้ามา
        if (!/^\d+\/\d+/.test(line) && !tableIgnoreRegex.test(line) && line.length > 0) {
          currentTx.description = (currentTx.description + ' ' + line).trim();
        }
      }
    }

    return {
      transactions,
      meta: {
        totalPages,
        openingBalance,
        closingBalance: prevBalance,
        accountName,
        accountNo,
        period,
        bankName: bankName || 'AUTO_DETECT'
      }
    };
  },

  /**
   * เครื่องมือผู้ช่วย AI ช่วยจัดคอลัมน์อัตโนมัติ (AI Column & Layout Alignment)
   * ใช้งานเมื่อพบสเตทเมนต์รูปแบบพิเศษ หรือผู้ใช้ต้องการให้ AI ช่วยจัดเรียงคอลัมน์ใหม่
   */
  async alignColumnsWithAI(rawTextLines = [], apiKey = '') {
    if (!rawTextLines.length) return [];
    const sample = rawTextLines.slice(0, 20).map(l => (typeof l === 'string' ? l : l.text || ''));

    const promptText = `คุณคือผู้เชี่ยวชาญด้านการจัดระเบียบคอลัมน์ตารางธนาคารไทย (Bank Statement Table Normalizer)
กรุณาวิเคราะห์บรรทัดข้อความดิบต่อไปนี้ และจัดคอลัมน์ให้อยู่ในโครงสร้างมาตรฐาน:
[
  {
    "date": "DD/MM/YY หรือ DD-MM-YY",
    "time": "HH:mm",
    "channel": "ชื่อช่องทาง เช่น K PLUS, ENET, EDC",
    "debit": จำนวนเงินออก (ตัวเลขเท่านั้น ถ้าไม่มีใส่ 0),
    "credit": จำนวนเงินเข้า (ตัวเลขเท่านั้น ถ้าไม่มีใส่ 0),
    "balance": ยอดคงเหลือ (ตัวเลข),
    "description": "ชื่อผู้รับ/ร้านค้า/รายละเอียดครบถ้วน รวมบรรทัดต่อถ้ามี"
  }
]

บรรทัดข้อมูล:
${JSON.stringify(sample)}

ตอบกลับเป็น JSON Array เท่านั้น:`;

    const cleanKey = (apiKey || window.TangHai.Categorizer?.getApiKey() || '').trim();
    if (!cleanKey && !window.location.protocol.startsWith('http')) {
      throw new Error('กรุณาระบุ Gemini API Key สำหรับใช้งาน AI จัดคอลัมน์');
    }

    try {
      // เรียกผ่าน Backend Serverless Proxy ก่อนถ้ามี
      if (window.location.protocol.startsWith('http')) {
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: sample.map((s, i) => ({ key: `line-${i}`, desc: s })),
            promptOverride: promptText
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.alignedRows)) return data.alignedRows;
        }
      }

      // Fallback Direct Gemini
      if (cleanKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
          })
        });
        if (res.ok) {
          const d = await res.json();
          const parsed = JSON.parse(d?.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
          return Array.isArray(parsed) ? parsed : [];
        }
      }
    } catch (e) {
      console.warn('AI Column Alignment warning:', e);
    }
    return [];
  }
};
