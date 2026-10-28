/**
 * sampleData.js
 * หมวดหมู่มาตรฐาน หมวดหมู่เฉพาะบุคคล (Custom & Lifestyle Categories)
 * และข้อมูลจำลองสำหรับทดสอบระบบ (Demo Statement Data)
 */

window.TangHai = window.TangHai || {};

const CUSTOM_CAT_KEY = 'tanghai_custom_categories_v1';

const DEFAULT_CATEGORIES = {
  FOOD: {
    id: 'FOOD',
    label: 'อาหารและเครื่องดื่ม',
    color: '#ea580c',
    dot: 'bg-orange-500'
  },
  GROCERY: {
    id: 'GROCERY',
    label: 'ร้านสะดวกซื้อ / สหกรณ์ / ของชำ',
    color: '#059669',
    dot: 'bg-emerald-500'
  },
  TRANSPORT: {
    id: 'TRANSPORT',
    label: 'การเดินทาง / รถไฟฟ้า / น้ำมัน',
    color: '#0284c7',
    dot: 'bg-sky-500'
  },
  SHOPPING: {
    id: 'SHOPPING',
    label: 'ช้อปปิ้ง / เสื้อผ้า / ออนไลน์',
    color: '#db2777',
    dot: 'bg-pink-500'
  },
  EDUCATION_HEALTH: {
    id: 'EDUCATION_HEALTH',
    label: 'การศึกษา / หนังสือ / ยา / สุขภาพ',
    color: '#4f46e5',
    dot: 'bg-indigo-500'
  },
  BILLS: {
    id: 'BILLS',
    label: 'ค่าไฟ / ค่าเน็ต / ค่าหอ / บิลรายเดือน',
    color: '#2563eb',
    dot: 'bg-blue-600'
  },
  WALLET: {
    id: 'WALLET',
    label: 'เติมเงิน Wallet (TrueMoney / K Plus / LINE Pay)',
    color: '#7c3aed',
    dot: 'bg-violet-500'
  },
  CASH_ATM: {
    id: 'CASH_ATM',
    label: 'ถอนเงินสด (Cardless ATM)',
    color: '#475569',
    dot: 'bg-zinc-500'
  },
  SELF_TRANSFER: {
    id: 'SELF_TRANSFER',
    label: 'โอนระหว่างบัญชีตัวเอง / เงินผ่านมือ',
    color: '#64748b',
    dot: 'bg-slate-400'
  },
  TRANSFER_PERSON: {
    id: 'TRANSFER_PERSON',
    label: 'โอนให้บุคคล',
    color: '#0d9488',
    dot: 'bg-teal-500'
  },
  INCOME: {
    id: 'INCOME',
    label: 'รายรับ / เงินโอนเข้า',
    color: '#16a34a',
    dot: 'bg-green-600'
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    label: 'อื่นๆ',
    color: '#71717a',
    dot: 'bg-zinc-500'
  }
};

// หมวดหมู่เฉพาะทางแนะนำตามไลฟ์สไตล์ (Personalized Lifestyle Category Presets)
window.TangHai.CATEGORY_PRESETS = [
  { id: 'HOUSING', label: 'ค่าหอพัก / ค่าเช่าห้อง / ส่วนกลาง', color: '#0284c7', dot: 'bg-sky-600' },
  { id: 'PETS', label: 'สัตว์เลี้ยง (อาหารสัตว์ / คลินิก)', color: '#d97706', dot: 'bg-amber-600' },
  { id: 'STUDY_PROJECT', label: 'การศึกษา (ค่าชีท / หนังสือ / โปรเจกต์)', color: '#4f46e5', dot: 'bg-indigo-600' },
  { id: 'GAMING_TECH', label: 'เกมเมอร์ & ไอที (Steam / เติมเกม / อุปกรณ์)', color: '#9333ea', dot: 'bg-purple-600' },
  { id: 'FAMILY_CARE', label: 'ส่งให้ที่บ้าน / ครอบครัว', color: '#e11d48', dot: 'bg-rose-600' },
  { id: 'FITNESS_BEAUTY', label: 'ฟิตเนส / เสริมสวย / บำรุงผิว', color: '#db2777', dot: 'bg-pink-600' },
  { id: 'FREELANCE_BIZ', label: 'ธุรกิจส่วนตัว / สต็อกของ / พัสดุ', color: '#0d9488', dot: 'bg-teal-600' },
  { id: 'DONATION', label: 'ทำบุญ / บริจาค / ช่วยเหลือกิจกรรม', color: '#16a34a', dot: 'bg-green-600' }
];

function loadMergedCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_CATEGORIES, ...custom };
  } catch (e) {
    return { ...DEFAULT_CATEGORIES };
  }
}

window.TangHai.CATEGORIES = loadMergedCategories();

window.TangHai.getCustomCategoriesList = function() {
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    return Object.values(custom);
  } catch (e) {
    return [];
  }
};

window.TangHai.addCustomCategory = function(labelText, customColor = null) {
  const cleanLabel = (labelText || '').trim();
  if (!cleanLabel) return null;

  // ตรวจสอบว่ามีชื่อซ้ำกับหมวดหมู่ที่มีอยู่เดิมหรือไม่
  const existing = Object.values(window.TangHai.CATEGORIES).find(
    c => c.label.toLowerCase() === cleanLabel.toLowerCase()
  );
  if (existing) return existing.id;

  const id = 'CUSTOM_' + Date.now();
  const palette = [
    { color: '#e11d48', dot: 'bg-rose-600' },
    { color: '#9333ea', dot: 'bg-purple-600' },
    { color: '#0891b2', dot: 'bg-cyan-600' },
    { color: '#65a30d', dot: 'bg-lime-600' },
    { color: '#d97706', dot: 'bg-amber-600' },
    { color: '#4f46e5', dot: 'bg-indigo-600' }
  ];
  const pick = palette[Object.keys(window.TangHai.CATEGORIES).length % palette.length];

  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    custom[id] = {
      id,
      label: cleanLabel,
      color: customColor || pick.color,
      dot: pick.dot,
      isCustom: true
    };
    localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(custom));
    window.TangHai.CATEGORIES = loadMergedCategories();
    return id;
  } catch (e) {
    return null;
  }
};

window.TangHai.deleteCustomCategory = function(catId) {
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    if (custom[catId]) {
      delete custom[catId];
      localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(custom));
      window.TangHai.CATEGORIES = loadMergedCategories();
      return true;
    }
  } catch (e) {
    console.error('Failed to delete custom category:', e);
  }
  return false;
};

// ข้อมูลสเตทเมนต์ตัวอย่างสำหรับกรรมการหรือผู้ทดลองระบบ
window.TangHai.DEMO_STATEMENT_DATA = {
  fileName: 'Sample_Statement_Oct2026.pdf',
  meta: {
    totalPages: 2,
    openingBalance: 12500.00,
    closingBalance: 4120.50,
    accountName: 'นาย ทดสอบ ระบบวิเคราะห์',
    accountNo: '420-XXXXX2-5',
    period: '01/10/2026 - 27/10/2026',
    bankName: 'SCB'
  },
  transactions: [
    { id: 'demo-1', page: 1, date: '01/10/26', time: '10:15', code: 'X1', channel: 'ENET', debit: 0, credit: 15000.00, balance: 27500.00, description: 'รับโอนจาก KBNK x5550 นาย ทดสอบ ระบบวิเคราะห์', sourceBank: 'SCB' },
    { id: 'demo-2', page: 1, date: '01/10/26', time: '10:20', code: 'X2', channel: 'ENET', debit: 8500.00, credit: 0, balance: 19000.00, description: 'โอนไป KTB x5758 บจก. เดอะเรสซิเดนซ์ (ค่าเช่าหอพัก)', sourceBank: 'SCB' },
    { id: 'demo-3', page: 1, date: '02/10/26', time: '08:30', code: 'X2', channel: 'ENET', debit: 29.00, credit: 0, balance: 18971.00, description: 'จ่ายบิล ทางด่วนและรถไฟฟ้ากรุงเทพ (BEM)', sourceBank: 'SCB' },
    { id: 'demo-4', page: 1, date: '02/10/26', time: '12:15', code: 'X2', channel: 'ENET', debit: 55.00, credit: 0, balance: 18916.00, description: 'จ่ายบิล SCB มณี SHOP (ร้านอาหารตึกจุลจักรพงษ์)', sourceBank: 'SCB' },
    { id: 'demo-5', page: 1, date: '03/10/26', time: '14:00', code: 'X2', channel: 'ENET', debit: 385.00, credit: 0, balance: 18531.00, description: 'จ่ายบิล CHULALONGKORN UNIVERSITY BOOK CENTER', sourceBank: 'SCB' },
    { id: 'demo-6', page: 1, date: '05/10/26', time: '19:20', code: 'X2', channel: 'ENET', debit: 1980.00, credit: 0, balance: 16551.00, description: 'จ่ายบิล ยูนิโคล่ (UNIQLO)', sourceBank: 'SCB' },
    { id: 'demo-7', page: 1, date: '07/10/26', time: '09:24', code: 'X2', channel: 'ENET', debit: 642.50, credit: 0, balance: 15908.50, description: 'จ่ายบิล METROPOLITAN ELECTRICITY AUTHORITY', sourceBank: 'SCB' },
    { id: 'demo-8', page: 1, date: '08/10/26', time: '21:12', code: 'X2', channel: 'SIPI', debit: 300.00, credit: 0, balance: 15608.50, description: 'SIPS TRUE MONEY CO.,LTD.', sourceBank: 'SCB' },
    { id: 'demo-9', page: 1, date: '10/10/26', time: '01:25', code: 'X2', channel: 'ENET', debit: 1017.00, credit: 0, balance: 14591.50, description: 'จ่ายบิล OMISE - TIKTOK SHOP', sourceBank: 'SCB' },
    { id: 'demo-10', page: 2, date: '11/10/26', time: '17:54', code: 'X2', channel: 'ENET', debit: 854.00, credit: 0, balance: 13737.50, description: 'จ่ายบิล AIS POSTPAID / AIS FIBRE', sourceBank: 'SCB' },
    { id: 'demo-11', page: 2, date: '12/10/26', time: '16:57', code: 'X2', channel: 'CDM', debit: 1000.00, credit: 0, balance: 12737.50, description: 'Terminal No. S1JCR6603/Cardless ATM', sourceBank: 'SCB' },
    { id: 'demo-12', page: 2, date: '15/10/26', time: '12:30', code: 'X2', channel: 'ENET', debit: 50.00, credit: 0, balance: 12687.50, description: 'PromptPay x7605 นาย สมชาย ใจดี', sourceBank: 'SCB' },
    { id: 'demo-13', page: 2, date: '18/10/26', time: '19:45', code: 'X2', channel: 'ENET', debit: 50.00, credit: 0, balance: 12637.50, description: 'PromptPay x7605 นาย สมชาย ใจดี', sourceBank: 'SCB' },
    { id: 'demo-14', page: 2, date: '20/10/26', time: '18:10', code: 'X2', channel: 'ENET', debit: 470.00, credit: 0, balance: 12167.50, description: 'PromptPay x1489 น.ส. สมหญิง รักเรียน', sourceBank: 'SCB' }
  ]
};
