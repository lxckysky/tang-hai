/**
 * app.js
 * ตัวควบคุมหลักสำหรับ TangHai (Minimal Clean Edition)
 * เริ่มต้นที่หน้าอัปโหลดไฟล์ PDF จริง รองรับการปลดล็อกรหัสผ่าน และการตรวจสอบรายการแบบละเอียด
 */

window.TangHai = window.TangHai || {};

const SESSION_STORAGE_KEY = 'tanghai_saved_session_v1';
const CONSENT_STORAGE_KEY = 'tanghai_consent_accepted_v1';

const AppState = {
  fileName: '',
  meta: { totalPages: 0, openingBalance: null, closingBalance: null },
  rawTransactions: [],
  transactions: [],
  insights: [],
  aiSummaryBullets: [],
  selfAccounts: [],
  priorityGroups: [],
  stats: null,
  activeFilter: 'ALL',
  sortBy: 'AMOUNT_DESC',
  hideSelfTransfers: true,
  searchQuery: '',
  pendingPdfBuffer: null
};

function saveSessionToStorage() {
  try {
    if (!AppState.rawTransactions.length) return;
    const payload = {
      fileName: AppState.fileName,
      meta: AppState.meta,
      rawTransactions: AppState.rawTransactions
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

function restoreSessionFromStorage() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.rawTransactions) && data.rawTransactions.length > 0) {
      AppState.fileName = data.fileName || 'รายการเดินบัญชีที่บันทึกไว้';
      AppState.meta = data.meta || { totalPages: 1, openingBalance: null, closingBalance: null };
      AppState.rawTransactions = data.rawTransactions;
      runAnalysisAndRender(false);
      return true;
    }
  } catch (e) {
    console.error('Failed to restore session:', e);
  }
  return false;
}

window.TangHai.clearSession = function() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  AppState.rawTransactions = [];
  AppState.transactions = [];
  document.getElementById('workspace-view')?.classList.add('hidden');
  document.getElementById('header-actions')?.classList.add('hidden');
  document.getElementById('desktop-nav')?.classList.add('hidden');
  document.getElementById('mobile-bottom-nav')?.classList.add('hidden');
  document.getElementById('empty-upload-view')?.classList.remove('hidden');
  document.getElementById('file-meta-title').textContent = 'TangHai';
  document.getElementById('file-meta-sub').textContent = 'ระบบวิเคราะห์รายการเดินบัญชี';
  notify('ล้างข้อมูลสเตทเมนต์เรียบร้อย พร้อมอัปโหลดไฟล์ใหม่');
};

window.TangHai.acceptConsent = function() {
  localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
  document.getElementById('consent-banner')?.classList.add('hidden');
  notify('บันทึกการอนุญาตจัดเก็บข้อมูลในเบราว์เซอร์เรียบร้อย');
};

window.TangHai.handleAddCustomCategory = function() {
  const input = document.getElementById('custom-cat-input');
  if (!input) return;
  const label = input.value.trim();
  if (!label) {
    notify('กรุณาพิมพ์ชื่อหมวดหมู่ที่ต้องการเพิ่ม');
    return;
  }
  const newId = window.TangHai.addCustomCategory(label);
  if (newId) {
    input.value = '';
    runAnalysisAndRender();
    notify(`เพิ่มหมวดหมู่ "${label}" เรียบร้อยแล้ว!`);
  }
};

function formatNumber(num) {
  return Number(num || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function isLateNightTime(timeStr = '') {
  const hour = parseInt(timeStr.split(':')[0], 10);
  return !isNaN(hour) && hour >= 0 && hour < 5;
}

function notify(message) {
  const el = document.getElementById('status-toast');
  const textEl = document.getElementById('status-toast-text');
  if (!el || !textEl) return;
  textEl.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 3200);
}

function runAnalysisAndRender(shouldSave = true) {
  if (!AppState.rawTransactions.length) return;

  const result = window.TangHai.Categorizer.analyzeTransactions(AppState.rawTransactions, AppState.meta);
  AppState.transactions = result.transactions;
  AppState.insights = result.insights || [];
  AppState.aiSummaryBullets = result.aiSummaryBullets || [];
  AppState.selfAccounts = result.selfAccounts || [];
  AppState.priorityGroups = result.priorityGroups || [];
  AppState.stats = result.stats;

  if (shouldSave) {
    saveSessionToStorage();
  }

  document.getElementById('empty-upload-view')?.classList.add('hidden');
  document.getElementById('workspace-view')?.classList.remove('hidden');
  document.getElementById('header-actions')?.classList.remove('hidden');
  document.getElementById('desktop-nav')?.classList.remove('hidden');
  document.getElementById('mobile-bottom-nav')?.classList.remove('hidden');

  const pCount = AppState.priorityGroups.length;
  const navBadge = document.getElementById('nav-badge-priority');
  const mobBadge = document.getElementById('mobile-badge-priority');
  const banner = document.getElementById('overview-priority-banner');
  if (navBadge) navBadge.textContent = pCount;
  if (mobBadge) mobBadge.textContent = pCount;
  if (banner) {
    if (pCount > 0) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
  }

  renderOverviewMetrics();
  renderAISummary();
  renderSelfAccountsFlow();
  renderPriorityQueue();
  renderCategoryBreakdown();
  renderTopRecipients();
  renderDetectedInsights();
  renderMemoryRules();
  renderTransactionTable();
}

function renderAISummary() {
  const container = document.getElementById('ai-summary-list');
  if (!container) return;
  const bullets = AppState.aiSummaryBullets || [];
  container.innerHTML = bullets
    .map(b => `<li class="text-xs text-zinc-700 leading-relaxed flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-1.5 shrink-0"></span><span>${b}</span></li>`)
    .join('');
}

window.TangHai.switchPage = function(pageName) {
  document.querySelectorAll('.page-view').forEach(el => {
    if (el.id === `page-${pageName}`) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  document.querySelectorAll('.nav-page-btn').forEach(btn => {
    const active = btn.getAttribute('data-page') === pageName;
    btn.className = active
      ? 'nav-page-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-zinc-900 shadow-sm transition flex items-center gap-1.5'
      : 'nav-page-btn px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 transition flex items-center gap-1.5';
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const active = btn.getAttribute('data-page') === pageName;
    btn.className = active
      ? 'mobile-nav-btn py-2 px-1 rounded-xl text-xs font-semibold bg-zinc-900 text-white text-center transition'
      : 'mobile-nav-btn py-2 px-1 rounded-xl text-xs font-medium text-zinc-600 text-center transition';
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderOverviewMetrics() {
  const txs = AppState.transactions;
  const stats = AppState.stats;

  const totalIncome = txs.reduce((sum, t) => sum + (t.credit || 0), 0);
  const totalExpense = txs.reduce((sum, t) => sum + (t.debit || 0), 0);

  // คำนวณยอดโอนบัญชีตัวเอง + เงินผ่านมือ (Pass-Through)
  const selfAndPassTotal = txs
    .filter(t => t.debit > 0 && t.category === 'SELF_TRANSFER')
    .reduce((sum, t) => sum + t.debit, 0);

  // รายจ่ายใช้ชีวิตจริง (ไม่รวมการโยกเงินเข้าบัญชีตัวเองและเงินผ่านมือก้อนใหญ่)
  const truePersonalSpend = Math.max(0, totalExpense - selfAndPassTotal);

  const lateTxs = txs.filter(t => t.debit > 0 && t.category !== 'SELF_TRANSFER' && isLateNightTime(t.time));
  const lateTotal = lateTxs.reduce((sum, t) => sum + t.debit, 0);

  const ownerLabel = AppState.meta.accountName ? `${AppState.meta.accountName} (${AppState.meta.accountNo || ''})` : AppState.fileName;
  document.getElementById('file-meta-title').textContent = ownerLabel || 'รายการเดินบัญชี';

  const openStr = AppState.meta.openingBalance !== null ? `ยอดยกมา ${formatNumber(AppState.meta.openingBalance)}` : '';
  const closeStr = AppState.meta.closingBalance !== null ? `คงเหลือ ${formatNumber(AppState.meta.closingBalance)}` : '';
  document.getElementById('file-meta-sub').textContent =
    [
      AppState.meta.bankName || '',
      AppState.meta.period || '',
      `${AppState.meta.totalPages || 1} หน้า (${txs.length} รายการ)`,
      openStr,
      closeStr
    ].filter(Boolean).join(' · ');

  document.getElementById('metric-income').textContent = formatNumber(totalExpense);
  document.getElementById('metric-income-sub').textContent =
    `ยอดเงินเข้าหน้าสเตทเมนต์ +${formatNumber(totalIncome)} (${txs.filter(t => t.credit > 0).length} รายการ)`;

  document.getElementById('metric-expense').textContent = formatNumber(truePersonalSpend);
  document.getElementById('metric-expense-sub').textContent =
    `หักโอนบัญชีตัวเองและเงินผ่านมือออก ${formatNumber(selfAndPassTotal)} บาท`;

  const netEl = document.getElementById('metric-net');
  netEl.textContent = formatNumber(lateTotal);
  netEl.className = 'text-2xl font-semibold tabular-nums tracking-tight mt-1 text-zinc-900';
  document.getElementById('metric-net-sub').textContent =
    `โอนช่วงดึก (00:00–05:00) จำนวน ${lateTxs.length} ครั้ง`;

  const uncatCount = txs.filter(t => t.category === 'UNKNOWN').length;
  document.getElementById('metric-review').textContent = `${uncatCount} รายการ`;
  document.getElementById('metric-review-sub').textContent =
    `คัดกรองกลุ่มชื่อซ้ำเหลือ ${stats.uniqueMerchantsSentToAI} ชื่อผู้รับ (ลดภาระ AI ${stats.savedApiPercent}%)`;

  document.getElementById('count-all').textContent = txs.length;
  document.getElementById('count-unknown').textContent = uncatCount;
  document.getElementById('count-ai').textContent = txs.filter(t => t.source === 'AI_GUESS').length;
  document.getElementById('count-memory').textContent = txs.filter(t => t.source === 'MEMORY').length;
}

function renderCategoryBreakdown() {
  const container = document.getElementById('category-list');
  if (!container) return;

  // คำนวณสัดส่วนจากรายจ่ายจริง (ไม่นับโอนเข้าบัญชีตัวเองเพื่อให้เห็นสัดส่วนค่ากิน/ช้อปปิ้งที่แท้จริง)
  const expenseTxs = AppState.transactions.filter(t => t.debit > 0 && t.category !== 'SELF_TRANSFER');
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.debit, 0) || 1;

  const map = {};
  for (const tx of expenseTxs) {
    const c = tx.category || 'UNKNOWN';
    if (!map[c]) map[c] = { amount: 0, count: 0 };
    map[c].amount += tx.debit;
    map[c].count += 1;
  }

  const sorted = Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);

  container.innerHTML = sorted.map(([catKey, data]) => {
    const cat = window.TangHai.CATEGORIES[catKey] || window.TangHai.CATEGORIES.UNKNOWN;
    const pct = ((data.amount / totalExpense) * 100).toFixed(1);
    return `
      <div onclick="window.TangHai.openCategoryModal('${catKey}')"
        class="group p-3 -mx-3 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200/80 cursor-pointer transition space-y-2">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 ${cat.dot}"></span>
            <span class="font-medium text-zinc-900 group-hover:underline truncate">${cat.label}</span>
            <span class="text-zinc-400 shrink-0">(${data.count} รายการ)</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="tabular-nums font-semibold text-zinc-900">
              ${formatNumber(data.amount)} <span class="text-zinc-400 font-normal">(${pct}%)</span>
            </span>
            <span class="text-[11px] text-zinc-400 group-hover:text-zinc-900 transition">ดูรายการ →</span>
          </div>
        </div>
        <div class="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-300" style="width: ${Math.max(pct, 2)}%; background-color: ${cat.color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// เปิดหน้าต่างเจาะลึกหมวดหมู่ (แสดงทั้งยอดรวมตามชื่อร้าน และรายการโอนทั้งหมด เรียงจากยอดใหญ่สุด -> เล็กสุด)
window.TangHai.openCategoryModal = function(catKey) {
  const modal = document.getElementById('category-detail-modal');
  if (!modal) return;

  const cat = window.TangHai.CATEGORIES[catKey] || window.TangHai.CATEGORIES.UNKNOWN;
  const txsInCat = AppState.transactions
    .filter(t => (t.category || 'UNKNOWN') === catKey && (t.debit > 0 || t.credit > 0))
    .sort((a, b) => Math.max(b.debit || 0, b.credit || 0) - Math.max(a.debit || 0, a.credit || 0));

  const totalAmount = txsInCat.reduce((sum, t) => sum + (t.debit || t.credit || 0), 0);

  const dotEl = document.getElementById('cat-modal-dot');
  if (dotEl) dotEl.className = `w-2.5 h-2.5 rounded-full ${cat.dot}`;
  document.getElementById('cat-modal-title').textContent = cat.label;
  document.getElementById('cat-modal-subtitle').textContent =
    `รวมทั้งหมด ${formatNumber(totalAmount)} บาท · ${txsInCat.length} รายการ (เรียงจากยอดเงินใหญ่สุดลงมาเล็กสุด)`;

  // 1. สรุปแยกตามชื่อผู้รับในหมวดหมู่นี้ เรียงจากยอดรวมใหญ่สุด -> เล็กสุด
  const merchantMap = {};
  for (const tx of txsInCat) {
    const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
    if (!merchantMap[key]) {
      merchantMap[key] = { name: key, alias: tx.userNote || '', total: 0, count: 0 };
    }
    merchantMap[key].total += tx.debit || tx.credit || 0;
    merchantMap[key].count += 1;
    if (tx.userNote) merchantMap[key].alias = tx.userNote;
  }
  const sortedMerchants = Object.values(merchantMap).sort((a, b) => b.total - a.total);

  const merchantsEl = document.getElementById('cat-modal-merchants');
  merchantsEl.innerHTML = sortedMerchants.map((m, idx) => `
    <div class="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-2 text-xs">
      <div class="min-w-0">
        <div class="font-medium text-zinc-900 truncate">${idx + 1}. ${m.name}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">
          ${m.count} ครั้ง${m.alias ? ` · ช่วยจำ: ${m.alias}` : ''}
        </div>
      </div>
      <div class="tabular-nums font-semibold text-zinc-900 shrink-0">
        ${formatNumber(m.total)}
      </div>
    </div>
  `).join('');

  // 2. รายการโอนรายครั้งในหมวดนี้ เรียงจากยอดเงินใหญ่สุด -> เล็กสุด พร้อมเปลี่ยนหมวดได้ทันที
  const categoryOptionsHtml = selectedCat =>
    Object.values(window.TangHai.CATEGORIES)
      .map(c => `<option value="${c.id}" ${c.id === selectedCat ? 'selected' : ''}>${c.label}</option>`)
      .join('');

  const txListEl = document.getElementById('cat-modal-transactions');
  txListEl.innerHTML = txsInCat.map((tx, idx) => `
    <div class="p-3.5 bg-white hover:bg-zinc-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div class="min-w-0 space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="text-zinc-400 font-mono text-[11px]">#${idx + 1}</span>
          <span class="font-semibold text-zinc-900">${tx.description}</span>
        </div>
        <div class="text-[11px] text-zinc-500 pl-5">
          วันที่ ${tx.date} เวลา ${tx.time} · ${tx.sourceLabel}${tx.userNote ? ` · ช่วยจำ: ${tx.userNote}` : ''}
        </div>
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <span class="text-sm font-bold tabular-nums text-zinc-900">
          ${tx.credit > 0 ? `+${formatNumber(tx.credit)}` : `-${formatNumber(tx.debit)}`}
        </span>
        <select onchange="window.TangHai.changeCategoryFromModal('${tx.id}', this.value, '${catKey}')"
          class="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:border-zinc-900">
          ${categoryOptionsHtml(tx.category)}
        </select>
      </div>
    </div>
  `).join('');

  modal.classList.remove('hidden');
};

window.TangHai.closeCategoryModal = function() {
  document.getElementById('category-detail-modal')?.classList.add('hidden');
};

window.TangHai.changeCategoryFromModal = function(txId, newCategory, currentModalCatKey) {
  AppState.rawTransactions = AppState.rawTransactions.map(item => {
    if (item.id === txId) {
      return { ...item, rowCategoryOverride: newCategory };
    }
    return item;
  });
  runAnalysisAndRender();
  window.TangHai.openCategoryModal(currentModalCatKey);
  notify('ย้ายหมวดหมู่เรียบร้อยแล้ว');
};

function renderTopRecipients() {
  const container = document.getElementById('top-recipients-list');
  if (!container) return;

  const map = {};
  for (const tx of AppState.transactions) {
    if (!tx.debit || tx.debit <= 0 || tx.category === 'SELF_TRANSFER') continue;
    const key = tx.normKey || window.TangHai.MemoryStore.normalizeKey(tx.description);
    if (!map[key]) {
      map[key] = { name: key, alias: tx.userNote || '', total: 0, count: 0, category: tx.category };
    }
    map[key].total += tx.debit;
    map[key].count += 1;
    if (tx.userNote) map[key].alias = tx.userNote;
  }

  const top = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);

  container.innerHTML = top.map((item, i) => {
    const cat = window.TangHai.CATEGORIES[item.category] || window.TangHai.CATEGORIES.UNKNOWN;
    const safeName = item.name.replace(/'/g, "\\'");
    return `
      <div onclick="window.TangHai.filterByRecipient('${safeName}')"
        class="group flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-0 text-xs transition">
        <div class="min-w-0 pr-3">
          <div class="flex items-center gap-2">
            <span class="text-zinc-400 font-mono w-4">${i + 1}.</span>
            <span class="font-medium text-zinc-900 group-hover:underline truncate">${item.name}</span>
          </div>
          <div class="pl-6 text-[11px] text-zinc-500 mt-0.5">
            ${item.count} ครั้ง · ${item.alias ? `ช่วยจำ: ${item.alias}` : cat.label}
          </div>
        </div>
        <div class="tabular-nums font-semibold text-zinc-900 shrink-0 flex items-center gap-1.5">
          <span>${formatNumber(item.total)}</span>
          <span class="text-[11px] text-zinc-400 group-hover:text-zinc-900">→</span>
        </div>
      </div>
    `;
  }).join('');
}

window.TangHai.filterByRecipient = function(recipientName) {
  AppState.searchQuery = recipientName;
  AppState.activeFilter = 'ALL';
  const searchInput = document.getElementById('search-tx-input');
  if (searchInput) searchInput.value = recipientName;
  window.TangHai.setFilter('ALL');
  window.TangHai.switchPage('TRANSACTIONS');
};

function renderDetectedInsights() {
  const container = document.getElementById('daily-spikes-list');
  if (!container) return;

  const events = AppState.insights || [];
  if (events.length === 0) {
    container.innerHTML = `<div class="py-4 text-xs text-zinc-400">ไม่พบรายการหารกลุ่มหรือเงินผ่านมือ</div>`;
    return;
  }

  container.innerHTML = events.map(ev => `
    <div class="py-2.5 border-b border-zinc-100 last:border-0 text-xs space-y-0.5">
      <div class="font-medium text-zinc-900">${ev.title}</div>
      <div class="text-[11px] text-zinc-500 leading-relaxed">${ev.detail}</div>
    </div>
  `).join('');
}

function renderMemoryRules() {
  const container = document.getElementById('memory-list');
  if (!container) return;

  const rules = window.TangHai.MemoryStore.getAllRules();
  const entries = Object.entries(rules);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="py-6 text-center text-xs text-zinc-400">
        ยังไม่มีรายชื่อที่บันทึกไว้ในสมุดช่วยจำ<br/>
        เมื่อคุณกดปุ่ม "จำทุกบรรทัด" ในตาราง ระบบจะบันทึกชื่อบัญชีไว้ที่นี่เพื่อแยกให้อัตโนมัติในครั้งถัดไป
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([key, rule]) => {
    const cat = window.TangHai.CATEGORIES[rule.category] || window.TangHai.CATEGORIES.UNKNOWN;
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 border border-zinc-200/80 text-xs">
        <div class="min-w-0 pr-2">
          <div class="font-medium text-zinc-900 truncate">${rule.alias}</div>
          <div class="text-[11px] text-zinc-500 truncate">${key} · ${cat.label}</div>
        </div>
        <button onclick="window.TangHai.removeMemoryRule('${key.replace(/'/g, "\\'")}')"
          class="text-zinc-400 hover:text-rose-600 px-2 py-1 text-xs transition">
          ลบ
        </button>
      </div>
    `;
  }).join('');
}

function renderSelfAccountsFlow() {
  const container = document.getElementById('self-accounts-list');
  if (!container) return;

  const list = AppState.selfAccounts || [];
  if (list.length === 0) {
    container.innerHTML = `<div class="text-xs text-zinc-400 py-3">ไม่พบรายการโอนระหว่างบัญชีชื่อเดียวกัน</div>`;
    return;
  }

  container.innerHTML = list.map(acc => {
    const net = acc.inflow - acc.outflow;
    const netDesc = net >= 0
      ? `ดึงเข้าสุทธิ +${formatNumber(net)}`
      : `โอนออกสุทธิ -${formatNumber(Math.abs(net))}`;

    return `
      <div class="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div>
          <div class="font-semibold text-zinc-900">${acc.accountLabel}</div>
          <div class="text-[11px] text-zinc-500 mt-0.5">
            โอนเข้า ${acc.inCount} ครั้ง (+${formatNumber(acc.inflow)}) · โอนออก ${acc.outCount} ครั้ง (-${formatNumber(acc.outflow)})
          </div>
        </div>
        <div class="tabular-nums font-semibold ${net >= 0 ? 'text-emerald-700' : 'text-zinc-700'}">
          ${netDesc}
        </div>
      </div>
    `;
  }).join('');
}

function renderPriorityQueue() {
  const container = document.getElementById('priority-queue-list');
  const badge = document.getElementById('priority-queue-count');
  if (!container) return;

  const groups = AppState.priorityGroups || [];
  if (badge) badge.textContent = `${groups.length} รายชื่อผู้รับ`;

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center space-y-2">
        <div class="text-sm font-semibold text-emerald-700">ระบุหมวดหมู่ครบทุกรายการแล้ว</div>
        <p class="text-xs text-zinc-500">ไม่มีรายการค้างตรวจสอบ สามารถดูสรุปภาพรวมหรือส่งออกไฟล์ CSV ได้ทันที</p>
      </div>
    `;
    return;
  }

  const categoryOptionsHtml = Object.values(window.TangHai.CATEGORIES)
    .filter(c => c.id !== 'UNKNOWN' && c.id !== 'INCOME')
    .map(c => `<option value="${c.id}">${c.label}</option>`)
    .join('');

  container.innerHTML = groups.map((g, idx) => `
    <div class="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-md bg-zinc-900 text-white text-xs font-semibold tabular-nums">อันดับ ${idx + 1} · -${formatNumber(g.totalAmount)} บาท</span>
          <span class="text-sm font-semibold text-zinc-900">${g.normKey}</span>
          <span class="text-xs text-zinc-500">(${g.count} ครั้ง)</span>
        </div>
        <div class="text-xs text-zinc-500">
          เวลาที่โอน: ${g.dates.join(', ')}${g.count > 3 ? ' ...' : ''}
          ${g.autoHint ? `<span class="ml-2 text-teal-700 font-medium">(${g.autoHint})</span>` : ''}
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
        <select id="pq-cat-${idx}" class="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900">
          ${categoryOptionsHtml}
        </select>
        <input id="pq-note-${idx}" type="text" placeholder="ช่วยจำ เช่น ค่าหอ, ร้านข้าว..."
          class="sm:w-48 bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900" />
        <button onclick="window.TangHai.savePriorityGroup(${idx}, '${g.sampleTxId}')"
          class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition shrink-0">
          บันทึก (${g.count} รายการ)
        </button>
      </div>
    </div>
  `).join('');
}

window.TangHai.savePriorityGroup = function(groupIdx, sampleTxId) {
  const tx = AppState.rawTransactions.find(t => t.id === sampleTxId);
  if (!tx) return;

  const catEl = document.getElementById(`pq-cat-${groupIdx}`);
  const noteEl = document.getElementById(`pq-note-${groupIdx}`);
  const newCategory = catEl ? catEl.value : 'FOOD';
  const newAlias = noteEl ? noteEl.value.trim() : '';

  const saved = window.TangHai.MemoryStore.saveRule(tx.description, newCategory, newAlias);
  const normKey = window.TangHai.MemoryStore.normalizeKey(tx.description);

  let updatedCount = 0;
  AppState.rawTransactions = AppState.rawTransactions.map(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
      updatedCount++;
      return { ...item, rowCategoryOverride: null, userNote: newAlias || item.userNote };
    }
    return item;
  });

  runAnalysisAndRender();
  notify(`ระบุ "${saved.key}" เรียบร้อย (เคลียร์พร้อมกัน ${updatedCount} รายการ)`);
};

function renderTransactionTable() {
  const tbody = document.getElementById('transaction-tbody');
  if (!tbody) return;

  const filtered = AppState.transactions.filter(tx => {
    if (AppState.hideSelfTransfers && tx.category === 'SELF_TRANSFER') return false;
    if (AppState.activeFilter === 'NEEDS_INPUT' && tx.category !== 'UNKNOWN') return false;
    if (AppState.activeFilter === 'AI_GUESS' && tx.source !== 'AI_GUESS') return false;
    if (AppState.activeFilter === 'MEMORY' && tx.source !== 'MEMORY') return false;
    if (AppState.searchQuery) {
      const q = AppState.searchQuery.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.userNote || '').toLowerCase().includes(q) ||
        (tx.date || '').includes(q)
      );
    }
    return true;
  });

  // เรียงลำดับตามที่ผู้ใช้เลือก (ค่าเริ่มต้น: เอายอดเงินใหญ่สุดขึ้นก่อนเพื่อให้นึกออกง่าย!)
  if (AppState.sortBy === 'AMOUNT_DESC') {
    filtered.sort((a, b) => Math.max(b.debit || 0, b.credit || 0) - Math.max(a.debit || 0, a.credit || 0));
  } else if (AppState.sortBy === 'AMOUNT_ASC') {
    filtered.sort((a, b) => Math.max(a.debit || 0, a.credit || 0) - Math.max(b.debit || 0, b.credit || 0));
  }
  // ถ้าเป็น DATE_ASC จะเรียงตามลำดับในไฟล์ PDF เดิมอยู่แล้ว

  const categoryOptionsHtml = selectedCat =>
    Object.values(window.TangHai.CATEGORIES)
      .map(c => `<option value="${c.id}" ${c.id === selectedCat ? 'selected' : ''}>${c.label}</option>`)
      .join('');

  const mobileContainer = document.getElementById('transaction-mobile-cards');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-xs text-zinc-400">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</td>
      </tr>
    `;
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div class="py-12 text-center text-xs text-zinc-400">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</div>`;
    }
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const isUnknown = tx.category === 'UNKNOWN';
    const isLate = tx.debit > 0 && isLateNightTime(tx.time);
    const rowBg = isUnknown ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-zinc-50';

    let sourcePillClass = 'bg-zinc-100 text-zinc-600';
    if (tx.source === 'AI_GUESS') sourcePillClass = 'bg-indigo-50 text-indigo-700';
    if (tx.source === 'MEMORY') sourcePillClass = 'bg-emerald-50 text-emerald-700';
    if (tx.source === 'NEEDS_INPUT') sourcePillClass = 'bg-amber-100/80 text-amber-800';

    return `
      <tr class="border-b border-zinc-100 transition-colors ${rowBg}">
        <td class="py-4 px-5 whitespace-nowrap text-xs">
          <div class="font-medium text-zinc-900 tabular-nums">${tx.date}</div>
          <div class="text-zinc-400 tabular-nums flex items-center gap-1.5 mt-0.5">
            <span>${tx.time}</span>
            ${isLate ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 font-medium">ดึก</span>' : ''}
          </div>
        </td>
        <td class="py-4 px-5 text-xs">
          <div class="font-medium text-zinc-900">${tx.description}</div>
          <div class="flex flex-wrap items-center gap-1.5 mt-1">
            <span class="text-[11px] font-mono text-zinc-400">${tx.code} · ${tx.channel}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-md font-medium ${sourcePillClass}">${tx.sourceLabel}</span>
          </div>
          ${tx.autoHint ? `<div class="mt-1.5 text-[11px] text-teal-700 bg-teal-50 border border-teal-200/70 rounded px-2 py-0.5 inline-block">${tx.autoHint}</div>` : ''}
        </td>
        <td class="py-4 px-5 whitespace-nowrap text-right tabular-nums">
          <div class="text-sm font-semibold ${tx.credit > 0 ? 'text-emerald-700' : 'text-zinc-900'}">
            ${tx.credit > 0 ? `+${formatNumber(tx.credit)}` : `-${formatNumber(tx.debit)}`}
          </div>
          <div class="text-[11px] text-zinc-400 mt-0.5">คงเหลือ ${formatNumber(tx.balance)}</div>
        </td>
        <td class="py-4 px-5 text-xs">
          <select id="cat-${tx.id}" onchange="window.TangHai.autoSaveRowChange('${tx.id}', false)"
            class="w-full bg-white border ${isUnknown ? 'border-amber-400 text-amber-900 font-medium' : 'border-zinc-200 text-zinc-800'} rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 cursor-pointer">
            ${categoryOptionsHtml(tx.category)}
          </select>
        </td>
        <td class="py-4 px-5 text-xs">
          <input id="note-${tx.id}" type="text" value="${tx.userNote || ''}"
            onchange="window.TangHai.autoSaveRowChange('${tx.id}', false)"
            placeholder="พิมพ์ช่วยจำแล้วกด Enter (บันทึกอัตโนมัติ)..."
            class="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900" />
        </td>
      </tr>
    `;
  }).join('');

  if (mobileContainer) {
    mobileContainer.innerHTML = filtered.map(tx => {
      const isUnknown = tx.category === 'UNKNOWN';
      return `
        <div class="p-4 space-y-3 ${isUnknown ? 'bg-amber-50/40' : 'bg-white'}">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-zinc-900 break-words">${tx.description}</div>
              <div class="text-xs text-zinc-500 mt-0.5">${tx.date} เวลา ${tx.time} · ${tx.sourceLabel}</div>
            </div>
            <div class="text-right tabular-nums shrink-0">
              <div class="text-sm font-bold ${tx.credit > 0 ? 'text-emerald-700' : 'text-zinc-900'}">
                ${tx.credit > 0 ? `+${formatNumber(tx.credit)}` : `-${formatNumber(tx.debit)}`}
              </div>
              <div class="text-[11px] text-zinc-400">คงเหลือ ${formatNumber(tx.balance)}</div>
            </div>
          </div>
          ${tx.autoHint ? `<div class="text-xs text-teal-700 bg-teal-50 border border-teal-200/70 rounded-lg px-2.5 py-1">${tx.autoHint}</div>` : ''}
          <div class="space-y-2 pt-1">
            <select id="cat-m-${tx.id}" onchange="window.TangHai.autoSaveRowChange('${tx.id}', true)"
              class="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900">
              ${categoryOptionsHtml(tx.category)}
            </select>
            <input id="note-m-${tx.id}" type="text" value="${tx.userNote || ''}"
              onchange="window.TangHai.autoSaveRowChange('${tx.id}', true)"
              placeholder="พิมพ์ช่วยจำแล้วแตะออก (บันทึกอัตโนมัติ)..."
              class="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400" />
          </div>
        </div>
      `;
    }).join('');
  }
}

// บันทึกอัตโนมัติทันทีที่ผู้ใช้เปลี่ยนหมวดหมู่หรือพิมพ์หมายเหตุ (ไม่ต้องกดปุ่มแยกให้สับสน)
window.TangHai.autoSaveRowChange = function(txId, isMobile = false) {
  const tx = AppState.rawTransactions.find(t => t.id === txId);
  if (!tx) return;

  const catSelect = document.getElementById(isMobile ? `cat-m-${txId}` : `cat-${txId}`);
  const noteInput = document.getElementById(isMobile ? `note-m-${txId}` : `note-${txId}`);
  const newCategory = catSelect ? catSelect.value : tx.category;
  const newAlias = noteInput ? noteInput.value.trim() : '';

  const normKey = window.TangHai.MemoryStore.normalizeKey(tx.description);
  const isGenericWalletOrAtm = /TRUE MONEY|K PLUS W|LINE PAY|CARDLESS ATM|INTERNET|KTB/i.test(normKey);

  if (isGenericWalletOrAtm) {
    // ถ้ารายการเป็นเติมเงิน Wallet หรือกด ATM ให้บันทึกเฉพาะบรรทัดนี้
    AppState.rawTransactions = AppState.rawTransactions.map(item =>
      item.id === txId ? { ...item, rowCategoryOverride: newCategory, userNote: newAlias } : item
    );
    runAnalysisAndRender();
    notify('บันทึกการแก้ไขเรียบร้อยแล้ว');
  } else {
    // ถ้าเป็นชื่อคนหรือชื่อร้านค้า ให้จำชื่อนี้ไว้ใช้กับทุกบรรทัดที่ชื่อตรงกันอัตโนมัติ!
    window.TangHai.MemoryStore.saveRule(tx.description, newCategory, newAlias);
    let updatedCount = 0;
    AppState.rawTransactions = AppState.rawTransactions.map(item => {
      if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
        updatedCount++;
        return { ...item, rowCategoryOverride: null, userNote: newAlias || item.userNote };
      }
      return item;
    });
    runAnalysisAndRender();
    notify(`บันทึกอัตโนมัติเรียบร้อย (อัปเดตชื่อ "${normKey}" ทั้งหมด ${updatedCount} รายการ)`);
  }
};

window.TangHai.removeMemoryRule = function(key) {
  window.TangHai.MemoryStore.deleteRule(key);
  runAnalysisAndRender();
  notify(`ลบ "${key}" ออกจากสมุดช่วยจำแล้ว`);
};

window.TangHai.setFilter = function(filterType) {
  AppState.activeFilter = filterType;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const active = btn.getAttribute('data-filter') === filterType;
    btn.className = active
      ? 'filter-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white'
      : 'filter-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200';
  });
  renderTransactionTable();
};

window.TangHai.setSortBy = function(sortType) {
  AppState.sortBy = sortType;
  renderTransactionTable();
};

window.TangHai.toggleHideSelf = function(checked) {
  AppState.hideSelfTransfers = checked;
  renderTransactionTable();
};

window.TangHai.exportCSV = function() {
  if (!AppState.transactions.length) return;
  const headers = ['วันที่', 'เวลา', 'รหัส', 'ช่องทาง', 'เงินออก (Debit)', 'เงินเข้า (Credit)', 'คงเหลือ (Balance)', 'รายละเอียด', 'หมวดหมู่', 'บันทึกช่วยจำ'];
  const rows = AppState.transactions.map(tx => {
    const catLabel = (window.TangHai.CATEGORIES[tx.category] || window.TangHai.CATEGORIES.UNKNOWN).label;
    return [
      tx.date,
      tx.time,
      tx.code,
      tx.channel,
      tx.debit || 0,
      tx.credit || 0,
      tx.balance || 0,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${catLabel}"`,
      `"${(tx.userNote || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `categorized_${AppState.fileName.replace(/\.pdf$/i, '') || 'statement'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};


function openPasswordModal(fileName) {
  const modal = document.getElementById('password-modal');
  document.getElementById('locked-file-name').textContent = fileName;
  document.getElementById('pdf-password-input').value = '';
  document.getElementById('password-error-msg').classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('pdf-password-input')?.focus(), 50);
}

window.TangHai.closePasswordModal = function() {
  document.getElementById('password-modal').classList.add('hidden');
};

window.TangHai.submitPdfPassword = async function() {
  const pwd = document.getElementById('pdf-password-input').value.trim();
  const errEl = document.getElementById('password-error-msg');
  if (!pwd) {
    errEl.textContent = 'กรุณากรอกรหัสผ่านของไฟล์ PDF';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const parsed = await window.TangHai.PDFParser.extractTransactionsFromPDF(AppState.pendingPdfBuffer.slice(0), pwd);
    window.TangHai.closePasswordModal();
    if (parsed.transactions.length > 0) {
      AppState.rawTransactions = parsed.transactions;
      AppState.meta = parsed.meta;
      runAnalysisAndRender();
      notify(`ปลดล็อกและอ่านข้อมูลสำเร็จ ${parsed.transactions.length} รายการ (${parsed.meta.totalPages} หน้า)`);
    } else {
      alert('ปลดล็อกไฟล์สำเร็จ แต่ไม่พบรูปแบบตารางรายการที่รองรับ');
    }
  } catch (err) {
    errEl.textContent = 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง';
    errEl.classList.remove('hidden');
  }
};

async function handlePdfFile(file) {
  if (!file) return;
  AppState.fileName = file.name;
  const buffer = await file.arrayBuffer();
  AppState.pendingPdfBuffer = buffer;

  try {
    const parsed = await window.TangHai.PDFParser.extractTransactionsFromPDF(buffer.slice(0));
    if (parsed.transactions.length > 0) {
      AppState.rawTransactions = parsed.transactions;
      AppState.meta = parsed.meta;
      runAnalysisAndRender();
      notify(`อ่านไฟล์ ${file.name} สำเร็จ (${parsed.transactions.length} รายการ)`);
    } else {
      openPasswordModal(file.name);
    }
  } catch (err) {
    openPasswordModal(file.name);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInputs = document.querySelectorAll('.pdf-file-input');
  fileInputs.forEach(input => {
    input.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) handlePdfFile(file);
      e.target.value = '';
    });
  });

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('border-zinc-900', 'bg-zinc-100/70');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-zinc-900', 'bg-zinc-100/70');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('border-zinc-900', 'bg-zinc-100/70');
      const file = e.dataTransfer?.files?.[0];
      if (file) handlePdfFile(file);
    });
  }

  const searchInput = document.getElementById('search-tx-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      AppState.searchQuery = e.target.value;
      renderTransactionTable();
    });
  }

  // แสดงแถบขออนุญาตจัดเก็บข้อมูลในเครื่อง (Consent Banner) หากยังไม่เคยกดยอมรับ
  if (!localStorage.getItem(CONSENT_STORAGE_KEY)) {
    document.getElementById('consent-banner')?.classList.remove('hidden');
  }

  // กู้คืนข้อมูลที่อัปโหลดไว้ล่าสุดอัตโนมัติ (เผลอกด Refresh ข้อมูลไม่หาย!)
  restoreSessionFromStorage();
});

