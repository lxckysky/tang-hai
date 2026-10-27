/**
 * categorizer.js
 * ระบบจัดหมวดหมู่ 3 ชั้น + อัลกอริทึมตรวจจับรายการโอนบัญชีตัวเอง & หารค่าใช้จ่ายกับเพื่อน (Split/Pass-Through Detector)
 */

window.TangHai = window.TangHai || {};

const MERCHANT_AI_RULES = [
  {
    keywords: [
      'MINOR FOOD', 'ไมเนอร์ ฟู้ด', 'อีสาน', 'แซ่บ', 'ข้าวยาย', 'ไส้กรอก',
      'ร้านเบอร์ 5', 'ร้านเบอร์สอง', 'ตึกจุล', 'ข้าวแกง', 'ป้ารี',
      'YI JIA MALA', 'MALA SUKI', '1592-KFC', 'KFC', 'WONGNAI',
      'อาหาร', 'กาแฟ', 'ชาบู', 'MK ', 'STARBUCKS', 'CAFE', 'FOOD', 'PIZZA'
    ],
    category: 'FOOD'
  },
  {
    keywords: [
      'สหกรณ์จุฬา', 'TOPS-C2B', 'TOPS', 'BIGC', 'BIG C',
      'เวนดิ้ง', 'บุญเติม', 'จิฟฟี่', 'JIFFY', '7-ELEVEN', 'CP ALL', 'LAWSON'
    ],
    category: 'GROCERY'
  },
  {
    keywords: ['เอ็มอาร์ที', 'MRT', 'ทางด่วนและรถไฟฟ้า', 'BTS', 'BEM'],
    category: 'TRANSPORT'
  },
  {
    keywords: ['CHULALONGKORN UNIVERSITY BOOK', 'BOOK CE', 'MAKALIN CLINIC', 'CLINIC', 'HOSPITAL', 'PHARMACY'],
    category: 'EDUCATION_HEALTH'
  },
  {
    keywords: ['TIKTOK SHOP', 'OMISE', 'SHOPEE', 'LAZADA', 'ยูนิโคล่', 'UNIQLO', 'ยูอาร์เดอะ', 'PINEHURST', 'LIANLIAN', 'อัลติเมต'],
    category: 'SHOPPING'
  },
  {
    keywords: ['METROPOLITAN ELECTRICITY', 'การไฟฟ้า', 'PEA', 'MEA', 'ประปา', 'AIS POSTPAID', 'AIS FIBRE', 'TRUE MOVE', 'DTAC', 'NETFLIX'],
    category: 'BILLS'
  },
  {
    keywords: ['SIPS TRUE MONEY', 'TRUE MONEY', 'K PLUS W', 'LINE PAY', 'WIDx', 'เติมเงิน'],
    category: 'WALLET'
  }
];

function extractOwnerCoreName(accountName = '') {
  return accountName.replace(/^(?:นาย|นางสาว|น\.ส\.|นาง)\s+/i, '').trim();
}

window.TangHai.Categorizer = {
  analyzeTransactions(rawTransactions, meta = {}) {
    let memoryHits = 0;
    let ruleHits = 0;
    const unknownSet = new Set();
    const ownerCoreName = extractOwnerCoreName(meta.accountName || '');

    const insights = this.detectSplitsAndPassThroughs(rawTransactions, ownerCoreName);
    const passThroughIds = new Set(insights.passThroughTxIds);
    const splitNoteById = insights.splitNoteById;

    const stageOneList = rawTransactions.map(tx => {
      const desc = tx.description || '';
      const normKey = window.TangHai.MemoryStore.normalizeKey(desc);
      const autoHint = splitNoteById[tx.id] || '';

      if (tx.rowCategoryOverride) {
        memoryHits++;
        return {
          ...tx,
          normKey,
          autoHint,
          category: tx.rowCategoryOverride,
          source: 'MEMORY',
          sourceLabel: 'แก้ไขเฉพาะรายการ',
          needsReview: false
        };
      }

      if (tx.code === 'X1' || tx.credit > 0) {
        ruleHits++;
        const isFromSelf = ownerCoreName && desc.includes(ownerCoreName);
        return {
          ...tx,
          normKey,
          autoHint,
          category: 'INCOME',
          source: 'RULE',
          sourceLabel: isFromSelf ? 'โอนเข้าจากบัญชีตัวเอง' : 'รหัสเงินเข้า (X1)',
          needsReview: false
        };
      }

      if ((ownerCoreName && desc.includes(ownerCoreName)) || passThroughIds.has(tx.id)) {
        ruleHits++;
        return {
          ...tx,
          normKey,
          autoHint,
          category: 'SELF_TRANSFER',
          source: 'RULE',
          sourceLabel: ownerCoreName && desc.includes(ownerCoreName) ? 'โอนไปบัญชีชื่อตัวเอง' : 'เงินผ่านบัญชี (เข้า-ออกตรงกัน)',
          needsReview: false
        };
      }

      if (tx.channel === 'CDM' || desc.toUpperCase().includes('CARDLESS ATM')) {
        ruleHits++;
        return {
          ...tx,
          normKey,
          autoHint,
          category: 'CASH_ATM',
          source: 'RULE',
          sourceLabel: 'กดเงินสด ATM',
          needsReview: false
        };
      }

      const memoryMatch = window.TangHai.MemoryStore.findMatch(desc);
      if (memoryMatch) {
        memoryHits++;
        return {
          ...tx,
          normKey,
          autoHint,
          category: memoryMatch.category,
          userNote: tx.userNote || memoryMatch.alias,
          source: 'MEMORY',
          sourceLabel: `จำชื่อร้าน: ${memoryMatch.alias}`,
          needsReview: false
        };
      }

      unknownSet.add(normKey);
      return { ...tx, normKey, autoHint, _pendingAI: true };
    });


    // ชั้นที่ 2: วิเคราะห์เฉพาะชื่อผู้รับโอนที่ไม่ซ้ำกัน (Deduplicated Batch)
    const uniqueMerchants = Array.from(unknownSet);
    const batchResults = {};
    let aiGuessedCount = 0;
    let humanReviewCount = 0;

    for (const merchantName of uniqueMerchants) {
      const upperName = merchantName.toUpperCase();
      const matchedRule = MERCHANT_AI_RULES.find(r =>
        r.keywords.some(kw => upperName.includes(kw.toUpperCase()))
      );

      if (matchedRule) {
        batchResults[merchantName] = {
          category: matchedRule.category,
          source: 'AI_GUESS',
          sourceLabel: 'AI คาดเดาจากชื่อบริษัท/ร้านค้า',
          needsReview: true
        };
      } else {
        batchResults[merchantName] = {
          category: 'UNKNOWN',
          source: 'NEEDS_INPUT',
          sourceLabel: 'ชื่อบุคคล / รอระบุเอง',
          needsReview: true
        };
      }
    }

    const finalTransactions = stageOneList.map(tx => {
      if (!tx._pendingAI) return tx;
      const res = batchResults[tx.normKey];
      if (res.source === 'AI_GUESS') aiGuessedCount++;
      else humanReviewCount++;

      let smartContextHint = tx.autoHint || '';
      if (res.category === 'UNKNOWN' && !smartContextHint) {
        smartContextHint = this.generateAIContextHint(tx);
      }

      const cleaned = { ...tx, ...res, autoHint: smartContextHint };
      delete cleaned._pendingAI;
      return cleaned;
    });

    const totalRows = rawTransactions.length;
    const uniqueCount = uniqueMerchants.length;
    const savedPercent = totalRows > 0
      ? Math.round(((totalRows - uniqueCount) / totalRows) * 100)
      : 0;

    return {
      transactions: finalTransactions,
      insights: insights.detectedEvents,
      aiSummaryBullets: this.buildAIMonthlySummary(finalTransactions),
      selfAccounts: this.summarizeSelfAccounts(finalTransactions, ownerCoreName),
      priorityGroups: this.buildPriorityUnknownGroups(finalTransactions),
      stats: {
        totalRows,
        memoryHits,
        ruleHits,
        aiGuessedCount,
        humanReviewCount,
        uniqueMerchantsSentToAI: uniqueCount,
        savedApiPercent: savedPercent
      }
    };
  },

  generateAIContextHint(tx) {
    const amt = tx.debit || 0;
    const hour = parseInt((tx.time || '12:00').split(':')[0], 10);

    if (amt <= 65 && hour >= 6 && hour <= 21) {
      return 'AI วิเคราะห์จากยอดและเวลา: ยอดย่อย 14–65 บาทช่วงมื้ออาหาร น่าจะเป็นร้านอาหารตามสั่ง/เครื่องดื่ม/วินที่สแกนเข้าชื่อบุคคล';
    }
    if (amt > 65 && amt <= 250) {
      return 'AI วิเคราะห์จากยอดและเวลา: ยอดระดับ 70–250 บาท น่าจะเป็นค่าอาหารมื้อหลัก หารค่าของกับเพื่อน หรือซื้อของใช้';
    }
    if (amt >= 1000) {
      return 'AI วิเคราะห์จากยอดและเวลา: ยอดโอนหลักพันให้บุคคล อาจเป็นค่าเช่า/ค่าหอ ค่าของชิ้นใหญ่ หรือโอนคืนเพื่อน';
    }
    return 'AI วิเคราะห์จากยอดและเวลา: รายการโอนให้บุคคลหรือชำระออนไลน์ แนะนำให้เลือกหมวดหมู่ด้านขวา';
  },

  buildAIMonthlySummary(transactions) {
    const bullets = [];
    const debits = transactions.filter(t => t.debit > 0 && t.category !== 'SELF_TRANSFER');
    const totalSpend = debits.reduce((s, t) => s + t.debit, 0);

    const walletTxs = debits.filter(t => t.category === 'WALLET');
    const walletTotal = walletTxs.reduce((s, t) => s + t.debit, 0);
    if (walletTxs.length > 0 && totalSpend > 0) {
      const pct = Math.round((walletTotal / totalSpend) * 100);
      bullets.push(`มีการเติมเงินเข้า Wallet (TrueMoney / K Plus / LINE Pay) รวม ${walletTxs.length} ครั้ง เป็นเงิน ${walletTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (${pct}% ของรายจ่ายจริง) ซึ่งเป็นจุดที่เงินไหลออกบ่อยที่สุด`);
    }

    const foodTxs = debits.filter(t => t.category === 'FOOD');
    const foodTotal = foodTxs.reduce((s, t) => s + t.debit, 0);
    if (foodTxs.length > 0) {
      bullets.push(`ค่าอาหารและเครื่องดื่มมี ${foodTxs.length} ครั้ง รวม ${foodTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (เฉลี่ยครั้งละ ${Math.round(foodTotal / foodTxs.length)} บาท)`);
    }

    const unknownTxs = debits.filter(t => t.category === 'UNKNOWN');
    const unknownTotal = unknownTxs.reduce((s, t) => s + t.debit, 0);
    if (unknownTxs.length > 0) {
      bullets.push(`มีรายการโอนเข้าชื่อบุคคลที่ไม่ระบุชื่อร้านอีก ${unknownTxs.length} รายการ (รวม ${unknownTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท) สามารถกดเลือกหมวดหมู่ในหน้า "ระบุยอดใหญ่" เพื่อให้ระบบจำไว้ใช้รอบหน้าได้ทันที`);
    } else {
      bullets.push(`รายการทั้งหมดถูกจัดหมวดหมู่ครบ 100% เรียบร้อยแล้ว!`);
    }

    return bullets;
  },

  /**
   * สรุปการโอนย้ายเงินไป-มาระหว่างบัญชีตัวเอง (เช่น SCB x3967, KBNK x5550)
   * เพื่อให้คนที่มี 2-3 บัญชีเห็นภาพรวมชัดเจนว่าโยกเงินเข้า-ออกสุทธิเท่าไหร่
   */
  summarizeSelfAccounts(transactions, ownerCoreName = '') {
    const map = {};

    for (const tx of transactions) {
      const desc = tx.description || '';
      const isSelfByName = ownerCoreName && desc.includes(ownerCoreName);
      const isSelfCategory = tx.category === 'SELF_TRANSFER';

      if (!isSelfByName && !isSelfCategory) continue;

      // สกัดรหัสธนาคารและเลขท้ายบัญชี เช่น "SCB x3967" หรือ "KBNK x5550"
      const bankMatch = desc.match(/([A-Z]{2,6}\s*x\d{4})/i);
      const acctKey = bankMatch
        ? `${bankMatch[1].toUpperCase()} (${ownerCoreName || 'บัญชีตัวเอง'})`
        : window.TangHai.MemoryStore.normalizeKey(desc);

      if (!map[acctKey]) {
        map[acctKey] = {
          accountLabel: acctKey,
          inflow: 0,
          inCount: 0,
          outflow: 0,
          outCount: 0
        };
      }

      if (tx.credit > 0) {
        map[acctKey].inflow += tx.credit;
        map[acctKey].inCount += 1;
      }
      if (tx.debit > 0) {
        map[acctKey].outflow += tx.debit;
        map[acctKey].outCount += 1;
      }
    }

    return Object.values(map).sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow));
  },

  /**
   * จัดกลุ่มรายการที่ยังไม่ระบุหมวดหมู่ (UNKNOWN) ตามชื่อผู้รับ
   * และเรียงลำดับจาก "ยอดเงินรวมสูงสุด -> น้อยสุด" เพื่อให้เจ้าของไล่ระบุยอดใหญ่ก่อนได้ง่ายที่สุด
   */
  buildPriorityUnknownGroups(transactions) {
    const groups = {};
    for (const tx of transactions) {
      if (tx.category !== 'UNKNOWN' || tx.debit <= 0) continue;
      const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
      if (!groups[key]) {
        groups[key] = {
          normKey: key,
          sampleTxId: tx.id,
          description: tx.description,
          totalAmount: 0,
          count: 0,
          dates: [],
          autoHint: tx.autoHint || ''
        };
      }
      groups[key].totalAmount += tx.debit;
      groups[key].count += 1;
      if (groups[key].dates.length < 3) {
        groups[key].dates.push(`${tx.date} (${tx.time})`);
      }
    }

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  },

  detectSplitsAndPassThroughs(txs, ownerCoreName = '') {
    const detectedEvents = [];
    const passThroughTxIds = [];
    const splitNoteById = {};

    const byDate = {};
    for (const tx of txs) {
      if (!byDate[tx.date]) byDate[tx.date] = [];
      byDate[tx.date].push(tx);
    }

    for (const [date, dayTxs] of Object.entries(byDate)) {
      const credits = dayTxs.filter(t => t.credit > 0);
      const debits = dayTxs.filter(t => t.debit > 0);

      for (const d of debits) {
        if (d.debit >= 1000) {
          const matchingIn = credits.find(c => Math.abs(c.credit - d.debit) < 0.01);
          if (matchingIn && !(ownerCoreName && d.description.includes(ownerCoreName))) {
            passThroughTxIds.push(d.id);
            splitNoteById[d.id] = `ยอดตรงกับเงินโอนเข้า +${d.debit.toLocaleString()} ในวันเดียวกัน`;
            detectedEvents.push({
              date,
              type: 'PASS_THROUGH',
              title: `เงินผ่านบัญชี ฿${d.debit.toLocaleString()}`,
              detail: `วันที่ ${date} มีเงินเข้า +${d.debit.toLocaleString()} แล้วโอนออก -${d.debit.toLocaleString()} ไปยัง "${d.description}"`
            });
          }
        }
      }

      for (const d of debits) {
        if (d.debit > 0 && d.debit < 1000) {
          const reimburse = credits.find(c => Math.abs(c.credit - d.debit) < 0.01);
          if (reimburse) {
            splitNoteById[d.id] = `มีเงินโอนคืนยอดตรงกัน +${d.debit} บาท (${reimburse.description})`;
            detectedEvents.push({
              date,
              type: 'REIMBURSE',
              title: `เงินโอนคืนค่าใช้จ่าย ฿${d.debit.toLocaleString()}`,
              detail: `วันที่ ${date} จ่าย "${d.description}" (-${d.debit}) และมีรายการโอนคืน +${reimburse.credit} ในวันเดียวกัน`
            });
          }
        }
      }

      if (credits.length >= 2) {
        const creditFreq = {};
        for (const c of credits) {
          creditFreq[c.credit] = (creditFreq[c.credit] || 0) + 1;
        }
        for (const [amtStr, count] of Object.entries(creditFreq)) {
          const shareAmt = parseFloat(amtStr);
          if (count >= 2 && shareAmt > 20) {
            const totalPool = shareAmt * (count + 1);
            const groupDebit = debits.find(d => Math.abs(d.debit - totalPool) < 0.01);
            if (groupDebit) {
              splitNoteById[groupDebit.id] = `หารกลุ่ม ${count + 1} คน (เพื่อนโอนเข้า ${count}×${shareAmt} = +${shareAmt * count} บาท, จ่ายจริงเฉพาะของคุณ ${shareAmt} บาท)`;
              detectedEvents.push({
                date,
                type: 'GROUP_SPLIT',
                title: `หารกลุ่มเพื่อน (${count + 1} คน คนละ ฿${shareAmt})`,
                detail: `วันที่ ${date} เพื่อนโอนเข้า ${count} คน รวม +${(shareAmt * count).toLocaleString()} ก่อนจ่ายออก -${groupDebit.debit.toLocaleString()} (จ่ายจริงเฉพาะของคุณคือ ฿${shareAmt})`
              });
            }
          }
        }
      }
    }

    return { detectedEvents, passThroughTxIds, splitNoteById };
  }
};
