/**
 * pdfParser.js
 * ระบบปลดล็อกรหัสผ่านไฟล์ PDF (Client-side PDF.js) และสกัดรายการจาก Statement ธนาคารกรุงเทพ
 * ออกแบบการรวมพิกัดแกน X/Y สำหรับภาษาไทยโดยเฉพาะ และตรวจสอบยอดคงเหลือ (Balance Check)
 */

window.TangHai = window.TangHai || {};

const THAI_COMBINING_REGEX = /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

window.TangHai.PDFParser = {
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

      // เรียงจากบนลงล่าง (Y มากไปน้อย)
      rawItems.sort((a, b) => b.y - a.y);

      // จัดกลุ่มบรรทัดด้วยระยะห่างแกน Y (Tolerance 4.5 pt เพื่อไม่ให้สระลอย/วรรณยุกต์ไทยหลุดบรรทัด)
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
            // เฉพาะในโซนคอลัมน์ Description (ด้านขวาของหน้ากระดาษ) ที่ภาษาไทยอาจถูกตัดแยกสระ/วรรณยุกต์
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
          allLines.push({ page: pageNum, text: cleanedLine });
        }
      }
    }

    return this.parseStatementLines(allLines, pdfDoc.numPages);
  },

  parseStatementLines(lineObjs, totalPages = 1) {
    const transactions = [];
    let openingBalance = null;
    let prevBalance = null;
    let accountName = '';
    let accountNo = '';
    let period = '';
    let bankName = '';

    // ด่านที่ 1: รูปแบบมาตรฐานที่มี Date Time Code Channel Amount Balance Description (SCB / BBL)
    const strictBankRegex = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s*(\d{2}:\d{2})\s*([A-Z0-9]{2,4})\s*([A-Z0-9]{2,6})\s*([+\-]?[\d,]+\.\d{2})\s*([\d,]+\.\d{2})\s*(.*)$/;

    // ด่านที่ 2: Universal Parser สำหรับธนาคารอื่นๆ (KBank, KTB, ttb, BAY) ที่เรียงคอลัมน์ต่างกันหรือไม่มีรหัส X1/X2
    const universalDateStartRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})(?:\s+(\d{2}:\d{2}))?\s+(.+)$/;
    const moneyTokensRegex = /[+\-]?[\d,]+\.\d{2}/g;

    const broughtForwardRegex = /(?:BALANCE\s*BROUGHT\s*FORWARD|ยอดเงินคงเหลือยกมา|ยอดยกมา).*?([\d,]+\.\d{2})/i;
    const periodRegex = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}\s*-\s*\d{2}[\/\-]\d{2}[\/\-]\d{4})/;
    const acctNoRegex = /\b(\d{3}-\d{1,6}-\d{1,5})\b/;

    let idx = 1;
    for (const lineObj of lineObjs) {
      const line = lineObj.text;

      if (!bankName) {
        if (/ไทยพาณิชย์|SIAM COMMERCIAL/i.test(line)) bankName = 'SCB';
        else if (/กสิกรไทย|KASIKORNBANK/i.test(line)) bankName = 'KBank';
        else if (/ธนาคารกรุงเทพ|BANGKOK BANK/i.test(line)) bankName = 'BBL';
        else if (/กรุงไทย|KRUNG THAI/i.test(line)) bankName = 'Krungthai';
        else if (/ทหารไทยธนชาต|TMBTHANACHART|TTB/i.test(line)) bankName = 'ttb';
        else if (/กรุงศรี|AYUDHYA|KRUNGSRI/i.test(line)) bankName = 'Krungsri';
      }

      if (!period && periodRegex.test(line)) period = line.match(periodRegex)[1];
      if (!accountNo && acctNoRegex.test(line)) accountNo = line.match(acctNoRegex)[1];
      if (!accountName && (line.includes('ชื่อ - สกุล') || line.startsWith('นาย ') || line.startsWith('นางสาว ') || line.startsWith('น.ส.'))) {
        const nameMatch = line.match(/(?:นาย|นางสาว|น\.ส\.|นาง)\s+[ก-๙]+\s+[ก-๙]+/);
        if (nameMatch) accountName = nameMatch[0].trim();
      }

      const bfMatch = line.match(broughtForwardRegex);
      if (bfMatch && openingBalance === null) {
        openingBalance = parseFloat(bfMatch[1].replace(/,/g, ''));
        prevBalance = openingBalance;
        continue;
      }

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

        transactions.push({
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
        });
        continue;
      }

      // Universal Fallback: ใช้สมการ Balance Delta (currBalance - prevBalance) แยกเงินเข้า/ออกได้ทุกธนาคาร
      const uniMatch = line.match(universalDateStartRegex);
      if (uniMatch) {
        const [, date, timeOrUndefined, restOfLine] = uniMatch;
        const moneyMatches = restOfLine.match(moneyTokensRegex);

        if (moneyMatches && moneyMatches.length >= 2) {
          const amountStr = moneyMatches[moneyMatches.length - 2];
          const balanceStr = moneyMatches[moneyMatches.length - 1];
          const amount = Math.abs(parseFloat(amountStr.replace(/,/g, '')));
          const balance = parseFloat(balanceStr.replace(/,/g, ''));

          const descClean = restOfLine.replace(amountStr, ' ').replace(balanceStr, ' ').replace(/\s+/g, ' ').trim();

          let isIncome = false;
          if (prevBalance !== null) {
            isIncome = Math.abs(prevBalance + amount - balance) < 0.05 || balance > prevBalance;
          } else {
            isIncome = amountStr.startsWith('+') || /รับโอน|ฝากเงิน|เงินเข้า|DEPOSIT/i.test(descClean);
          }
          prevBalance = balance;

          transactions.push({
            id: `tx-${idx++}`,
            page: lineObj.page,
            date,
            time: timeOrUndefined || '--:--',
            code: isIncome ? 'IN' : 'OUT',
            channel: bankName || 'BANK',
            debit: isIncome ? 0 : amount,
            credit: isIncome ? amount : 0,
            balance,
            description: descClean || 'รายการเดินบัญชี',
            userNote: '',
            rowCategoryOverride: null
          });
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
        bankName
      }
    };
  }
};
