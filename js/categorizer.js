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

const AI_CACHE_KEY = 'tanghai_gemini_cache_v1';
const API_KEY_STORAGE = 'tanghai_gemini_api_key';

// ดึงคีย์จาก localStorage ของเบราว์เซอร์เท่านั้น (ไม่มีคีย์ฝังในโค้ดบน GitHub ปลอดภัย 100%)
function getStoredApiKey() {
  return (localStorage.getItem(API_KEY_STORAGE) || '').trim();
}

function getAICache() {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    return raw ? JSON.parse(raw) : { merchants: {}, summary: null };
  } catch (e) {
    return { merchants: {}, summary: null };
  }
}

function saveAICache(cacheData) {
  try {
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Cache save error:', e);
  }
}

window.TangHai.Categorizer = {
  getApiKey() {
    return getStoredApiKey();
  },

  setApiKey(keyStr) {
    const clean = (keyStr || '').trim();
    if (clean) {
      localStorage.setItem(API_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  },

  clearAICache() {
    localStorage.removeItem(AI_CACHE_KEY);
  },

  analyzeTransactions(rawTransactions, meta = {}, mode = 'BASIC') {
    let memoryHits = 0;
    let ruleHits = 0;
    const unknownSet = new Set();
    const ownerCoreName = extractOwnerCoreName(meta.accountName || '');
    const aiCache = getAICache();

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
          sourceLabel: 'แก้ไขแล้ว',
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
          sourceLabel: isFromSelf ? 'โอนเข้าจากบัญชีตัวเอง' : 'เงินโอนเข้า',
          needsReview: false
        };
      }

      // 1.2 ตรวจจับโอนเงินไปบัญชีชื่อตัวเอง (เช็กจากชื่อเจ้าของสเตทเมนต์ตรงกับชื่อปลายทางเท่านั้น!)
      if (ownerCoreName && desc.includes(ownerCoreName)) {
        ruleHits++;
        return {
          ...tx,
          normKey,
          autoHint,
          category: 'SELF_TRANSFER',
          source: 'RULE',
          sourceLabel: 'โอนบัญชีตัวเอง',
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
          sourceLabel: `จำไว้: ${memoryMatch.alias}`,
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

      const geminiCached = mode === 'AI' ? aiCache.merchants?.[merchantName] : null;

      if (geminiCached && geminiCached.category && geminiCached.category !== 'UNKNOWN') {
        batchResults[merchantName] = {
          category: geminiCached.category,
          source: 'AI_GUESS',
          sourceLabel: 'Gemini AI แยกให้',
          llmHint: geminiCached.hint || '',
          needsReview: false
        };
      } else if (matchedRule) {
        batchResults[merchantName] = {
          category: matchedRule.category,
          source: 'AI_GUESS',
          sourceLabel: 'แยกจากชื่อร้าน',
          llmHint: geminiCached ? geminiCached.hint : '',
          needsReview: false
        };
      } else {
        batchResults[merchantName] = {
          category: 'UNKNOWN',
          source: 'NEEDS_INPUT',
          sourceLabel: 'รอระบุหมวดหมู่',
          llmHint: geminiCached ? geminiCached.hint : '',
          needsReview: true
        };
      }
    }

    const finalTransactions = stageOneList.map(tx => {
      if (!tx._pendingAI) return tx;
      const res = batchResults[tx.normKey];
      if (res.source === 'AI_GUESS') aiGuessedCount++;
      else humanReviewCount++;

      let smartContextHint = tx.autoHint || res.llmHint || '';
      if (res.category === 'UNKNOWN' && !smartContextHint && mode === 'AI') {
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

    const summaryBullets = (mode === 'AI' && Array.isArray(aiCache.summary) && aiCache.summary.length > 0)
      ? aiCache.summary
      : this.buildAIMonthlySummary(finalTransactions);

    return {
      transactions: finalTransactions,
      insights: insights.detectedEvents,
      aiSummaryBullets: summaryBullets,
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

  async runGeminiLLMAnalysis(rawTransactions) {
    const aiCache = getAICache();
    const itemsToAsk = [];
    const seenKeys = new Set();

    for (const tx of rawTransactions) {
      if (tx.credit > 0 || tx.code === 'X1') continue;
      const normKey = window.TangHai.MemoryStore.normalizeKey(tx.description);
      if (seenKeys.has(normKey)) continue;

      const upper = normKey.toUpperCase();
      const matchedBasic = MERCHANT_AI_RULES.find(r => r.keywords.some(kw => upper.includes(kw.toUpperCase())));

      if (!matchedBasic && !aiCache.merchants[normKey]) {
        seenKeys.add(normKey);
        itemsToAsk.push({
          key: normKey,
          amount: tx.debit,
          time: tx.time,
          date: tx.date
        });
      }
    }

    if (itemsToAsk.length === 0 && aiCache.summary) {
      return { cached: true, count: 0 };
    }

    let parsed = null;

    // 1. ลองเรียกผ่าน Backend Serverless API (/api/gemini บน Vercel) ก่อน เพื่อให้ทุกคนใช้งานได้ทันทีโดยไม่ต้องกรอกคีย์
    if (window.location.protocol.startsWith('http')) {
      try {
        const serverRes = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToAsk })
        });
        if (serverRes.ok) {
          parsed = await serverRes.json();
        }
      } catch (e) {
        // กรณีไม่ได้รันบน Vercel จะสลับไปใช้คีย์ในเครื่องด้านล่างอัตโนมัติ
      }
    }

    // 2. Fallback: กรณีเปิดไฟล์รันในเครื่องตัวเอง (file://) หรือทดสอบด้วยคีย์ใน Local Storage
    if (!parsed) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        const err = new Error('NEED_API_KEY');
        err.code = 'NEED_API_KEY';
        throw err;
      }

      const promptText = `คุณคือผู้เชี่ยวชาญวิเคราะห์สเตทเมนต์ธนาคารไทย
งานที่ 1: วิเคราะห์รายการโอนเงินต่อไปนี้ แล้วเดาหมวดหมู่และเขียนคำใบ้ภาษาไทยสั้นๆ (ไม่เกิน 7 คำ)
กฎสำคัญ:
- ถ้าเป็นชื่อบริษัท/ร้านค้า ให้เลือก category จาก [FOOD, GROCERY, TRANSPORT, SHOPPING, EDUCATION_HEALTH, BILLS, WALLET]
- ถ้าเป็นชื่อบุคคลล้วนๆ (เช่น นาย..., น.ส...., นาง...) ที่ไม่รู้ชื่อร้าน ให้ใส่ category เป็น "UNKNOWN" เสมอ (เพื่อให้เจ้าของระบุเอง) แต่เขียน hint ภาษาไทยช่วยเดาจากยอดเงินและเวลาโอน

รายการ: ${JSON.stringify(itemsToAsk)}

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

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error (${response.status})`);
      }

      const data = await response.json();
      parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    }

    if (Array.isArray(parsed?.items)) {
      for (const item of parsed.items) {
        if (item.key) {
          aiCache.merchants[item.key] = {
            category: item.category || 'UNKNOWN',
            hint: item.hint || ''
          };
        }
      }
    }
    if (Array.isArray(parsed?.summaryBullets) && parsed.summaryBullets.length > 0) {
      aiCache.summary = parsed.summaryBullets;
    }

    saveAICache(aiCache);
    return { cached: false, count: itemsToAsk.length };
  },

  /**
   * ดึงรายการที่ยังไม่ระบุหมวดหมู่ (UNKNOWN) ทั้งหมด เรียงลำดับจาก "ยอดเงินมากสุด -> น้อยสุด"
   * เพื่อให้จำนวนรายการตรงกับตัวเลขที่แสดงบนป้ายแจ้งเตือน 100% (ไม่ยุบซ่อนจนผู้ใช้สับสน)
   */
  buildPriorityUnknownGroups(transactions) {
    const unknownTxs = transactions.filter(tx => tx.category === 'UNKNOWN' && tx.debit > 0);

    // นับว่าแต่ละชื่อผู้รับมีโอนซ้ำกี่ครั้งในกลุ่มที่ยังไม่ระบุ
    const freqMap = {};
    for (const tx of unknownTxs) {
      const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
      freqMap[key] = (freqMap[key] || 0) + 1;
    }

    return unknownTxs
      .map(tx => {
        const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
        return {
          txId: tx.id,
          normKey: key,
          description: tx.description,
          amount: tx.debit,
          date: tx.date,
          time: tx.time,
          repeatCount: freqMap[key] || 1,
          autoHint: tx.autoHint || ''
        };
      })
      .sort((a, b) => b.amount - a.amount);
  },

  generateAIContextHint(tx) {
    const amt = tx.debit || 0;
    const day = parseInt((tx.date || '01/10/26').split('/')[0], 10);
    const hour = parseInt((tx.time || '12:00').split(':')[0], 10);

    if (amt >= 3000 && day <= 5) {
      return 'AI คาดว่า: ค่าเช่าคอนโด / หอพักรายเดือน (โอนก้อนใหญ่ช่วงต้นเดือน)';
    }
    if (amt <= 65 && hour >= 6 && hour <= 21) {
      return 'AI คาดว่า: ร้านอาหาร / เครื่องดื่ม / วิน (ยอดย่อยช่วงเวลาอาหาร)';
    }
    if (amt > 65 && amt <= 250) {
      return 'AI คาดว่า: มื้ออาหารหลัก / หารค่าของกับเพื่อน';
    }
    if (amt >= 1000) {
      return 'AI คาดว่า: ค่าที่พัก / ของชิ้นใหญ่ / โอนให้เพื่อน';
    }
    return 'AI คาดว่า: โอนให้บุคคล / ชำระออนไลน์';
  },

  buildAIMonthlySummary(transactions) {
    const bullets = [];
    const debits = transactions.filter(t => t.debit > 0 && t.category !== 'SELF_TRANSFER');
    const totalSpend = debits.reduce((s, t) => s + t.debit, 0);

    const walletTxs = debits.filter(t => t.category === 'WALLET');
    const walletTotal = walletTxs.reduce((s, t) => s + t.debit, 0);
    if (walletTxs.length > 0 && totalSpend > 0) {
      const pct = Math.round((walletTotal / totalSpend) * 100);
      bullets.push(`เติมเงิน Wallet รวม ${walletTxs.length} ครั้ง (${walletTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท คิดเป็น ${pct}% ของรายจ่ายจริง)`);
    }

    const foodTxs = debits.filter(t => t.category === 'FOOD');
    const foodTotal = foodTxs.reduce((s, t) => s + t.debit, 0);
    if (foodTxs.length > 0) {
      bullets.push(`ค่าอาหารและเครื่องดื่ม ${foodTxs.length} ครั้ง รวม ${foodTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (เฉลี่ยมื้อละ ${Math.round(foodTotal / foodTxs.length)} บาท)`);
    }

    const unknownTxs = debits.filter(t => t.category === 'UNKNOWN');
    const unknownTotal = unknownTxs.reduce((s, t) => s + t.debit, 0);
    if (unknownTxs.length > 0) {
      bullets.push(`รอระบุหมวดหมู่ ${unknownTxs.length} รายการ (รวม ${unknownTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`);
    } else {
      bullets.push(`จัดหมวดหมู่ครบทุกรายการ 100% แล้ว`);
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
            const fromSelf = ownerCoreName && matchingIn.description.includes(ownerCoreName);
            splitNoteById[d.id] = fromSelf
              ? `ดึงเงินจากบัญชีรองตัวเอง (+${d.debit.toLocaleString()}) มาจ่ายรายการนี้ (เช่น ค่าคอนโด/ค่าที่พักรายเดือน)`
              : `ยอดตรงกับเงินโอนเข้า +${d.debit.toLocaleString()} ในวันเดียวกัน`;
            detectedEvents.push({
              date,
              type: 'PASS_THROUGH',
              title: fromSelf
                ? `ดึงเงินจากบัญชีรองมาจ่ายก้อนใหญ่ ฿${d.debit.toLocaleString()}`
                : `เงินผ่านบัญชี ฿${d.debit.toLocaleString()}`,
              detail: `วันที่ ${date} โอนเข้า +${d.debit.toLocaleString()} (${matchingIn.description}) แล้วโอนออก -${d.debit.toLocaleString()} ไปยัง "${d.description}"`
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
