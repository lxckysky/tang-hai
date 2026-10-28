/**
 * categorizer.js
 * ระบบจัดหมวดหมู่ 3 ชั้น + อัลกอริทึมตรวจจับรายการโอนบัญชีตัวเอง & หารค่าใช้จ่ายกับเพื่อน (Split/Pass-Through Detector)
 */

window.TangHai = window.TangHai || {};

const MERCHANT_AI_RULES = [
  {
    keywords: [
      'CPN SLY', 'เซ็นทรัลพัฒนา', 'ถุงเงิน', 'มณี SHOP', 'กินนี่ ฟู้ด', 'FOOD PATIO',
      'PARABOLA SCI', 'MINOR FOOD', 'ไมเนอร์ ฟู้ด', 'อีสาน', 'แซ่บ', 'ข้าวยาย', 'ไส้กรอก',
      'ร้านเบอร์ 5', 'ร้านเบอร์สอง', 'ตึกจุล', 'ข้าวแกง', 'ป้ารี',
      'YI JIA MALA', 'MALA SUKI', '1592-KFC', 'KFC', 'WONGNAI',
      'อาหาร', 'กาแฟ', 'ชาบู', 'MK ', 'STARBUCKS', 'CAFE', 'FOOD', 'PIZZA',
      'GRABFOOD', 'LINEMAN', 'FOODPANDA', 'ROBINHOOD', 'MCDONALD', 'TEXAS CHICKEN',
      'SUSHI', 'SHABUSHI', 'BAR B Q', 'BARBQ', 'BAR B Q PLAZA', 'SWENSENS',
      'AMAZON', 'INTHANIN', 'CHA TRA MUE', 'ชาตรามือ', 'KOI THE', 'KAMU',
      'BEARHOUSE', 'GAGA', 'HAIDILAO', 'MO-MO', 'S&P', 'CHESTER', 'KOUEN',
      'BONCHON', 'BURGER KING', 'YAYOI', 'FUJI', 'OISHI', 'SUSHIRO', 'SUKI TEENOI', 'สุกี้ตี๋น้อย'
    ],
    category: 'FOOD'
  },
  {
    keywords: [
      'สหกรณ์จุฬา', 'TOPS-C2B', 'TOPS', 'BIGC', 'BIG C',
      'เวนดิ้ง', 'บุญเติม', 'จิฟฟี่', 'JIFFY', '7-ELEVEN', 'CP ALL', 'LAWSON',
      'LOTUS', "LOTUS'S", 'โลตัส', 'CJ EXPRESS', 'CJ MORE', 'MAKRO', 'แม็คโคร',
      'VILLA MARKET', 'GOURMET MARKET', 'FOODLAND', 'FAMILYMART', 'MINI BIG C',
      'DONKI', 'DON DON DONKI', 'MAXVALU'
    ],
    category: 'GROCERY'
  },
  {
    keywords: [
      'เอ็มอาร์ที', 'MRT', 'ทางด่วนและรถไฟฟ้า', 'BTS', 'BEM',
      'ARL', 'SRTET', 'รถไฟฟ้า', 'ทางด่วน', 'EXAT', 'EASY PASS', 'M-FLOW', 'TOLLWAY',
      'GRABTAXI', 'BOLT', 'PTT', 'OR OIL', 'CALTEX', 'SHELL', 'BANGCHAK', 'บางจาก',
      'SUSCO', 'PEA VOLTA', 'EV CHARGE', 'LINE MAN RIDE'
    ],
    category: 'TRANSPORT'
  },
  {
    keywords: [
      'KLONGLUANG PHARMACY', 'ร้านยา', 'CHULALONGKORN UNIVERSITY BOOK', 'BOOK CE', 'MAKALIN CLINIC', 'CLINIC', 'HOSPITAL',
      'PHARMACY', 'SE-ED', 'NAIIN', 'B2S', 'KINOKUNIYA', 'จุฬา', 'ธรรมศาสตร์', 'มหาวิทยาลัย',
      'โรงพยาบาล', 'คลินิก', 'ศิริราช', 'จุฬาลงกรณ์', 'กรุงเทพ', 'รามา', 'BDMS', 'ฟาสซิโน',
      'WATSONS', 'BOOTS'
    ],
    category: 'EDUCATION_HEALTH'
  },
  {
    keywords: [
      'TIKTOK SHOP', 'PIPO', 'UNIQLO', 'ยูนิโคล่', 'ซัมมิท ไพน์เฮ', 'OMISE', 'SHOPEE', 'LAZADA', 'ยูอาร์เดอะ',
      'PINEHURST', 'LIANLIAN', 'อัลติเมต', 'ZARA', 'H&M', 'MUJI', 'DECATHLON',
      'MR.DIY', 'MR DIY', 'HOMEPRO', 'CENTRAL', 'THE MALL', 'EVEANDBOY', 'BEAUTRIUM',
      'IKEA', 'APPLE.COM', 'STEAM', 'PLAYSTATION'
    ],
    category: 'SHOPPING'
  },
  {
    keywords: [
      'METROPOLITAN ELECTRICITY', 'การไฟฟ้า', 'PEA', 'MEA', 'ประปา', 'MWA', 'PWA',
      'AIS POSTPAID', 'AIS FIBRE', 'TRUE MOVE', 'TRUE ONLINE', 'DTAC', '3BB',
      'NT BROADBAND', 'NETFLIX', 'SPOTIFY', 'YOUTUBE', 'GOOGLE STORAGE', 'ICLOUD'
    ],
    category: 'BILLS'
  },
  {
    keywords: [
      'SIPS TRUE MONEY', 'TRUE MONEY', 'K PLUS W', 'LINE PAY', 'WIDx', 'เติมเงิน',
      'SHOPEEPAY', 'DOLFIN'
    ],
    category: 'WALLET'
  }
];

const TITLE_PREFIX_REGEX = /^(?:ด\.ญ\.|ด\.ช\.|เด็กหญิง|เด็กชาย|นาย|นางสาว|น\.ส\.|นาง|MR\.|MS\.|MRS\.|MISS)\s*/i;
const PERSON_KEYWORD_REGEX = /(?:นาย|นางสาว|น\.ส\.|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|MR\.|MS\.|MRS\.|MISS|PromptPay|พร้อมเพย์|โอนไป|โอนให้|บุคคล)/i;
const BUSINESS_KEYWORD_REGEX = /(?:บจก\.|จำกัด|หจก\.|บมจ\.|ห้างหุ้นส่วน|SHOP|STORE|CAFE|CLINIC|HOSPITAL|MARKET|FOOD|CO\.,?LTD|SERVICE|STATION)/i;
const THAI_NAME_PATTERN = /[ก-๙]{2,}\s+[ก-๙]{2,}/;

function isLikelyPersonalTransfer(desc = '') {
  if (!desc) return false;
  const clean = desc.trim();
  if (BUSINESS_KEYWORD_REGEX.test(clean)) return false;
  if (PERSON_KEYWORD_REGEX.test(clean)) return true;
  const noAcct = clean.replace(/^[A-Z0-9\/\-]+\s*/i, '').replace(/x\d{4,}\s*/i, '').trim();
  if (PERSON_KEYWORD_REGEX.test(noAcct) || THAI_NAME_PATTERN.test(noAcct)) return true;
  return false;
}

function extractOwnerCoreNames(meta = {}) {
  const names = new Set();
  const tokens = new Set();

  const addName = (raw) => {
    if (!raw) return;
    const clean = raw.replace(TITLE_PREFIX_REGEX, '').trim();
    if (clean.length >= 3) {
      names.add(clean);
      const parts = clean.split(/\s+/);
      if (parts[0] && parts[0].length >= 3) {
        tokens.add(parts[0]); // First name เช่น ทอฝัน, ศาศวรรต
      }
      if (parts[1] && parts[1].length >= 3) {
        tokens.add(parts[1]); // Full last name
        if (parts[1].length >= 5) {
          tokens.add(parts[1].substring(0, 5)); // สุทธิ, จิตรส
        }
      }
    }
  };

  addName(meta.accountName);
  if (Array.isArray(meta.ownerNames)) {
    meta.ownerNames.forEach(addName);
  }

  return {
    fullNames: Array.from(names),
    nameTokens: Array.from(tokens),
    namesArray: Array.from(names)
  };
}

function isMatchingOwnerName(desc = '', ownerData = {}) {
  if (!desc || !ownerData) return false;

  if (Array.isArray(ownerData)) {
    return ownerData.some(n => {
      if (!n || n.length < 3) return false;
      const clean = n.replace(TITLE_PREFIX_REGEX, '').trim();
      const firstWord = clean.split(/\s+/)[0];
      return desc.includes(n) || desc.includes(clean) || (firstWord && firstWord.length >= 3 && desc.includes(firstWord));
    });
  }

  const fullNames = ownerData.fullNames || [];
  const tokens = ownerData.nameTokens || [];

  if (fullNames.some(n => desc.includes(n))) return true;
  return tokens.some(t => t.length >= 3 && desc.includes(t));
}

const AI_CACHE_KEY = 'tanghai_gemini_cache_v1';
const API_KEY_STORAGE = 'tanghai_gemini_api_key';

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
    const ownerNames = extractOwnerCoreNames(meta);
    const aiCache = getAICache();

    const stageOneList = rawTransactions.map(tx => {
      const desc = tx.description || '';
      const normKey = window.TangHai.MemoryStore.normalizeKey(desc);

      if (tx.rowCategoryOverride) {
        memoryHits++;
        return {
          ...tx,
          normKey,
          category: tx.rowCategoryOverride,
          source: 'MEMORY',
          sourceLabel: 'กำหนดเอง',
          needsReview: false
        };
      }

      const isSelf = isMatchingOwnerName(desc, ownerNames);

      if (tx.code === 'X1' || tx.credit > 0) {
        ruleHits++;
        return {
          ...tx,
          normKey,
          category: 'INCOME',
          source: 'RULE',
          sourceLabel: isSelf ? 'โอนเข้าจากบัญชีตัวเอง' : 'เงินโอนเข้า',
          needsReview: false
        };
      }

      if (isSelf) {
        ruleHits++;
        return {
          ...tx,
          normKey,
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
          category: memoryMatch.category,
          userNote: tx.userNote || memoryMatch.alias,
          source: 'MEMORY',
          sourceLabel: `จำไว้: ${memoryMatch.alias}`,
          needsReview: false
        };
      }

      unknownSet.add(normKey);
      return { ...tx, normKey, _pendingAI: true };
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
      } else if (isLikelyPersonalTransfer(merchantName)) {
        batchResults[merchantName] = {
          category: 'TRANSFER_PERSON',
          source: 'RULE',
          sourceLabel: 'โอนให้บุคคล',
          llmHint: geminiCached ? geminiCached.hint : 'โอนให้บุคคล / พร้อมเพย์',
          needsReview: false
        };
      } else {
        batchResults[merchantName] = {
          category: 'UNKNOWN',
          source: 'RULE',
          sourceLabel: 'อื่นๆ',
          llmHint: geminiCached ? geminiCached.hint : '',
          needsReview: false
        };
      }
    }

    const finalTransactions = stageOneList.map(tx => {
      if (!tx._pendingAI) return tx;
      const res = batchResults[tx.normKey];
      if (res.source === 'AI_GUESS') aiGuessedCount++;
      else humanReviewCount++;

      const cleaned = { ...tx, ...res };
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
      timeBreakdown: this.buildTimeOfDayBreakdown(finalTransactions),
      aiSummaryBullets: this.buildAIMonthlySummary(finalTransactions),
      selfAccounts: this.summarizeSelfAccounts(finalTransactions, ownerNames),
      priorityGroups: this.buildPriorityUnknownGroups(finalTransactions),
      suggestedCategories: aiCache.suggestedCategories || [],
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

  buildTimeOfDayBreakdown(transactions) {
    const periods = [
      { id: 'MORNING', label: 'ช่วงเช้า (06:00 – 11:59)', total: 0, count: 0 },
      { id: 'AFTERNOON', label: 'ช่วงบ่าย (12:00 – 17:59)', total: 0, count: 0 },
      { id: 'EVENING', label: 'ช่วงค่ำ (18:00 – 23:59)', total: 0, count: 0 },
      { id: 'NIGHT', label: 'ช่วงดึก (00:00 – 05:59)', total: 0, count: 0 }
    ];

    for (const tx of transactions) {
      if (!tx.debit || tx.debit <= 0 || tx.category === 'SELF_TRANSFER') continue;
      const hour = parseInt((tx.time || '12:00').split(':')[0], 10);
      if (hour >= 6 && hour < 12) {
        periods[0].total += tx.debit;
        periods[0].count += 1;
      } else if (hour >= 12 && hour < 18) {
        periods[1].total += tx.debit;
        periods[1].count += 1;
      } else if (hour >= 18 && hour <= 23) {
        periods[2].total += tx.debit;
        periods[2].count += 1;
      } else {
        periods[3].total += tx.debit;
        periods[3].count += 1;
      }
    }
    return periods;
  },

  async runGeminiLLMAnalysis(rawTransactions) {
    const aiCache = getAICache();
    const itemsToAsk = [];
    const seenKeys = new Set();
    const ownerNames = extractOwnerCoreNames(window.TangHai.AppState?.meta || {});

    for (const tx of rawTransactions) {
      // 1. ข้ามเงินเข้า
      if (tx.credit > 0 || tx.code === 'X1') continue;

      const desc = tx.description || '';
      // 2. ข้ามการโอนบัญชีตัวเอง
      if (isMatchingOwnerName(desc, ownerNames)) continue;

      // 3. ข้ามการกดเงินสด ATM
      if (tx.channel === 'CDM' || desc.toUpperCase().includes('CARDLESS ATM')) continue;

      const normKey = window.TangHai.MemoryStore.normalizeKey(desc);
      if (seenKeys.has(normKey)) continue;

      // 4. ข้ามรายการที่จำได้จากสมุดจำ
      if (window.TangHai.MemoryStore.findMatch(desc)) continue;

      // 5. ข้ามรายการที่ตรงกับกฎร้านค้าพื้นฐานอยู่แล้ว
      const upper = normKey.toUpperCase();
      const matchedBasic = MERCHANT_AI_RULES.find(r => r.keywords.some(kw => upper.includes(kw.toUpperCase())));
      if (matchedBasic) continue;

      // 6. ข้ามรายการที่เป็นชื่อบุคคลธรรมดา (ระบบจัดเป็นโอนให้บุคคลอยู่แล้ว)
      if (isLikelyPersonalTransfer(normKey)) continue;

      // ส่งให้ AI เฉพาะรายการที่ไม่รู้จักจริงๆ
      if (!aiCache.merchants[normKey]) {
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

    const customCats = window.TangHai.getCustomCategoriesList ? window.TangHai.getCustomCategoriesList() : [];

    // 1. ลองเรียกผ่าน Backend Serverless API (/api/gemini บน Vercel) ก่อน เพื่อให้ทุกคนใช้งานได้ทันทีโดยไม่ต้องกรอกคีย์
    if (window.location.protocol.startsWith('http')) {
      try {
        const serverRes = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToAsk, customCategories: customCats })
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

      const availableCats = [
        'FOOD (อาหารและเครื่องดื่ม)',
        'GROCERY (ของใช้/ของชำ/สะดวกซื้อ)',
        'TRANSPORT (การเดินทาง/รถไฟฟ้า/น้ำมัน)',
        'SHOPPING (ช้อปปิ้ง/ออนไลน์/เสื้อผ้า)',
        'EDUCATION_HEALTH (การศึกษา/ยา/คลินิก/สุขภาพ)',
        'BILLS (ค่าไฟ/ค่าเน็ต/ค่าหอ/บิล)',
        'WALLET (เติมเงิน e-Wallet)',
        'CASH_ATM (ถอนเงินสด)',
        'TRANSFER_PERSON (โอนให้บุคคล/เพื่อน/บุคคลธรรมดา)',
        'UNKNOWN (อื่นๆ)',
        ...customCats.map(c => `${c.id} (${c.label})`)
      ];

      const promptText = `คุณคือผู้เชี่ยวชาญวิเคราะห์สเตทเมนต์ธนาคารไทย และระบบผู้ช่วยจัดหมวดหมู่การเงินส่วนบุคคล
งานที่ 1: วิเคราะห์รายการโอนเงินต่อไปนี้ แล้วเลือกหมวดหมู่ที่เหมาะสมจาก: [${availableCats.join(', ')}]
กฎสำคัญ:
- ถ้าเป็นชื่อร้านค้าหรือบริษัท ให้ระบุ category ให้ตรงกับ id หมวดหมู่ด้านบน
- ถ้าเป็นชื่อบุคคลล้วนๆ ให้ใส่ category เป็น "TRANSFER_PERSON" และเขียน hint สั้นๆ (ไม่เกิน 7 คำ)
- ถ้าไม่ตรงกับอะไรเลย ให้ใส่ "UNKNOWN"
รายการ: ${JSON.stringify(itemsToAsk.slice(0, 40))}

งานที่ 2: วิเคราะห์พฤติกรรมการใช้จ่ายเฉพาะบุคคล (Personalized Spending Choices):
แนะนำหมวดหมู่ใหม่ที่ตรงใจ 1-2 หมวดหมู่ใน "suggestedCustomCategories": [{"label": "ชื่อหมวดหมู่ที่แนะนำ", "reason": "เหตุผลสั้นๆ"}]

งานที่ 3: สรุปภาพรวมพฤติกรรมการเงิน 3 ข้อ (summaryBullets)

ตอบกลับเป็น JSON เท่านั้น:
{"items":[{"key":"...","category":"...","hint":"..."}],"suggestedCustomCategories":[{"label":"...","reason":"..."}],"summaryBullets":["...","...","..."]}`;

      const isVertexKey = apiKey.startsWith('AQ.');
      const candidateModels = isVertexKey
        ? ['gemini-2.0-flash']
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

      let lastError = null;

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

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            if (response.status === 403) {
              if (isVertexKey) {
                throw new Error('API Key บน Google Cloud (Vertex AI) ยังไม่ได้เปิดใช้งาน Service aiplatform.googleapis.com แนะนำให้ใช้ Google AI Studio Key แทน');
              } else {
                throw new Error('Gemini API Error (403): สิทธิ์การเข้าถึงถูกปฏิเสธ หรือยังไม่ได้เปิด Generative Language API');
              }
            }
            if (response.status === 404 || response.status === 400) {
              lastError = new Error(`Gemini API Error (${response.status})`);
              continue;
            }
            throw new Error(`Gemini API Error (${response.status})`);
          }

          const data = await response.json();
          parsed = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
          break;
        } catch (e) {
          lastError = e;
          if (e.message.includes('403') || e.message.includes('Vertex AI')) {
            throw e;
          }
        }
      }

      if (!parsed) {
        throw (lastError || new Error('ไม่สามารถเชื่อมต่อ Gemini API ได้'));
      }
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
    if (Array.isArray(parsed?.suggestedCustomCategories)) {
      aiCache.suggestedCategories = parsed.suggestedCustomCategories;
    }

    saveAICache(aiCache);
    return { cached: false, count: itemsToAsk.length };
  },

  /**
   * สร้างคำใบ้อัจฉริยะ (Smart Heuristic Hint) อิงตามยอดเงิน, วันที่ และเวลา
   * ทำงานได้ตลอดเวลาทั้งในโหมดพื้นฐาน และเป็น Fallback เมื่อ AI ออฟไลน์
   */
  generateSmartHint(tx) {
    const amt = tx.debit || tx.amount || 0;
    const day = parseInt((tx.date || '01/10/26').split('/')[0], 10);
    const hour = parseInt((tx.time || '12:00').split(':')[0], 10);
    const desc = (tx.description || '').toUpperCase();

    if (amt >= 3000 && day <= 7) {
      return 'ค่าเช่าหอพัก / คอนโด / บิลรายเดือน (ต้นเดือน)';
    }
    if (desc.includes('PROMPTPAY') || desc.includes('นาย') || desc.includes('น.ส.') || desc.includes('นาง')) {
      if (amt <= 80 && hour >= 6 && hour <= 21) {
        return 'โอนจ่ายค่าอาหารจานด่วน / วินมอเตอร์ไซค์';
      }
      if (amt >= 100 && amt <= 600) {
        return 'โอนหารค่าอาหารกับเพื่อน / จ่ายร้านค้าคนละครึ่ง';
      }
      if (amt >= 1000) {
        return 'โอนค่าของชิ้นใหญ่ / โอนคืนเพื่อน';
      }
      return 'โอนบุคคลผ่าน PromptPay';
    }
    if (hour >= 0 && hour < 6) {
      return 'สั่งอาหารดึก / ซื้อของออนไลน์ช่วงดึก';
    }
    if (amt <= 80 && ((hour >= 7 && hour <= 9) || (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 20))) {
      return 'อาหารและเครื่องดื่มช่วงมื้ออาหาร';
    }
    if (amt >= 2000) {
      return 'ค่าใช้จ่ายก้อนใหญ่ / ช้อปปิ้ง';
    }
    return 'รายการรอเจ้าของระบุหมวดหมู่';
  },

  /**
   * ดึงรายการที่ยังไม่ระบุหมวดหมู่ (UNKNOWN) ทั้งหมด เรียงลำดับจาก "ยอดเงินมากสุด -> น้อยสุด"
   * พร้อมแนบคำใบ้ (Hint) จาก Gemini AI หรือ Smart Heuristic
   */
  buildPriorityUnknownGroups(transactions) {
    const reviewTxs = transactions.filter(tx => (tx.category === 'UNKNOWN' || tx.category === 'TRANSFER_PERSON') && tx.debit > 0);

    const freqMap = {};
    for (const tx of reviewTxs) {
      const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
      freqMap[key] = (freqMap[key] || 0) + 1;
    }

    return reviewTxs
      .map(tx => {
        const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
        return {
          txId: tx.id,
          normKey: key,
          description: tx.description,
          amount: tx.debit,
          date: tx.date,
          time: tx.time,
          channel: tx.channel || '',
          sourceBank: tx.sourceBank || '',
          category: tx.category,
          repeatCount: freqMap[key] || 1,
          hint: tx.llmHint || this.generateSmartHint(tx)
        };
      })
      .sort((a, b) => b.amount - a.amount);
  },

  buildAIMonthlySummary(transactions) {
    const bullets = [];
    const debits = transactions.filter(t => t.debit > 0 && t.category !== 'SELF_TRANSFER');
    const totalSpend = debits.reduce((s, t) => s + t.debit, 0);

    const uniqueDates = new Set(debits.map(t => t.date)).size || 1;
    if (totalSpend > 0) {
      const dailyAvg = totalSpend / uniqueDates;
      bullets.push(`ค่าใช้จ่ายเฉลี่ยวันละ ฿${dailyAvg.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (จากที่มีการโอนออก ${uniqueDates} วัน)`);
    }

    const walletTxs = debits.filter(t => t.category === 'WALLET');
    const walletTotal = walletTxs.reduce((s, t) => s + t.debit, 0);
    if (walletTxs.length > 0 && totalSpend > 0) {
      const pct = Math.round((walletTotal / totalSpend) * 100);
      bullets.push(`รายการเติมเงิน Wallet รวม ${walletTxs.length} ครั้ง เป็นเงิน ฿${walletTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} (${pct}% ของรายจ่ายจริง)`);
    }

    const personTxs = debits.filter(t => t.category === 'TRANSFER_PERSON');
    const personTotal = personTxs.reduce((s, t) => s + t.debit, 0);
    if (personTxs.length > 0 && totalSpend > 0) {
      const pct = Math.round((personTotal / totalSpend) * 100);
      bullets.push(`โอนให้บุคคล รวม ${personTxs.length} ครั้ง เป็นเงิน ฿${personTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} (${pct}% ของรายจ่ายจริง)`);
    }

    const unknownTxs = debits.filter(t => t.category === 'UNKNOWN');
    const unknownTotal = unknownTxs.reduce((s, t) => s + t.debit, 0);
    if (unknownTxs.length > 0) {
      bullets.push(`รายการหมวดอื่นๆ ${unknownTxs.length} รายการ รวมเป็นเงิน ฿${unknownTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    } else if (totalSpend > 0) {
      bullets.push(`จัดหมวดหมู่ครบทุกรายการเรียบร้อยแล้ว`);
    }

    return bullets;
  },

  summarizeSelfAccounts(transactions, ownerData = {}) {
    const map = {};
    // รองรับทั้ง format เก่า (Array) และ format ใหม่ (object)
    const namesArr = Array.isArray(ownerData)
      ? ownerData
      : (ownerData.namesArray || ownerData.fullNames || []);

    for (const tx of transactions) {
      const desc = tx.description || '';
      const isSelfByName = isMatchingOwnerName(desc, ownerData);
      const isSelfCategory = tx.category === 'SELF_TRANSFER';

      if (!isSelfByName && !isSelfCategory) continue;

      const bankMatch = desc.match(/([A-Z]{2,6}\s*x\d{4})/i);
      const acctKey = bankMatch
        ? `${bankMatch[1].toUpperCase()} (${namesArr[0] || 'บัญชีตัวเอง'})`
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
