/**
 * sampleData.js
 * กำหนดหมวดหมู่เริ่มต้น และรองรับการให้ผู้ใช้เพิ่มหมวดหมู่ของตัวเอง (Custom Categories)
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
    label: 'การเดินทาง / รถไฟฟ้า',
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
    label: 'การศึกษา / หนังสือ / คลินิกดูแลตัวเอง',
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
    label: 'โอนให้บุคคล / หารค่าใช้จ่ายกับเพื่อน',
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
    label: 'อื่นๆ / รอตรวจสอบ',
    color: '#d97706',
    dot: 'bg-amber-500'
  }
};

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

window.TangHai.addCustomCategory = function(labelText) {
  const cleanLabel = (labelText || '').trim();
  if (!cleanLabel) return null;
  const id = 'CUSTOM_' + Date.now();
  const palette = [
    { color: '#e11d48', dot: 'bg-rose-600' },
    { color: '#9333ea', dot: 'bg-purple-600' },
    { color: '#0891b2', dot: 'bg-cyan-600' },
    { color: '#65a30d', dot: 'bg-lime-600' }
  ];
  const pick = palette[Object.keys(window.TangHai.CATEGORIES).length % palette.length];

  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    custom[id] = { id, label: cleanLabel, color: pick.color, dot: pick.dot };
    localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(custom));
    window.TangHai.CATEGORIES = loadMergedCategories();
    return id;
  } catch (e) {
    return null;
  }
};


