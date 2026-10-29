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
      'BONCHON', 'BURGER KING', 'YAYOI', 'FUJI', 'OISHI', 'SUSHIRO', 'SUKI TEENOI', 'สุกี้ตี๋น้อย',
      'ข้าวมันไก่', 'ข้าวหมูแดง', 'ก๋วยเตี๋ยว', 'ตามสั่ง', 'หมูกระทะ', 'ส้มตำ', 'ชาไข่มุก', 'บาร์บีคิว',
      'บุฟเฟต์', 'เบเกอรี่', 'BAKERY', 'KITCHEN', 'COFFEE', 'TEA', 'NOODLE', 'RESTAURANT', 'DINING', 'BISTRO',
      // ร้านอาหาร/ของหวาน/สตรีทฟู้ด ยอดนิยมในไทย
      'หนึ่ง นม นัว', 'นม นัว', 'นมสด', 'ขนมปัง', 'โทสต์', 'TOAST', 'บิงซู', 'โรตี',
      'หมาล่า', 'MALA', 'หมาล่าฮับ', 'หม้อไฟ', 'ชาบู', 'สุกี้',
      'โออิชิ', 'ราเมน', 'RAMEN', 'ราเมง',
      'มหาเฮง', 'ข้าวเหนียว', 'ร้านค้าออมสิน', 'ร้านอาหาร', 'ครัว', 'ของหวาน', 'ขนมหวาน',
      'ไอศกรีม', 'ไอติม', 'ICE CREAM', 'DESSERT', 'STEAK', 'สเต็ก', 'ลูกชิ้น'
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
      'SUSCO', 'PEA VOLTA', 'EV CHARGE', 'LINE MAN RIDE', 'วิน', 'แท็กซี่', 'TAXI', 'น้ำมัน',
      'ปตท', 'พีทีที', 'PTT STATION', 'RITTIDOL OIL', 'ESSO', 'ESTACIÓN',
      'น้ำมันงาม', 'OIL LTD', 'OIL PART', 'สถานีน้ำมัน', 'ปั๊มน้ำมัน',
      'GAS STATION', 'FUEL', 'PETROLEUM',
      // บริการที่จอดรถ และยานพาหนะเดินทาง (JPARK / GCOO / สกู๊ตเตอร์)
      'JENKONGKLAI', 'เจนก้องไกล', 'JPARK', 'ที่จอดรถ', 'ค่าจอดรถ', 'CAR PARK', 'PARKING',
      'GCOO', 'SCOOTER', 'สกู๊ตเตอร์', 'BEAM', 'เช่ารถ', 'CAR RENTAL'
    ],
    category: 'TRANSPORT'
  },
  {
    keywords: [
      'KLONGLUANG PHARMACY', 'ร้านยา', 'CHULALONGKORN UNIVERSITY BOOK', 'BOOK CE', 'MAKALIN CLINIC', 'CLINIC', 'HOSPITAL',
      'PHARMACY', 'SE-ED', 'NAIIN', 'B2S', 'KINOKUNIYA', 'จุฬา', 'ธรรมศาสตร์', 'มหาวิทยาลัย',
      'โรงพยาบาล', 'คลินิก', 'ศิริราช', 'จุฬาลงกรณ์', 'กรุงเทพ', 'รามา', 'BDMS', 'ฟาสซิโน',
      'WATSONS', 'BOOTS',
      // การแพทย์/เวชภัณฑ์/สุขภาพ
      'CONSORTIUM OF THAI MEDICA', 'THAI MEDICA', 'MEDICA', 'MEDICAL', 'CONSORTIUM',
      'อัลติเมด', 'ULTIMED', 'เวชกรรม', 'ทันตกรรม', 'เภสัช', 'LABORATORY', 'แล็บ'
    ],
    category: 'EDUCATION_HEALTH'
  },
  {
    keywords: [
      'TIKTOK SHOP', 'PIPO', 'UNIQLO', 'ยูนิโคล่', 'ซัมมิท ไพน์เฮ', 'OMISE', 'SHOPEE', 'LAZADA', 'ยูอาร์เดอะ',
      'PINEHURST', 'LIANLIAN', 'อัลติเมต', 'ZARA', 'H&M', 'MUJI', 'DECATHLON',
      'MR.DIY', 'MR DIY', 'HOMEPRO', 'CENTRAL', 'THE MALL', 'EVEANDBOY', 'BEAUTRIUM',
      'IKEA', 'APPLE.COM', 'STEAM', 'PLAYSTATION',
      // โรงภาพยนตร์และความบันเทิง
      'เอส เอฟ ซีเนม่า', 'เอส เอฟ', 'SF CINEMA', 'CINEMA', 'ซีเนม่า', 'MAJOR CINEPLEX', 'เมเจอร์', 'CINEPLEX', 'โรงหนัง', 'เดอะมอลล์'
    ],
    category: 'SHOPPING'
  },
  {
    keywords: [
      'METROPOLITAN ELECTRICITY', 'การไฟฟ้า', 'PEA', 'MEA', 'ประปา', 'MWA', 'PWA',
      'AIS POSTPAID', 'AIS FIBRE', 'TRUE MOVE', 'TRUE ONLINE', 'DTAC', '3BB',
      'NT BROADBAND', 'NETFLIX', 'SPOTIFY', 'YOUTUBE', 'GOOGLE STORAGE', 'ICLOUD',
      'เดอะเรสซิเดนซ์', 'เรสซิเดนซ์', 'RESIDENCE', 'หอพัก', 'อพาร์ตเมนต์', 'คอนโด', 'ค่าเช่า', 'ส่วนกลาง', 'APARTMENT', 'CONDO',
      'นิติบุคคล', 'อาคารชุด', 'นิติบุคคลอาคาร', 'JURISTIC', 'VILLAGE', 'ESTATE',
      'ไอดีโอ', 'IDEO', 'ASHTON', 'LPN', 'LUMPINI',
      'ค่าน้ำ', 'ค่าไฟ', 'ค่าส่วนกลาง', 'ค่าบริการ', 'ค่าเน็ต', 'ค่าโทรศัพท์'
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
// คำที่บ่งชี้ว่าเป็นร้านค้า/นิติบุคคล ไม่ใช่บุคคลธรรมดา
const BUSINESS_KEYWORD_REGEX = /(?:บจก\.|จำกัด|หจก\.|บมจ\.|ห้างหุ้นส่วน|SHOP|STORE|CAFE|CLINIC|HOSPITAL|MARKET|FOOD|CO\.?,?LTD|SERVICE|STATION|จ่ายบิล|PAY BILL|BILL PAY|นิติบุคคล|อาคารชุด|ร้าน|สาขา|BRANCH|PART\.|LTD\.|PLC\.|INC\.|CORP|PUBLIC\s*COMPANY|ฮับ|HUB|RAMEN|ราเมน|ปตท|PTT|น้ำมัน|OIL|GAS|PLAZA|CENTER|MART|CAFE|COFFEE|KITCHEN|RESTO|หนึ่ง|นม|นัว|หมาล่า|MALA|สุกี้|ชาบู|มหาเฮง|ข้าวเหนียว|ออมสิน|ซีเนม่า|CINEMA|CINEPLEX|เอส เอฟ|SF CINEMA|เมเจอร์|MAJOR|MEDICA|MEDICAL|อัลติเมด|ULTIMED|JENKONGKLAI|JPARK|PARKING|CAR PARK|ที่จอดรถ|GCOO|SCOOTER|สกู๊ตเตอร์|BEAM)/i;
// ชื่อไทย 2 คำ (แต่ถ้ามีคำบ่งบอกธุรกิจแล้ว จะ return false ก่อนถึงตรงนี้)
const THAI_NAME_PATTERN = /[ก-๙]{2,}\s+[ก-๙]{2,}/;

function isLikelyPersonalTransfer(desc = '') {
  if (!desc) return false;
  const clean = desc.trim();
  // ถ้ามีคำบ่งชี้ร้านค้า/บริษัท ไม่ใช่บุคคล
  if (BUSINESS_KEYWORD_REGEX.test(clean)) return false;
  // ถ้าขึ้นต้นด้วย "จ่ายบิล" คือจ่ายให้ธุรกิจ ไม่ใช่บุคคล
  if (/^จ่ายบิล\s/i.test(clean)) return false;
  if (PERSON_KEYWORD_REGEX.test(clean)) return true;
  const noAcct = clean.replace(/^[A-Z0-9\/\-]+\s*/i, '').replace(/x\d{4,}\s*/i, '').trim();
  if (PERSON_KEYWORD_REGEX.test(noAcct)) return true;
  // ชื่อไทย 2 คำ — เช็คเพิ่มว่าไม่ใช่ชื่อร้านที่มีคำบ่งบอกธุรกิจ
  if (THAI_NAME_PATTERN.test(noAcct) && !BUSINESS_KEYWORD_REGEX.test(noAcct)) return true;
  return false;
}

const BANK_TRANSACTION_CODE_RULES = [
  // 1. ถอนเงินสด / ตู้ ATM / CDM
  {
    category: 'CASH_ATM',
    label: 'กดเงินสด ATM / CDM',
    hint: 'ถอนเงินสด / ตู้ ATM / CDM',
    regex: /\b(ATM|CW|WDL|CSH|CASH|CDM|CARDLESS|ถอนเงินสด|เบิกเงินสด|WITHDRAWAL)\b/i
  },
  // 2. รูดบัตรเดบิต / ช้อปปิ้งหน้าร้าน / EDC / POS
  {
    category: 'SHOPPING',
    label: 'ช้อปปิ้ง (รูดบัตร/EDC)',
    hint: 'ชำระค่าสินค้าผ่านเครื่อง EDC / บัตรเดบิต',
    regex: /\b(POS|EDC|PUR|PURCHASE|DEBIT\s*CARD|รูดบัตร|ซื้อสินค้า)\b/i
  },
  // 3. หักบัญชีอัตโนมัติ / ชำระบิล (Direct Debit / Auto Debit)
  {
    category: 'BILLS',
    label: 'บิลหักบัญชีอัตโนมัติ (D/D)',
    hint: 'หักบัญชีเงินฝากอัตโนมัติ / ชำระบิล',
    regex: /\b(D\/D|DD|DIRECT\s*DEBIT|AUTO\s*DEBIT|BILL\s*PAYMENT|หักบัญชี|ชำระบิล)\b/i
  },
  // 4. ค่าธรรมเนียมธนาคาร
  {
    category: 'BILLS',
    label: 'ค่าธรรมเนียมธนาคาร',
    hint: 'ค่าธรรมเนียมรักษาบัญชี/รายปี/บริการ',
    regex: /\b(FEE|CHARGE|DUTY|ANNUAL\s*FEE|ค่าธรรมเนียม)\b/i
  },
  // 5. ดอกเบี้ยรับ
  {
    category: 'INCOME',
    label: 'ดอกเบี้ยเงินฝาก',
    hint: 'ดอกเบี้ยเงินฝากธนาคาร',
    regex: /\b(INT|INTEREST|ดอกเบี้ย)\b/i
  }
];

function inferByBankCode(tx = {}) {
  const fullText = [tx.code || '', tx.channel || '', tx.description || ''].join(' ');
  for (const rule of BANK_TRANSACTION_CODE_RULES) {
    if (rule.regex.test(fullText)) {
      return {
        category: rule.category,
        label: rule.label,
        hint: rule.hint
      };
    }
  }
  return null;
}

function inferContextCategory(tx = {}) {
  const desc = (tx.description || '').toUpperCase();

  // 1. ตรวจจาก Bank Code หรือชื่อช่องทาง
  const codeMatch = inferByBankCode(tx);
  if (codeMatch) return codeMatch;

  // 2. ค่าเดินทาง — ตรวจจากชื่อบริการที่ชัดเจนใน description
  if (desc.includes('GRABTAXI') || desc.includes('BOLT RIDE') || desc.includes('LINE MAN RIDE')) {
    return { category: 'TRANSPORT', label: 'การเดินทาง', hint: 'ค่าโดยสาร Grab/Bolt' };
  }

  return null;
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
        tokens.add(parts[1]); // Full last name เช่น จิตรสอาด
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

const AI_CACHE_KEY = 'tanghai_gemini_cache_v2';
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

      // 1. ตรวจสอบสมุดช่วยจำก่อนเสมอ (User Intent / MemoryStore มาก่อนกฎอัตโนมัติ)
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

      const isSelf = isMatchingOwnerName(desc, ownerNames);

      if (tx.code === 'X1' || tx.credit > 0) {
        ruleHits++;
        // เงินเข้า → INCOME เสมอ ไม่ว่าชื่อจะตรงกับเจ้าของบัญชีหรือเปล่า
        // (ไม่ใช้ชื่อมาตัดสินใจ เพราะชื่อในรายการเงินเข้าอาจซ้อนกับชื่ออื่นได้)
        return {
          ...tx,
          normKey,
          category: 'INCOME',
          source: 'RULE',
          sourceLabel: 'เงินโอนเข้า',
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

      // ด่านถอดรหัสมาตรฐานธนาคาร (Bank Transaction Code) สำหรับ KTB, BBL, TTB, BAY
      const bankCodeMatch = inferByBankCode(tx);
      if (bankCodeMatch) {
        ruleHits++;
        return {
          ...tx,
          normKey,
          category: bankCodeMatch.category,
          source: 'RULE',
          sourceLabel: bankCodeMatch.label,
          llmHint: bankCodeMatch.hint,
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
      } else {
        // ตรวจสอบบริบทการใช้จ่าย (ยอดเงิน และช่วงเวลา) เพื่อความแม่นยำสูงสุด
        const sampleTx = rawTransactions.find(t => (t.normKey || window.TangHai.MemoryStore.normalizeKey(t.description)) === merchantName);
        const contextCat = sampleTx ? inferContextCategory(sampleTx) : null;

        if (contextCat) {
          batchResults[merchantName] = {
            category: contextCat.category,
            source: 'AI_GUESS',
            sourceLabel: contextCat.label,
            llmHint: geminiCached ? geminiCached.hint : contextCat.hint,
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

      // ส่งให้ AI ช่วยดูเฉพาะรายการที่ไม่คุ้นเคยและยังไม่มีในแคช
      if (!aiCache.merchants[normKey]) {
        seenKeys.add(normKey);
        itemsToAsk.push({
          key: normKey,
          desc: desc,
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
        } else {
          const errData = await serverRes.json().catch(() => ({}));
          console.warn('Vercel Gemini API error:', errData);
          throw new Error(errData.error || `Server responded with ${serverRes.status}`);
        }
      } catch (e) {
        console.warn('Vercel Gemini call failed, checking fallback:', e);
        if (!this.getApiKey()) {
          throw e; // โยน error เพื่อให้ระบบแจ้งเตือนผู้ใช้ ไม่ใช่กลืนเงียบๆ
        }
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

      const promptText = `คุณคือผู้เชี่ยวชาญวิเคราะห์สเตทเมนต์ธนาคารไทย และระบบผู้ช่วยจัดหมวดหมู่การเงินส่วนบุคคลอัตโนมัติ
งานที่ 1: วิเคราะห์รายการใช้จ่ายต่อไปนี้ แล้วเลือก category ที่ตรงกับข้อเท็จจริงที่สุดจาก: [${availableCats.join(', ')}]
เกณฑ์การตัดสินใจ (ห้ามเดาสุ่ม อิงจากข้อเท็จจริงในชื่อรายการเท่านั้น):
1. "จ่ายบิล ..." หมายความว่าจ่ายเงินให้ธุรกิจ/ร้านค้า/บริษัท ไม่ใช่บุคคล ให้วิเคราะห์ชื่อหลัง "จ่ายบิล":
   - จ่ายบิล + ชื่อร้านอาหาร (โออิชิ, หมาล่า, ราเมน, ก๋วยเตี๋ยว, ข้าว, SUSHI, PIZZA) → FOOD
   - จ่ายบิล + ปตท / พีทีที / PTT / OIL / STATION / น้ำมัน → TRANSPORT
   - จ่ายบิล + นิติบุคคล / อาคารชุด / คอนโด / ค่าส่วนกลาง → BILLS
   - จ่ายบิล + ชื่อบริษัท (บจก. / จำกัด / LTD) → วิเคราะห์ธุรกิจหลักของบริษัทนั้น
2. วิเคราะห์ชื่อร้านค้า/ผู้รับด้วยความรู้เกี่ยวกับธุรกิจจริงในไทย:
   - PTT, ปตท, พีทีที, BANGCHAK, บางจาก, SHELL, CALTEX, SUSCO, RITTIDOL OIL → TRANSPORT
   - โออิชิ, หมาล่า, MK, ชาบู, ราเมน, RAMEN, ก๋วยเตี๋ยว, ข้าว, SUSHI, PIZZA → FOOD
   - BTS, MRT, GRAB, Bolt, รถไฟ, ทางด่วน → TRANSPORT
   - นิติบุคคลอาคารชุด, ส่วนกลาง, หอพัก, คอนโด → BILLS
   - การไฟฟ้า, ประปา, AIS, TRUE, DTAC, NETFLIX, SPOTIFY → BILLS
3. "โอนไป SCB/KBNK/KTB + ชื่อนิติบุคคล/บริษัท" → จัดหมวดตามประเภทธุรกิจ ไม่ใช่ TRANSFER_PERSON
4. กรณีโอนเงินให้บุคคลธรรมดา (ชื่อ-นามสกุลจริง ไม่ใช่ชื่อร้านค้า) → TRANSFER_PERSON เท่านั้น
5. ถ้าระบุไม่ได้จริงๆ → UNKNOWN

รายการ: ${JSON.stringify(itemsToAsk.slice(0, 40))}

งานที่ 2: สรุปภาพรวมพฤติกรรมการเงิน 3 ข้อ (summaryBullets) จากข้อมูลที่มีจริง (ห้ามกุเรื่อง)

ตอบกลับเป็น JSON เท่านั้น:
{"items":[{"key":"...","category":"...","hint":"..."}],"summaryBullets":["...","...","..."]}`;

      const isVertexKey = apiKey.startsWith('AQ.');
      const candidateModels = isVertexKey
        ? ['gemini-2.0-flash']
        : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

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
            if (response.status === 429 || response.status === 404 || response.status === 400 || response.status === 503) {
              lastError = new Error(`Gemini API Error (${response.status}) on ${model}`);
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
          const cat = item.category || 'UNKNOWN';
          const hint = item.hint || '';
          aiCache.merchants[item.key] = { category: cat, hint };
          const norm = window.TangHai.MemoryStore.normalizeKey(item.key);
          if (norm && norm !== item.key) {
            aiCache.merchants[norm] = { category: cat, hint };
          }
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
    // คำใบ้มีไว้ช่วย UX เท่านั้น — ไม่ใช้ heuristic เดาสุ่มจากยอดเงิน/วันที่
    // แสดงเฉพาะข้อมูลที่อ่านได้จาก transaction จริงๆ
    const amt = tx.debit || tx.amount || 0;
    const hour = parseInt((tx.time || '12:00').split(':')[0], 10);
    const desc = (tx.description || '').toUpperCase();

    // ช่องทางที่ชัดเจน
    if (tx.channel === 'CDM') return 'กดเงินสด ATM';
    if (desc.includes('CARDLESS ATM')) return 'กดเงินสด Cardless ATM';

    // ชื่อร้านค้าที่รู้จักชัดเจนจาก description
    if (desc.includes('GRABFOOD') || desc.includes('LINEMAN') || desc.includes('FOODPANDA')) return 'สั่งอาหาร Delivery';
    if (desc.includes('GRABTAXI') || desc.includes('BOLT')) return 'เรียกรถโดยสาร';
    if (desc.includes('BTS') || desc.includes('MRT') || desc.includes('ARL')) return 'ค่าโดยสารรถไฟฟ้า';
    if (desc.includes('NETFLIX') || desc.includes('SPOTIFY') || desc.includes('YOUTUBE')) return 'ค่าบริการ Subscription';
    if (desc.includes('SHOPEE') || desc.includes('LAZADA') || desc.includes('TIKTOK SHOP')) return 'ซื้อสินค้าออนไลน์';
    if (desc.includes('TRUE MONEY') || desc.includes('SHOPEEPAY') || desc.includes('MPTPAY')) return 'เติมเงิน e-Wallet';

    // โอนให้บุคคล — บอกแค่ว่าคือการโอนบุคคล ไม่เดาว่าซื้ออะไร
    if (desc.includes('PROMPTPAY') || /นาย|น\.ส\.|นาง/.test(tx.description || '')) {
      return 'โอนผ่าน PromptPay / บุคคล';
    }

    // ช่วงดึก — บอกข้อเท็จจริงเรื่องเวลา ไม่เดาประเภท
    if (!isNaN(hour) && hour >= 0 && hour < 5) return 'รายการช่วงดึก (00:00–04:59)';

    return '';
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

    const credits = transactions.filter(t => (t.credit || 0) > 0);
    const totalIncome = credits.reduce((s, t) => s + (t.credit || 0), 0);

    if (totalIncome > 0 && totalSpend > 0) {
      const netFlow = totalIncome - totalSpend;
      if (netFlow >= 0) {
        bullets.push(`กระแสเงินสดสุทธิเป็นบวก +฿${netFlow.toLocaleString('th-TH', { minimumFractionDigits: 2 })} (เงินเข้ามากกว่าเงินออก)`);
      } else {
        bullets.push(`กระแสเงินสดสุทธิติดลบ -฿${Math.abs(netFlow).toLocaleString('th-TH', { minimumFractionDigits: 2 })} (เงินออกมากกว่าเงินเข้า มีการใช้เงินคงเหลือเดิมในบัญชี)`);
      }
    }

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

    /**
     * ตรวจว่า description นี้มีรูปแบบเหมือน "โอนระหว่างบัญชีธนาคาร" จริงๆ
     * เช่น "SCB X3967", "KBNK X5550", "MPTPAY X7281", "โอนจาก/ไปยัง"
     * — ป้องกันไม่ให้ชื่อร้านค้าที่ "บังเอิญ" มีชื่อเจ้าของบัญชีรวมเข้ามา
     */
    function looksLikeBankTransfer(desc) {
      // รูปแบบธนาคาร/wallet มาตรฐาน: ตัวอักษร 2-7 ตัวตามด้วย x/X แล้วตามด้วยตัวเลข 3-6 ตัว
      if (/[A-Z]{2,7}\s*[Xx]\d{3,6}/i.test(desc)) return true;
      // คำที่บ่งบอกว่าเป็นการโอนระหว่างบัญชีตัวเอง
      if (/โอนจาก|โอนไป|บัญชีตัวเอง|PromptPay|พร้อมเพย์/i.test(desc)) return true;
      // ชื่อธนาคารที่รู้จักชัดเจน
      if (/^(SCB|KTB|KBNK|BBL|BAY|TTB|GSB|BAAC|UOB|CITI|LHBANK|TMB|TCRB|MPTPAY|TRUEMONEY)\s/i.test(desc)) return true;
      return false;
    }

    for (const tx of transactions) {
      const desc = tx.description || '';
      const isSelfCategory = tx.category === 'SELF_TRANSFER';

      // เงื่อนไขหลัก: รับเฉพาะรายการที่ถูก categorize เป็น SELF_TRANSFER โดยระบบ
      // หรือรายการที่มีชื่อเจ้าของบัญชี AND มีรูปแบบ bank transfer จริงๆ (ป้องกัน false positive จากร้านค้า)
      const isSelfByName = isMatchingOwnerName(desc, ownerData);
      const qualifiesAsSelfAccount = isSelfCategory || (isSelfByName && looksLikeBankTransfer(desc));

      if (!qualifiesAsSelfAccount) continue;

      // สร้าง key สำหรับกลุ่ม account: ใช้ bank code + เลขท้าย เป็นหลัก
      const bankMatch = desc.match(/([A-Z]{2,7}\s*[Xx]\d{3,6})/i);
      let acctKey;
      if (bankMatch) {
        // normalize: "KBNK X5550" → "KBNK X5550 (ชื่อเจ้าของ)"
        acctKey = `${bankMatch[1].replace(/\s+/g, ' ').toUpperCase()} (${namesArr[0] || 'บัญชีตัวเอง'})`;
      } else if (isSelfCategory) {
        // SELF_TRANSFER ที่ไม่มี bank code → ใช้ normalized description
        const normDesc = window.TangHai.MemoryStore.normalizeKey(desc);
        // ถ้า key ยาวกว่า 30 ตัวอักษร ตัดให้สั้นลง
        acctKey = normDesc.length > 30 ? normDesc.substring(0, 30) + '...' : normDesc;
      } else {
        // กรณีอื่นๆ ที่ผ่านเงื่อนไข (ไม่ควรถึงตรงนี้บ่อย) — ข้ามไป
        continue;
      }

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
  }
};
