/**
 * app.js
 * ตัวควบคุมหลักสำหรับ TangHai (Minimal Clean Edition)
 * เริ่มต้นที่หน้าอัปโหลดไฟล์ PDF จริง รองรับการปลดล็อกรหัสผ่าน และการตรวจสอบรายการแบบละเอียด
 */

window.TangHai = window.TangHai || {};

const SESSION_STORAGE_KEY = 'tanghai_saved_session_v1';
const CONSENT_STORAGE_KEY = 'tanghai_consent_accepted_v2';

const AppState = {
  fileName: '',
  meta: { totalPages: 0, openingBalance: null, closingBalance: null, ownerNames: [] },
  uploadedFiles: [], // เก็บรายการไฟล์สเตทเมนต์ที่อัปโหลดเข้ามาทั้งหมด (รองรับหลายธนาคาร)
  rawTransactions: [],
  transactions: [],
  timeBreakdown: [],
  aiSummaryBullets: [],
  selfAccounts: [],
  priorityGroups: [],
  stats: null,
  analysisMode: localStorage.getItem('tanghai_analysis_mode') || 'AI',
  isAiLoading: false,
  isAppendMode: false,
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
      uploadedFiles: AppState.uploadedFiles,
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
      AppState.meta = data.meta || { totalPages: 1, openingBalance: null, closingBalance: null, ownerNames: [] };
      AppState.uploadedFiles = Array.isArray(data.uploadedFiles) ? data.uploadedFiles : [];
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
  // ล้าง AI cache ด้วย เพื่อให้วิเคราะห์ใหม่ทุกครั้งที่อัพไฟล์ใหม่
  window.TangHai.Categorizer?.clearAICache?.();
  AppState.rawTransactions = [];
  AppState.transactions = [];
  AppState.uploadedFiles = [];
  document.getElementById('workspace-view')?.classList.add('hidden');
  document.getElementById('header-actions')?.classList.add('hidden');
  document.getElementById('desktop-nav')?.classList.add('hidden');
  document.getElementById('mobile-bottom-nav')?.classList.add('hidden');
  document.getElementById('empty-upload-view')?.classList.remove('hidden');
  document.getElementById('file-meta-title').textContent = 'TangHai';
  document.getElementById('file-meta-sub').textContent = 'ระบบวิเคราะห์รายการเดินบัญชี';
  notify('ล้างข้อมูลสเตทเมนต์เรียบร้อย พร้อมอัปโหลดไฟล์ใหม่');
};

window.TangHai.loadSampleData = function(bankType = 'SCB') {
  const sample = bankType === 'KTB'
    ? (window.TangHai.DEMO_STATEMENT_KTB || window.TangHai.DEMO_STATEMENT_DATA)
    : window.TangHai.DEMO_STATEMENT_DATA;
  if (!sample) return;
  const fileId = `file-demo-${bankType.toLowerCase()}`;
  AppState.fileName = sample.fileName;
  AppState.meta = { ...sample.meta, ownerNames: [sample.meta.accountName] };
  AppState.uploadedFiles = [{
    fileId,
    fileName: sample.fileName,
    bankName: sample.meta.bankName || bankType,
    accountName: sample.meta.accountName || '',
    txCount: sample.transactions.length
  }];
  AppState.rawTransactions = sample.transactions.map(t => ({ ...t, sourceFileId: fileId }));
  runAnalysisAndRender();
  notify(bankType === 'KTB'
    ? 'โหลดข้อมูลตัวอย่าง Krungthai (Code-Level) สำเร็จ'
    : 'โหลดข้อมูลตัวอย่าง SCB (Full Details) สำเร็จ');
  triggerAutoAIAnalysis();
};

window.TangHai.initTermsModal = function() {
  const agreed = localStorage.getItem(CONSENT_STORAGE_KEY);
  const modal = document.getElementById('terms-modal');
  if (!agreed && modal) {
    modal.classList.remove('hidden');

    const scrollBody = document.getElementById('terms-scroll-body');
    const checkbox = document.getElementById('terms-checkbox');
    const checkboxLabel = document.getElementById('terms-checkbox-label');
    const scrollHint = document.getElementById('terms-scroll-hint');
    const acceptBtn = document.getElementById('terms-accept-btn');

    const checkScroll = () => {
      if (!scrollBody || !checkbox) return;
      const isBottom = scrollBody.scrollHeight - scrollBody.scrollTop <= scrollBody.clientHeight + 35;
      if (isBottom && checkbox.disabled) {
        checkbox.disabled = false;
        if (checkboxLabel) checkboxLabel.className = 'text-xs text-zinc-900 font-semibold leading-relaxed';
        if (scrollHint) {
          scrollHint.textContent = 'ท่านได้อ่านข้อตกลงครบถ้วนแล้ว กรุณาทำเครื่องหมายยินยอมด้านล่างเพื่อเข้าสู่ระบบ';
          scrollHint.className = 'text-xs text-zinc-700 bg-zinc-100 py-2 px-3 rounded-xl text-center font-medium border border-zinc-200';
        }
      }
    };

    scrollBody?.addEventListener('scroll', checkScroll);
    checkbox?.addEventListener('change', () => {
      if (acceptBtn) {
        acceptBtn.disabled = !checkbox.checked;
      }
    });
  }
};

window.TangHai.acceptFormalTerms = function() {
  localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
  document.getElementById('terms-modal')?.classList.add('hidden');
  notify('ยินยอมรับข้อตกลงและนโยบายความเป็นส่วนตัวเรียบร้อย พร้อมใช้งานระบบ TangHai');
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

  const result = window.TangHai.Categorizer.analyzeTransactions(
    AppState.rawTransactions,
    AppState.meta,
    AppState.analysisMode
  );
  AppState.transactions = result.transactions;
  AppState.timeBreakdown = result.timeBreakdown || [];
  AppState.aiSummaryBullets = result.aiSummaryBullets || [];
  AppState.selfAccounts = result.selfAccounts || [];
  AppState.priorityGroups = result.priorityGroups || [];
  AppState.suggestedCategories = result.suggestedCategories || [];
  AppState.stats = result.stats;

  if (shouldSave) {
    saveSessionToStorage();
  }

  document.getElementById('empty-upload-view')?.classList.add('hidden');
  document.getElementById('workspace-view')?.classList.remove('hidden');
  document.getElementById('header-actions')?.classList.remove('hidden');
  document.getElementById('desktop-nav')?.classList.remove('hidden');
  document.getElementById('mobile-bottom-nav')?.classList.remove('hidden');

  updateModeSwitcherUI();

  const pCount = AppState.priorityGroups.length;
  const navBadge = document.getElementById('nav-badge-priority');
  const mobBadge = document.getElementById('mobile-badge-priority');
  const banner = document.getElementById('overview-priority-banner');
  if (navBadge) navBadge.textContent = pCount;
  if (mobBadge) mobBadge.textContent = pCount;
  if (banner) {
    banner.classList.add('hidden');
  }

  renderOverviewMetrics();
  renderAccountMetadataCard();
  renderUploadedFilesBar();
  renderAISummary();
  renderPriorityQueue();
  renderCategoryBreakdown();
  renderTopRecipients();
  renderTimeBreakdown();
  renderMemoryRules();
  renderTransactionTable();
}

function renderAccountMetadataCard() {
  const badgeBank = document.getElementById('badge-bank-name');
  const nameEl = document.getElementById('display-account-name');
  const noEl = document.getElementById('display-account-no');
  const periodEl = document.getElementById('display-period');

  if (badgeBank) badgeBank.textContent = AppState.meta?.bankName || 'BANK';
  if (nameEl) {
    nameEl.textContent = AppState.meta?.accountName || 'ไม่พบชื่อเจ้าของบัญชี (แตะเพื่อระบุ)';
    nameEl.className = AppState.meta?.accountName
      ? 'text-sm font-semibold text-zinc-900'
      : 'text-sm font-semibold text-amber-700 underline cursor-pointer';
    if (!AppState.meta?.accountName) {
      nameEl.onclick = () => window.TangHai.openEditAccountModal();
    } else {
      nameEl.onclick = null;
    }
  }
  if (noEl) noEl.textContent = AppState.meta?.accountNo || 'ไม่ระบุ';
  if (periodEl) periodEl.textContent = AppState.meta?.period || 'ตามรอบรายการ';
}

function renderLifestylePresets() {
  const container = document.getElementById('lifestyle-presets-bar');
  if (!container) return;

  const presets = window.TangHai.CATEGORY_PRESETS || [];
  const existingCatLabels = Object.values(window.TangHai.CATEGORIES).map(c => c.label.toLowerCase());

  let html = '';

  // 1. แสดงหมวดหมู่ที่ Gemini AI แนะนำสำหรับผู้ใช้นี้โดยเฉพาะ (ถ้ามี)
  if (Array.isArray(AppState.suggestedCategories) && AppState.suggestedCategories.length > 0) {
    for (const sug of AppState.suggestedCategories) {
      if (!sug.label) continue;
      const alreadyAdded = existingCatLabels.includes(sug.label.toLowerCase());
      if (!alreadyAdded) {
        html += `
          <button onclick="window.TangHai.applyCustomCategoryFromAI('${encodeURIComponent(sug.label)}')"
            class="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition">
            <span>AI แนะนำ: ${sug.label}</span>
            <span class="text-[10px] bg-white/20 group-hover:bg-white/30 px-1.5 py-0.5 rounded-md">+ เพิ่ม</span>
          </button>
        `;
      }
    }
  }

  // 2. แสดงพรีเซ็ตหมวดหมู่ตามไลฟ์สไตล์ทั่วไป
  for (const p of presets) {
    const isAdded = existingCatLabels.includes(p.label.toLowerCase());
    if (isAdded) {
      html += `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-zinc-200 text-xs text-zinc-500">
          <span>${p.label.split('(')[0].trim()}</span>
          <span class="text-[10px] text-emerald-600 font-semibold">ใช้งานอยู่</span>
        </span>
      `;
    } else {
      html += `
        <button onclick="window.TangHai.applyPresetCategory('${p.id}')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-700 font-medium transition shadow-sm">
          <span>${p.label.split('(')[0].trim()}</span>
          <span class="text-[10px] text-indigo-600 font-semibold">+ เพิ่ม</span>
        </button>
      `;
    }
  }

  container.innerHTML = html;
}

window.TangHai.applyPresetCategory = function(presetId) {
  const presets = window.TangHai.CATEGORY_PRESETS || [];
  const found = presets.find(p => p.id === presetId);
  if (!found) return;

  const newId = window.TangHai.addCustomCategory(found.label, found.color);
  if (newId) {
    runAnalysisAndRender();
    notify(`เพิ่มหมวดหมู่ "${found.label}" เรียบร้อยแล้ว!`);
  }
};

window.TangHai.applyCustomCategoryFromAI = function(encodedLabel) {
  const label = decodeURIComponent(encodedLabel || '');
  if (!label) return;
  const newId = window.TangHai.addCustomCategory(label);
  if (newId) {
    runAnalysisAndRender();
    notify(`เพิ่มหมวดหมู่แนะนำ "${label}" เรียบร้อยแล้ว!`);
  }
};

window.TangHai.openBankGuideModal = function() {
  document.getElementById('bank-guide-modal')?.classList.remove('hidden');
};

window.TangHai.closeBankGuideModal = function() {
  document.getElementById('bank-guide-modal')?.classList.add('hidden');
};

window.TangHai.openEditAccountModal = function() {
  const nameInput = document.getElementById('edit-acc-name-input');
  const aliasesInput = document.getElementById('edit-acc-aliases-input');
  const bankInput = document.getElementById('edit-acc-bank-input');

  if (nameInput) nameInput.value = AppState.meta?.accountName || '';
  if (aliasesInput) {
    const aliases = (AppState.meta?.ownerNames || []).filter(n => n !== AppState.meta?.accountName);
    aliasesInput.value = aliases.join(', ');
  }
  if (bankInput) bankInput.value = AppState.meta?.bankName || '';

  document.getElementById('edit-account-modal')?.classList.remove('hidden');
  setTimeout(() => nameInput?.focus(), 50);
};

window.TangHai.closeEditAccountModal = function() {
  document.getElementById('edit-account-modal')?.classList.add('hidden');
};

window.TangHai.saveAccountMetadata = function() {
  const nameInput = document.getElementById('edit-acc-name-input');
  const aliasesInput = document.getElementById('edit-acc-aliases-input');
  const bankInput = document.getElementById('edit-acc-bank-input');

  const newName = (nameInput?.value || '').trim();
  const rawAliases = (aliasesInput?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const newBank = (bankInput?.value || '').trim();

  AppState.meta.accountName = newName;
  if (newBank) AppState.meta.bankName = newBank;

  const allNames = Array.from(new Set([newName, ...rawAliases].filter(Boolean)));
  AppState.meta.ownerNames = allNames;

  window.TangHai.closeEditAccountModal();
  runAnalysisAndRender();
  notify('บันทึกข้อมูลเจ้าของบัญชีเรียบร้อย ระบบตรวจจับโอนบัญชีตัวเองทันที');
};

function renderUploadedFilesBar() {
  const container = document.getElementById('uploaded-files-bar');
  if (!container) return;

  const files = AppState.uploadedFiles || [];
  if (files.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = files.map(f => `
    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs shadow-sm">
      <span class="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-semibold text-[10px]">${f.bankName || 'BANK'}</span>
      <span class="font-medium text-zinc-800 truncate max-w-[180px]">${f.fileName}</span>
      <span class="text-zinc-400">(${f.txCount} รายการ)</span>
      ${files.length > 1 ? `<button onclick="window.TangHai.removeUploadedFile('${f.fileId}')" class="text-zinc-400 hover:text-rose-600 ml-1" title="เอาไฟล์นี้ออก">✕</button>` : ''}
    </div>
  `).join('');
}

window.TangHai.removeUploadedFile = function(fileId) {
  AppState.uploadedFiles = AppState.uploadedFiles.filter(f => f.fileId !== fileId);
  AppState.rawTransactions = AppState.rawTransactions.filter(t => t.sourceFileId !== fileId);
  if (AppState.rawTransactions.length === 0) {
    window.TangHai.clearSession();
    return;
  }
  AppState.meta.ownerNames = AppState.uploadedFiles.map(f => f.accountName).filter(Boolean);
  runAnalysisAndRender();
  notify('นำไฟล์สเตทเมนต์ออกเรียบร้อยแล้ว');
};

function updateModeSwitcherUI() {
  const isAI = AppState.analysisMode === 'AI';
  const btnBasic = document.getElementById('mode-btn-basic');
  const btnAI = document.getElementById('mode-btn-ai');
  const aiStatusText = document.getElementById('ai-mode-status');

  if (btnBasic && btnAI) {
    btnBasic.className = !isAI
      ? 'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-zinc-900 text-white shadow-sm transition'
      : 'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium text-zinc-600 hover:text-zinc-900 transition';

    if (AppState.isAiLoading) {
      btnAI.className = 'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-indigo-500 text-white shadow-sm transition opacity-80 cursor-wait';
      btnAI.innerHTML = `
        <span class="inline-flex items-center gap-1.5">
          <svg class="animate-spin w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"></path>
          </svg>
          <span class="hidden xl:inline">กำลังวิเคราะห์...</span>
          <span class="xl:hidden">AI...</span>
        </span>`;
    } else {
      btnAI.className = isAI
        ? 'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-indigo-600 text-white shadow-sm transition'
        : 'px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium text-zinc-600 hover:text-zinc-900 transition';
      btnBasic.innerHTML = '<span class="hidden xl:inline">โหมดพื้นฐาน</span><span class="xl:hidden">พื้นฐาน</span>';
      btnAI.innerHTML = '<span class="hidden xl:inline">โหมด Gemini AI</span><span class="xl:hidden">AI</span>';
    }
  }

  if (aiStatusText) {
    aiStatusText.textContent = isAI
      ? 'เปิดใช้ Gemini Flash ช่วยวิเคราะห์และแจกแจงหมวดหมู่อัตโนมัติ'
      : 'โหมดแยกพื้นฐาน (Rule-Based เร็วทันที)';
  }
}

function showAILoadingOverlay(subText = 'จัดหมวดหมู่รายการอัตโนมัติ กรุณารอสักครู่') {
  const overlay = document.getElementById('ai-loading-overlay');
  const sub = document.getElementById('ai-loading-sub');
  const bar = document.getElementById('ai-loading-bar');
  if (!overlay) return;
  if (sub) sub.textContent = subText;
  overlay.classList.remove('hidden');
  // animate progress bar from 20% → 85% ระหว่างรอ
  if (bar) {
    bar.style.transition = 'none';
    bar.style.width = '20%';
    requestAnimationFrame(() => {
      bar.style.transition = 'width 8s cubic-bezier(0.4, 0, 0.2, 1)';
      bar.style.width = '85%';
    });
  }
}

function hideAILoadingOverlay(success = true) {
  const overlay = document.getElementById('ai-loading-overlay');
  const title = document.getElementById('ai-loading-title');
  const sub = document.getElementById('ai-loading-sub');
  const bar = document.getElementById('ai-loading-bar');
  if (!overlay) return;

  if (success && bar) {
    bar.style.transition = 'width 0.3s ease';
    bar.style.width = '100%';
    if (title) title.textContent = 'วิเคราะห์สำเร็จ ✓';
    if (sub) sub.textContent = 'จัดหมวดหมู่ครบทุกรายการแล้ว';
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (title) title.textContent = 'Gemini กำลังวิเคราะห์...';
      if (sub) sub.textContent = 'จัดหมวดหมู่รายการอัตโนมัติ กรุณารอสักครู่';
      if (bar) bar.style.width = '40%';
    }, 900);
  } else {
    overlay.classList.add('hidden');
  }
}

window.TangHai.setAnalysisMode = async function(mode) {
  if (AppState.isAiLoading) return;

  AppState.analysisMode = mode;
  localStorage.setItem('tanghai_analysis_mode', mode);
  updateModeSwitcherUI();

  if (mode === 'AI' && AppState.rawTransactions.length > 0) {
    try {
      AppState.isAiLoading = true;
      updateModeSwitcherUI();
      showAILoadingOverlay(`กำลังส่งรายการให้ Gemini วิเคราะห์ (${AppState.rawTransactions.length} รายการ)`);
      const res = await window.TangHai.Categorizer.runGeminiLLMAnalysis(AppState.rawTransactions);
      AppState.isAiLoading = false;
      runAnalysisAndRender();
      updateModeSwitcherUI();
      hideAILoadingOverlay(true);
      notify(res.cached ? 'โหมด Gemini AI เรียบร้อย (ดึงจากแคชในเครื่อง)' : '✓ Gemini วิเคราะห์สำเร็จ จัดหมวดหมู่ครบทุกรายการ');
    } catch (err) {
      AppState.isAiLoading = false;
      AppState.analysisMode = 'BASIC';
      localStorage.setItem('tanghai_analysis_mode', 'BASIC');
      updateModeSwitcherUI();
      hideAILoadingOverlay(false);
      runAnalysisAndRender();

      if (err.code === 'NEED_API_KEY') {
        document.getElementById('apikey-modal')?.classList.remove('hidden');
        setTimeout(() => document.getElementById('gemini-apikey-input')?.focus(), 50);
        return;
      }
      notify(`หมายเหตุ: ${err.message}`);
    }
  } else {
    runAnalysisAndRender();
    notify('สลับเป็นโหมดแยกพื้นฐานเรียบร้อย');
  }
};

window.TangHai.closeApiKeyModal = function() {
  document.getElementById('apikey-modal')?.classList.add('hidden');
};

window.TangHai.saveApiKeyAndEnableAI = function() {
  const input = document.getElementById('gemini-apikey-input');
  const key = (input?.value || '').trim();
  if (!key) {
    notify('กรุณาวาง Gemini API Key ก่อนกดบันทึก');
    return;
  }
  window.TangHai.Categorizer.setApiKey(key);
  window.TangHai.closeApiKeyModal();
  window.TangHai.setAnalysisMode('AI');
};

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

  const ownerLabel = AppState.meta.accountName || AppState.fileName || 'TangHai';
  document.getElementById('file-meta-title').textContent = ownerLabel;
  document.getElementById('file-meta-sub').textContent =
    [AppState.meta.bankName || '', `${txs.length} รายการ`].filter(Boolean).join('  ·  ');

  const incomeTxs = txs.filter(t => (t.credit || 0) > 0);
  document.getElementById('metric-income').textContent = `+฿${formatNumber(totalIncome)}`;
  document.getElementById('metric-income-sub').textContent = `${incomeTxs.length} รายการเงินเข้า  ·  ยอดเงินออกหน้าสเตทเมนต์ ฿${formatNumber(totalExpense)}`;

  document.getElementById('metric-expense').textContent = `฿${formatNumber(truePersonalSpend)}`;
  if (selfAndPassTotal > 0) {
    document.getElementById('metric-expense-sub').textContent = `หักโอนบัญชีตัวเอง ฿${formatNumber(selfAndPassTotal)} (ยอดเงินออกทั้งหมด ฿${formatNumber(totalExpense)})`;
  } else {
    document.getElementById('metric-expense-sub').textContent = `ไม่รวมโอนบัญชีตัวเอง ฿0.00 (ยอดเงินออกทั้งหมด ฿${formatNumber(totalExpense)})`;
  }

  const netEl = document.getElementById('metric-net');
  netEl.textContent = `฿${formatNumber(lateTotal)}`;
  netEl.className = 'text-2xl font-bold tabular-nums tracking-tight mt-2 text-zinc-900';
  document.getElementById('metric-net-sub').textContent = `${lateTxs.length} รายการ (ช่วง 00:00 – 05:00 น.)`;

  const personCount = txs.filter(t => t.category === 'TRANSFER_PERSON' && t.debit > 0).length;
  const unknownCount = txs.filter(t => t.category === 'UNKNOWN' && t.debit > 0).length;
  const combinedCount = personCount + unknownCount;

  const reviewEl = document.getElementById('metric-review');
  if (reviewEl) reviewEl.textContent = `${combinedCount} รายการ`;
  const reviewSub = document.getElementById('metric-review-sub');
  if (reviewSub) {
    reviewSub.textContent = `โอนบุคคล ${personCount} · อื่นๆ ${unknownCount}`;
  }

  const elCountAll = document.getElementById('count-all');
  if (elCountAll) elCountAll.textContent = txs.length;
  const elCountIncome = document.getElementById('count-income');
  if (elCountIncome) elCountIncome.textContent = txs.filter(t => (t.credit || 0) > 0 || t.category === 'INCOME').length;
  const elCountPerson = document.getElementById('count-person');
  if (elCountPerson) elCountPerson.textContent = personCount;
  const elCountUnknown = document.getElementById('count-unknown');
  if (elCountUnknown) elCountUnknown.textContent = unknownCount;
  const elCountAi = document.getElementById('count-ai');
  if (elCountAi) elCountAi.textContent = txs.filter(t => t.source === 'AI_GUESS').length;
  const elCountMemory = document.getElementById('count-memory');
  if (elCountMemory) elCountMemory.textContent = txs.filter(t => t.source === 'MEMORY').length;
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

  const stackedSegments = sorted.map(([catKey, data]) => {
    const cat = window.TangHai.CATEGORIES[catKey] || window.TangHai.CATEGORIES.UNKNOWN;
    const pct = ((data.amount / totalExpense) * 100);
    if (pct < 0.5) return '';
    return `<div class="h-full transition-all hover:opacity-80 cursor-pointer" style="width: ${pct}%; background-color: ${cat.color}" title="${cat.label}: ${pct.toFixed(1)}% (฿${formatNumber(data.amount)})" onclick="event.stopPropagation(); window.TangHai.openCategoryModal('${catKey}')"></div>`;
  }).join('');

  const stackedBarHtml = sorted.length > 0 ? `
    <div class="space-y-1.5 pb-2">
      <div class="text-[11px] font-medium text-zinc-400">สัดส่วนรายจ่ายภาพรวม:</div>
      <div class="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden flex shadow-inner">
        ${stackedSegments}
      </div>
    </div>
  ` : '';

  container.innerHTML = stackedBarHtml + sorted.map(([catKey, data]) => {
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

// เปิดหน้าต่างเจาะลึกหมวดหมู่ (แสดงรายการทั้งหมดในหมวดนั้น เรียงจากยอดเงินใหญ่สุด -> เล็กสุด แบบโปร่งสบายตา)
window.TangHai.openCategoryModal = function(catKey) {
  const modal = document.getElementById('category-detail-modal');
  if (!modal) return;

  const cat = window.TangHai.CATEGORIES[catKey] || window.TangHai.CATEGORIES.UNKNOWN;
  const txsInCat = AppState.transactions
    .filter(t => (t.category || 'UNKNOWN') === catKey && (t.debit > 0 || t.credit > 0))
    .sort((a, b) => Math.max(b.debit || 0, b.credit || 0) - Math.max(a.debit || 0, a.credit || 0));

  const totalAmount = txsInCat.reduce((sum, t) => sum + (t.debit || t.credit || 0), 0);

  const dotEl = document.getElementById('cat-modal-dot');
  if (dotEl) dotEl.className = `w-3 h-3 rounded-full ${cat.dot}`;
  document.getElementById('cat-modal-title').textContent = cat.label;
  document.getElementById('cat-modal-subtitle').textContent =
    `ทั้งหมด ${txsInCat.length} รายการ  ·  รวม ฿${formatNumber(totalAmount)}`;

  const categoryOptionsHtml = selectedCat =>
    Object.values(window.TangHai.CATEGORIES)
      .map(c => `<option value="${c.id}" ${c.id === selectedCat ? 'selected' : ''}>${c.label}</option>`)
      .join('');

  const txListEl = document.getElementById('cat-modal-transactions');
  txListEl.innerHTML = txsInCat.map((tx, idx) => `
    <div class="p-4 sm:p-5 bg-white hover:bg-zinc-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="min-w-0 space-y-1.5">
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-mono text-zinc-400">#${idx + 1}</span>
          <span class="text-sm font-semibold text-zinc-900">${tx.description}</span>
        </div>
        <div class="flex flex-wrap items-center gap-3 pl-6 text-xs text-zinc-500">
          <span>วันที่ ${tx.date}</span>
          <span>เวลา ${tx.time}</span>
          ${tx.userNote ? `<span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">${tx.userNote}</span>` : ''}
        </div>
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
        <span class="text-base font-bold tabular-nums text-zinc-900">
          ${tx.credit > 0 ? `+฿${formatNumber(tx.credit)}` : `-฿${formatNumber(tx.debit)}`}
        </span>
        <select onchange="window.TangHai.changeCategoryFromModal('${tx.id}', this.value, '${catKey}')"
          class="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:border-zinc-900 cursor-pointer">
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
        class="group flex items-center justify-between py-3.5 px-3 -mx-3 rounded-xl hover:bg-zinc-50 cursor-pointer transition">
        <div class="min-w-0 pr-4 space-y-1">
          <div class="flex items-center gap-2.5">
            <span class="text-zinc-400 font-mono text-xs w-4">${i + 1}.</span>
            <span class="text-sm font-medium text-zinc-900 group-hover:underline truncate">${item.name}</span>
          </div>
          <div class="pl-6 flex items-center gap-3 text-xs text-zinc-500">
            <span>โอน ${item.count} ครั้ง</span>
            <span>${item.alias || cat.label}</span>
          </div>
        </div>
        <div class="tabular-nums text-sm font-semibold text-zinc-900 shrink-0">
          ฿${formatNumber(item.total)}
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

function renderTimeBreakdown() {
  const container = document.getElementById('daily-spikes-list');
  if (!container) return;

  const periods = AppState.timeBreakdown || [];
  const totalSpend = periods.reduce((s, p) => s + p.total, 0) || 1;

  container.innerHTML = periods.map(p => {
    const pct = ((p.total / totalSpend) * 100).toFixed(1);
    return `
      <div class="py-3.5 flex items-center justify-between text-xs">
        <div class="space-y-0.5">
          <div class="font-medium text-zinc-900">${p.label}</div>
          <div class="text-zinc-500">${p.count} รายการ (${pct}%)</div>
        </div>
        <div class="tabular-nums text-sm font-semibold text-zinc-900">
          ฿${formatNumber(p.total)}
        </div>
      </div>
    `;
  }).join('');
}

function renderMemoryRules() {
  const container = document.getElementById('memory-list');
  if (!container) return;

  const rules = window.TangHai.MemoryStore.getAllRules();
  const entries = Object.entries(rules);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center space-y-1.5">
        <div class="text-sm font-medium text-zinc-700">สมุดช่วยจำยังว่างอยู่</div>
        <div class="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">กดปุ่ม <span class="font-medium text-zinc-600">บันทึก</span> ที่แถวรายการในหน้า "รายการทั้งหมด" เพื่อบันทึกหมวดหมู่และชื่อช่วยจำสำหรับรายการนั้น</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="text-xs text-zinc-400 pb-3">${entries.length} รายชื่อที่จำไว้ — จะแยกหมวดหมู่อัตโนมัติทุกครั้งที่พบคำตรงกัน</div>
    <div class="space-y-2">
      ${entries.map(([key, rule]) => {
        const cat = window.TangHai.CATEGORIES[rule.category] || window.TangHai.CATEGORIES.UNKNOWN;
        return `
          <div class="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs">
            <div class="min-w-0 pr-3 space-y-0.5">
              <div class="text-sm font-medium text-zinc-900 truncate">${rule.alias || key}</div>
              <div class="text-xs text-zinc-400 truncate">${key} · <span class="font-medium text-zinc-700">${cat.label}</span></div>
            </div>
            <button onclick="window.TangHai.removeMemoryRule('${key.replace(/'/g, "\\'")}')"
              class="text-zinc-400 hover:text-rose-600 px-2.5 py-1.5 text-xs transition shrink-0 rounded-lg hover:bg-rose-50">
              ลบ
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

window.TangHai.addManualMemoryRule = function() {
  const descEl = document.getElementById('mem-input-desc');
  const catEl = document.getElementById('mem-input-cat');
  const aliasEl = document.getElementById('mem-input-alias');

  const desc = descEl ? descEl.value.trim() : '';
  const cat = catEl ? catEl.value : 'FOOD';
  const alias = aliasEl ? aliasEl.value.trim() : '';

  if (!desc) {
    notify('กรุณากรอกคำที่ปรากฏในสเตทเมนต์');
    return;
  }

  window.TangHai.MemoryStore.saveRule(desc, cat, alias);
  runAnalysisAndRender();
  notify(`บันทึก "${desc}" เข้าสมุดช่วยจำเรียบร้อยแล้ว`);
};

function renderSelfAccountsFlow() {
  const container = document.getElementById('self-accounts-list');
  if (!container) return;

  const list = AppState.selfAccounts || [];
  if (list.length === 0) {
    const hasOwnerName = !!(AppState.meta?.accountName);
    container.innerHTML = `
      <div class="col-span-2 py-6 text-center space-y-2">
        <div class="text-xs text-zinc-500">
          ${hasOwnerName
            ? 'ไม่พบรายการโอนระหว่างบัญชีชื่อเดียวกัน ในรอบนี้'
            : 'ยังไม่ได้ระบุชื่อเจ้าของบัญชี — ระบบจะตรวจจับรายการโอนบัญชีตัวเองได้แม่นขึ้นถ้าระบุชื่อ'}
        </div>
        ${!hasOwnerName ? `
          <button onclick="window.TangHai.openEditAccountModal()"
            class="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium">
            + ระบุชื่อเจ้าของบัญชี
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(acc => {
    const net = acc.inflow - acc.outflow;
    const netDesc = net >= 0
      ? `ดึงเข้าสุทธิ +฿${formatNumber(net)}`
      : `โอนออกสุทธิ -฿${formatNumber(Math.abs(net))}`;

    return `
      <div class="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1.5">
          <div class="text-sm font-semibold text-zinc-900">${acc.accountLabel}</div>
          <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span>โอนเข้า ${acc.inCount} ครั้ง (+฿${formatNumber(acc.inflow)})</span>
            <span>โอนออก ${acc.outCount} ครั้ง (-฿${formatNumber(acc.outflow)})</span>
          </div>
        </div>
        <div class="tabular-nums text-sm font-semibold ${net >= 0 ? 'text-emerald-700' : 'text-zinc-700'}">
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
  if (badge) badge.textContent = `${groups.length} รายการ`;

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="py-14 text-center space-y-2">
        <div class="text-sm font-semibold text-emerald-700">ระบุหมวดหมู่ครบทุกรายการแล้ว</div>
        <p class="text-xs text-zinc-500">ไม่มีรายการค้างตรวจสอบ</p>
      </div>
    `;
    return;
  }

  const categoryOptionsHtml = (selectedCat) => Object.values(window.TangHai.CATEGORIES)
    .filter(c => c.id !== 'INCOME')
    .map(c => `<option value="${c.id}" ${c.id === selectedCat ? 'selected' : ''}>${c.label}</option>`)
    .join('');

  container.innerHTML = groups.map((g, idx) => `
    <div class="p-5 sm:p-6 rounded-2xl bg-zinc-50/80 border border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
      <div class="min-w-0 space-y-2">
        <div class="flex flex-wrap items-center gap-3">
          <span class="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-semibold tabular-nums">-฿${formatNumber(g.amount)}</span>
          <span class="text-sm font-semibold text-zinc-900">${g.description}</span>
          ${g.repeatCount > 1 ? `<span class="text-[11px] px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-800 font-medium">ชื่อซ้ำ ${g.repeatCount} รายการ</span>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          ${g.sourceBank ? `<span class="font-medium text-zinc-700">${g.sourceBank}</span>` : ''}
          <span>วันที่ ${g.date}</span>
          <span>เวลา ${g.time}</span>
          ${g.channel ? `<span>ช่องทาง ${g.channel}</span>` : ''}
        </div>
        ${g.hint ? `
          <div class="pt-1">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-800 font-medium">
              <span class="text-zinc-500 font-medium">คำใบ้:</span>
              <span>${g.hint}</span>
            </span>
          </div>
        ` : ''}
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
        <select id="pq-cat-${idx}" class="bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900">
          ${categoryOptionsHtml(g.category)}
        </select>
        <input id="pq-note-${idx}" type="text" placeholder="ช่วยจำ (ถ้ามี)..."
          class="sm:w-44 bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900" />
        <button onclick="window.TangHai.savePriorityGroup(${idx}, '${g.txId}')"
          class="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition shrink-0">
          บันทึก
        </button>
      </div>
    </div>
  `).join('');
}

window.TangHai.savePriorityGroup = function(groupIdx, txId) {
  const tx = AppState.rawTransactions.find(t => t.id === txId);
  if (!tx) return;

  const catEl = document.getElementById(`pq-cat-${groupIdx}`);
  const noteEl = document.getElementById(`pq-note-${groupIdx}`);
  const newCategory = catEl ? catEl.value : 'FOOD';
  const newAlias = noteEl ? noteEl.value.trim() : '';
  const normKey = window.TangHai.MemoryStore.normalizeKey(tx.description);

  const saved = window.TangHai.MemoryStore.saveRule(tx.description, newCategory, newAlias);
  let updatedCount = 0;
  AppState.rawTransactions = AppState.rawTransactions.map(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
      updatedCount++;
      return { ...item, rowCategoryOverride: null, userNote: newAlias || item.userNote };
    }
    return item;
  });
  runAnalysisAndRender();
  notify(`บันทึกเข้าสมุดจำเรียบร้อย (อัปเดตพร้อมกัน ${updatedCount} รายการ)`);
};

function renderTransactionTable() {
  const tbody = document.getElementById('transaction-tbody');
  if (!tbody) return;

  const filtered = AppState.transactions.filter(tx => {
    if (AppState.hideSelfTransfers && tx.category === 'SELF_TRANSFER') return false;
    if (AppState.activeFilter === 'INCOME' && (tx.category !== 'INCOME' && (tx.credit || 0) <= 0)) return false;
    if (AppState.activeFilter === 'TRANSFER_PERSON' && tx.category !== 'TRANSFER_PERSON') return false;
    if (AppState.activeFilter === 'UNKNOWN' && tx.category !== 'UNKNOWN') return false;
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
        <td colspan="6" class="py-12 text-center text-xs text-zinc-400">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</td>
      </tr>
    `;
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div class="py-12 text-center text-xs text-zinc-400">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</div>`;
    }
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const isLate = tx.debit > 0 && isLateNightTime(tx.time);
    const rowBg = 'hover:bg-zinc-50';

    let sourcePillClass = 'bg-zinc-100 text-zinc-600';
    if (tx.source === 'AI_GUESS') sourcePillClass = 'bg-zinc-100 text-zinc-700 font-medium';
    if (tx.source === 'MEMORY') sourcePillClass = 'bg-zinc-100 text-zinc-700 font-medium';
    if (tx.category === 'TRANSFER_PERSON') sourcePillClass = 'bg-teal-50 text-teal-700 font-medium';
    if (tx.category === 'UNKNOWN') sourcePillClass = 'bg-zinc-100 text-zinc-600 font-medium';

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
          <div class="flex flex-wrap items-center gap-2 mt-1.5">
            ${tx.sourceBank ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">${tx.sourceBank}</span>` : ''}
            <span class="text-[11px] font-mono text-zinc-400">${tx.code} · ${tx.channel}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-md font-medium ${sourcePillClass}">${tx.sourceLabel}</span>
          </div>
        </td>
        <td class="py-4 px-5 whitespace-nowrap text-right tabular-nums">
          <div class="text-sm font-semibold ${tx.credit > 0 ? 'text-emerald-700' : 'text-zinc-900'}">
            ${tx.credit > 0 ? `+${formatNumber(tx.credit)}` : `-${formatNumber(tx.debit)}`}
          </div>
          <div class="text-[11px] text-zinc-400 mt-0.5">คงเหลือ ${formatNumber(tx.balance)}</div>
        </td>
        <td class="py-4 px-5 text-xs">
          <select id="cat-${tx.id}"
            class="w-full bg-white border border-zinc-200 text-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 cursor-pointer">
            ${categoryOptionsHtml(tx.category)}
          </select>
        </td>
        <td class="py-4 px-5 text-xs">
          <input id="note-${tx.id}" type="text" value="${tx.userNote || ''}"
            placeholder="หมายเหตุช่วยจำ..."
            class="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900" />
        </td>
        <td class="py-4 px-5 whitespace-nowrap text-center">
          <button onclick="window.TangHai.saveRowMemory('${tx.id}', false)"
            class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition shadow-sm">
            บันทึก
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (mobileContainer) {
    mobileContainer.innerHTML = filtered.map(tx => {
      return `
        <div class="p-3.5 sm:p-4 space-y-2.5 bg-white">
          <div class="flex items-start justify-between gap-2.5">
            <div class="min-w-0 pr-1">
              <div class="text-xs sm:text-sm font-semibold text-zinc-900 break-words leading-snug">${tx.description}</div>
              <div class="text-[11px] text-zinc-500 mt-1 flex flex-wrap items-center gap-1.5">
                <span class="tabular-nums">${tx.date}</span>
                <span class="tabular-nums">${tx.time}</span>
                <span>·</span>
                <span class="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 text-[10px] font-medium">${tx.sourceLabel}</span>
              </div>
            </div>
            <div class="text-right tabular-nums shrink-0">
              <div class="text-xs sm:text-sm font-bold ${tx.credit > 0 ? 'text-emerald-700' : 'text-zinc-900'}">
                ${tx.credit > 0 ? `+${formatNumber(tx.credit)}` : `-${formatNumber(tx.debit)}`}
              </div>
              <div class="text-[10px] sm:text-[11px] text-zinc-400">คงเหลือ ${formatNumber(tx.balance)}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <select id="cat-m-${tx.id}"
              class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900">
              ${categoryOptionsHtml(tx.category)}
            </select>
            <input id="note-m-${tx.id}" type="text" value="${tx.userNote || ''}"
              placeholder="หมายเหตุช่วยจำ..."
              class="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 placeholder-zinc-400" />
          </div>
          <div class="flex justify-end pt-1">
            <button onclick="window.TangHai.saveRowMemory('${tx.id}', true)"
              class="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition">
              บันทึก
            </button>
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
  const saved = window.TangHai.MemoryStore.saveRule(tx.description, newCategory, newAlias);

  let updatedCount = 0;
  AppState.rawTransactions = AppState.rawTransactions.map(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
      updatedCount++;
      return { ...item, rowCategoryOverride: null, userNote: newAlias || item.userNote };
    }
    return item;
  });
  runAnalysisAndRender();
  notify(`บันทึกเข้าสมุดจำเรียบร้อย (อัปเดต "${saved?.key || normKey}" ${updatedCount} รายการ)`);
};

// บันทึกจากปุ่มชัดเจนในแถวรายการ — อ่านค่าจาก select/input แล้วบันทึกเข้า MemoryStore
// อัปเดตเฉพาะแถวที่เกี่ยวข้องใน DOM แทนการ re-render ทั้งหน้าเพื่อป้องกัน scroll jump
window.TangHai.saveRowMemory = function(txId, isMobile = false) {
  const tx = AppState.rawTransactions.find(t => t.id === txId);
  if (!tx) return;

  const prefix = isMobile ? 'm-' : '';
  const catSelect = document.getElementById(`cat-${prefix}${txId}`);
  const noteInput = document.getElementById(`note-${prefix}${txId}`);
  const newCategory = catSelect ? catSelect.value : tx.category;
  const newAlias = noteInput ? noteInput.value.trim() : '';

  const normKey = window.TangHai.MemoryStore.normalizeKey(tx.description);
  const saved = window.TangHai.MemoryStore.saveRule(tx.description, newCategory, newAlias);

  // อัปเดต state
  let updatedCount = 0;
  AppState.rawTransactions = AppState.rawTransactions.map(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
      updatedCount++;
      return { ...item, rowCategoryOverride: null, userNote: newAlias || item.userNote };
    }
    return item;
  });

  // อัปเดต DOM เฉพาะแถวที่ match — ไม่ re-render ทั้งหน้า scroll ไม่กระโดด
  AppState.transactions.forEach(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) !== normKey) return;
    const id = item.id;

    // ซิงค์ category select ทั้ง desktop และ mobile
    ['cat-' + id, 'cat-m-' + id].forEach(elId => {
      const el = document.getElementById(elId);
      if (el) el.value = newCategory;
    });

    // ซิงค์ note input ทั้ง desktop และ mobile
    if (newAlias) {
      ['note-' + id, 'note-m-' + id].forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.value = newAlias;
      });
    }
  });

  // อัปเดต transactions state สำหรับ render ครั้งต่อไป (ไม่ trigger render ตอนนี้)
  AppState.transactions = AppState.transactions.map(item => {
    if (window.TangHai.MemoryStore.normalizeKey(item.description) === normKey) {
      return { ...item, category: newCategory, userNote: newAlias || item.userNote };
    }
    return item;
  });

  // อัปเดตเฉพาะ badge จัดหมวดหมู่ และ overview metrics (ไม่แตะ DOM รายการ)
  const unknownCount = AppState.transactions.filter(t => t.category === 'UNKNOWN').length;
  const navBadge = document.getElementById('nav-badge-priority');
  const mobBadge = document.getElementById('mobile-badge-priority');
  if (navBadge) navBadge.textContent = unknownCount;
  if (mobBadge) mobBadge.textContent = unknownCount;

  // บันทึก session ในพื้นหลัง
  saveSessionToStorage();

  notify(`บันทึกเข้าสมุดจำเรียบร้อย (อัปเดต "${saved?.key || normKey}" ${updatedCount} รายการ)`);
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


function mergeParsedStatement(parsed, fileName, isAppend = false) {
  const fileId = 'file-' + Date.now();
  const bankLabel = parsed.meta.bankName || 'BANK';
  const taggedTxs = parsed.transactions.map((t, i) => ({
    ...t,
    id: `${fileId}-tx-${i + 1}`,
    sourceFileId: fileId,
    sourceBank: bankLabel
  }));

  if (isAppend && AppState.rawTransactions.length > 0) {
    AppState.uploadedFiles.push({
      fileId,
      fileName,
      bankName: bankLabel,
      accountName: parsed.meta.accountName || '',
      txCount: taggedTxs.length
    });
    AppState.rawTransactions = [...AppState.rawTransactions, ...taggedTxs];
    const ownerSet = new Set([
      ...(AppState.meta.ownerNames || []),
      AppState.meta.accountName,
      parsed.meta.accountName
    ].filter(Boolean));
    AppState.meta.ownerNames = Array.from(ownerSet);
    AppState.meta.totalPages = (AppState.meta.totalPages || 0) + (parsed.meta.totalPages || 1);
    const bankNames = Array.from(new Set(AppState.uploadedFiles.map(f => f.bankName).filter(Boolean)));
    AppState.meta.bankName = bankNames.join(' + ');
  } else {
    AppState.fileName = fileName;
    AppState.meta = {
      ...parsed.meta,
      ownerNames: [parsed.meta.accountName].filter(Boolean)
    };
    AppState.uploadedFiles = [{
      fileId,
      fileName,
      bankName: bankLabel,
      accountName: parsed.meta.accountName || '',
      txCount: taggedTxs.length
    }];
    AppState.rawTransactions = taggedTxs;
  }

  runAnalysisAndRender();
  triggerAutoAIAnalysis();
}

async function triggerAutoAIAnalysis() {
  const canCallAI = window.location.protocol.startsWith('http') || Boolean(window.TangHai.Categorizer?.getApiKey());
  if (!canCallAI || !AppState.rawTransactions.length) return;

  try {
    AppState.analysisMode = 'AI';
    localStorage.setItem('tanghai_analysis_mode', 'AI');
    AppState.isAiLoading = true;
    updateModeSwitcherUI();
    showAILoadingOverlay(`กำลังส่งรายการให้ Gemini วิเคราะห์ (${AppState.rawTransactions.length} รายการ)`);
    const res = await window.TangHai.Categorizer.runGeminiLLMAnalysis(AppState.rawTransactions);
    AppState.isAiLoading = false;
    runAnalysisAndRender();
    updateModeSwitcherUI();
    hideAILoadingOverlay(true);
    notify(res.cached ? '✓ Gemini AI จัดหมวดหมู่เรียบร้อย (จากแคช)' : '✓ Gemini AI วิเคราะห์สำเร็จ จัดหมวดหมู่ครบแล้ว');
  } catch (err) {
    AppState.isAiLoading = false;
    updateModeSwitcherUI();
    hideAILoadingOverlay(false);
    // fallback ใช้ Rule-based อย่างราบรื่น ไม่รบกวนผู้ใช้
  }
}

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
      mergeParsedStatement(parsed, AppState.pendingFileName, AppState.isAppendMode);
      notify(
        AppState.isAppendMode
          ? `รวมสเตทเมนต์เพิ่มสำเร็จ (+${parsed.transactions.length} รายการ)`
          : `ปลดล็อกและอ่านข้อมูลสำเร็จ ${parsed.transactions.length} รายการ`
      );
    } else {
      alert('ปลดล็อกไฟล์สำเร็จ แต่ไม่พบรูปแบบตารางรายการที่รองรับ');
    }
  } catch (err) {
    errEl.textContent = 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง';
    errEl.classList.remove('hidden');
  }
};

async function handlePdfFile(file, isAppend = false) {
  if (!file) return;
  AppState.pendingFileName = file.name;
  AppState.isAppendMode = isAppend;

  // ล้าง AI cache เมื่ออัพไฟล์ใหม่ (ไม่ใช่ append) เพื่อให้วิเคราะห์ใหม่ทุกครั้ง
  if (!isAppend) {
    window.TangHai.Categorizer?.clearAICache?.();
  }

  const loadingOverlay = document.getElementById('pdf-loading-overlay');
  const loadingText = document.getElementById('pdf-loading-text');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
  }
  if (loadingText) loadingText.textContent = `กำลังอ่านไฟล์ ${file.name}...`;

  try {
    const buffer = await file.arrayBuffer();
    AppState.pendingPdfBuffer = buffer;

    if (loadingText) loadingText.textContent = 'กำลังวิเคราะห์ตารางรายการเดินบัญชี...';
    const parsed = await window.TangHai.PDFParser.extractTransactionsFromPDF(buffer.slice(0));

    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('flex');
    }

    if (parsed.transactions.length > 0) {
      mergeParsedStatement(parsed, file.name, isAppend);
      notify(
        isAppend
          ? `รวมไฟล์ ${file.name} เพิ่มสำเร็จ (+${parsed.transactions.length} รายการ)`
          : `อ่านไฟล์ ${file.name} สำเร็จ (${parsed.transactions.length} รายการ)`
      );
    } else {
      notify('ไม่พบตารางรายการในไฟล์นี้ หากไฟล์มีรหัสผ่าน กรุณากรอกด้านล่าง');
      openPasswordModal(file.name);
    }
  } catch (err) {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('flex');
    }
    // PDF.js throws PasswordException for encrypted files
    openPasswordModal(file.name);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // helper: process หลายไฟล์ตามลำดับ (รอทีละไฟล์ ไม่ parallel เพราะ PDF.js มี state)
  async function processMultipleFiles(files, isAppend) {
    const fileList = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
      // ไฟล์แรกใช้ isAppend ตามที่ส่งมา ไฟล์ที่สองเป็นต้นไปให้ append เสมอ
      const appendMode = isAppend || i > 0;
      await handlePdfFile(fileList[i], appendMode);
    }
  }

  document.querySelectorAll('.pdf-file-input').forEach(input => {
    input.setAttribute('multiple', 'true');
    input.addEventListener('change', async e => {
      const files = e.target.files;
      if (files?.length) await processMultipleFiles(files, false);
      e.target.value = '';
    });
  });

  document.querySelectorAll('.pdf-append-input').forEach(input => {
    input.setAttribute('multiple', 'true');
    input.addEventListener('change', async e => {
      const files = e.target.files;
      if (files?.length) await processMultipleFiles(files, true);
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
    dropZone.addEventListener('drop', async e => {
      e.preventDefault();
      dropZone.classList.remove('border-zinc-900', 'bg-zinc-100/70');
      const files = e.dataTransfer?.files;
      if (files?.length) await processMultipleFiles(files, false);
    });
  }

  const searchInput = document.getElementById('search-tx-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      AppState.searchQuery = e.target.value;
      renderTransactionTable();
    });
  }

  // แสดงหน้าต่างข้อตกลงและนโยบายความเป็นส่วนตัว (Terms & Privacy Agreement Modal) หากยังไม่เคยยินยอม
  window.TangHai.initTermsModal();

  // กู้คืนข้อมูลที่อัปโหลดไว้ล่าสุดอัตโนมัติ (เผลอกด Refresh ข้อมูลไม่หาย!)
  restoreSessionFromStorage();
});

