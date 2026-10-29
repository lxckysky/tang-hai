/**
 * memoryStore.js
 * ระบบจัดการ "สมุดช่วยจำชื่อร้าน/บัญชี" (Merchant Memory)
 * พร้อมระบบ Normalize ตัดรหัสอ้างอิงที่เปลี่ยนทุกครั้ง เช่น WIDx3672/K Plus W -> เติมเงิน K Plus W
 */

window.TangHai = window.TangHai || {};

const STORAGE_KEY = 'tanghai_merchant_memory_v2';

window.TangHai.MemoryStore = {
  getAllRules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Error reading localStorage:', err);
      return {};
    }
  },

  /**
   * สกัดชื่อผู้รับโอนมาตรฐาน (Normalize Merchant Key)
   * แก้ปัญหาเลข Reference เปลี่ยนทุกครั้ง และตัดคำนำหน้าการโอน
   */
  normalizeKey(description = '') {
    if (!description) return '';
    let s = description.trim();
    s = s.replace(/WIDx\d+\/?/gi, '');
    s = s.replace(/Terminal\s*No\.\s*[A-Z0-9]+\/?/gi, '');
    s = s.replace(/^(?:ชำระเงินค่าสินค้า\/บริการ|ชำระค่าสินค้า|จ่ายบิล|โอนเงินไป|โอนไป|โอนให้|รับโอนจาก|รับโอนเงินจาก|สแกนจ่าย|ชำระเงิน)\s+/i, '');
    s = s.replace(/\b(?:PromptPay|[A-Z]{2,6})\s*[Xx]\d{3,6}\b/gi, '');
    return s.replace(/\s+/g, ' ').trim() || description.trim();
  },

  findMatch(description = '') {
    const rules = this.getAllRules();
    const normalized = this.normalizeKey(description);
    if (!normalized && !description) return null;

    if (normalized && rules[normalized]) {
      return { key: normalized, ...rules[normalized] };
    }
    if (description && rules[description]) {
      return { key: description, ...rules[description] };
    }

    for (const [savedKey, ruleData] of Object.entries(rules)) {
      if (savedKey.length >= 3 && (normalized.includes(savedKey) || description.includes(savedKey))) {
        return { key: savedKey, ...ruleData };
      }
    }
    return null;
  },

  saveRule(description, category, alias = '') {
    const rules = this.getAllRules();
    const key = this.normalizeKey(description);
    if (!key) return null;

    rules[key] = {
      category,
      alias: alias.trim() || key,
      updatedAt: new Date().toLocaleDateString('th-TH')
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    return { key, ...rules[key] };
  },

  deleteRule(key) {
    const rules = this.getAllRules();
    delete rules[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  },

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
