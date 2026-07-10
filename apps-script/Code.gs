const SHEET_NAMES = {
  WARRANTIES: 'Warranties',
  LINE_CONTACTS: 'LineContacts',
  REPAIRS: 'Repairs',
  ADMIN_USERS: 'AdminUsers'
};

const SHEET_NAME_ALIASES = {
  Warranties: ['Warranties', '保固書', '電子保固書', '保固案件'],
  LineContacts: ['LineContacts', 'LINE綁定', 'LINE聯絡人', 'LINE綁定資料'],
  Repairs: ['Repairs', '報修', '報修紀錄', '報修單'],
  AdminUsers: ['AdminUsers', '管理帳號', '管理者', '管理員']
};

const HEADER_ALIASES = {
  caseId: ['caseId', '案件編號'],
  statusText: ['statusText', '保固狀態'],
  projectName: ['projectName', '案件名稱'],
  customerName: ['customerName', '客戶名稱'],
  customerPhone: ['customerPhone', '客戶電話'],
  address: ['address', '工程地點', '地址'],
  scope: ['scope', '承攬範圍'],
  completionDate: ['completionDate', '竣工日期'],
  amount: ['amount', '結算金額'],
  acceptanceDate: ['acceptanceDate', '驗收日期'],
  warrantyStart: ['warrantyStart', '保固起日'],
  warrantyEnd: ['warrantyEnd', '保固迄日'],
  warrantyStatement: ['warrantyStatement', '保固聲明'],
  issuerCompany: ['issuerCompany', '承攬廠商'],
  issuerResponsiblePerson: ['issuerResponsiblePerson', '負責人'],
  issuerAddress: ['issuerAddress', '公司地址'],
  repairUrl: ['repairUrl', '報修連結'],
  warrantyUrl: ['warrantyUrl', '保固書連結', '完整保固書連結'],
  updatedAt: ['updatedAt', '更新時間'],
  publicToken: ['publicToken', '公開Token', '公開憑證', '保固Token'],
  repairId: ['repairId', '報修單號'],
  warrantyCustomerPhone: ['warrantyCustomerPhone', '保固客戶電話'],
  contactName: ['contactName', '聯絡人'],
  phone: ['phone', '聯絡電話'],
  issueType: ['issueType', '問題類型'],
  description: ['description', '問題描述'],
  preferredContactTime: ['preferredContactTime', '可聯絡時段'],
  source: ['source', '來源'],
  photoUploadStatus: ['photoUploadStatus', '照片上傳狀態'],
  status: ['status', '狀態'],
  createdAt: ['createdAt', '建立時間'],
  normalizedPhone: ['normalizedPhone', '正規化手機', '手機(正規化)'],
  rawPhone: ['rawPhone', '原始手機', '手機原值'],
  userId: ['userId', 'LINE User ID', 'LINE使用者ID'],
  displayName: ['displayName', 'LINE顯示名稱'],
  pictureUrl: ['pictureUrl', '大頭貼'],
  statusMessage: ['statusMessage', '狀態訊息'],
  lastMessageText: ['lastMessageText', '最後訊息'],
  lastBoundAt: ['lastBoundAt', '綁定時間'],
  email: ['email', '電子郵件', 'Email'],
  role: ['role', '角色'],
  active: ['active', '啟用'],
  name: ['name', '名稱'],
  note: ['note', '備註']
};

const DEFAULT_PUBLIC_BASE = 'https://harry0715-glitc.github.io/electronic-warranty-book';
const DEFAULT_REPAIR_URL = 'https://line.me/R/ti/p/@yhh1711p';
const SCRIPT_PROPERTY_KEYS = {
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  LINE_WEBHOOK_KEY: 'LINE_WEBHOOK_KEY',
  LINE_LIFF_ID: 'LINE_LIFF_ID',
  LINE_ADMIN_SEND_PIN: 'LINE_ADMIN_SEND_PIN',
  ADMIN_API_KEY: 'ADMIN_API_KEY',
  ADMIN_ALLOWED_EMAILS: 'ADMIN_ALLOWED_EMAILS',
  ADMIN_MANAGER_EMAILS: 'ADMIN_MANAGER_EMAILS',
  PUBLIC_API_BASE: 'PUBLIC_API_BASE',
  LAST_LINE_DEBUG: 'LAST_LINE_DEBUG'
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || '').trim();
  const page = String(params.page || '').trim().toLowerCase();

  try {
    if (page === 'dashboard') return renderAdminHtml_('dashboard', params);
    if (page === 'admin') return renderAdminHtml_('admin', params);
    if (page === 'query') return renderAdminHtml_('query', params);

    if (action === 'createRepair') {
      const created = createPublicRepair_(params);
      return output_({ success: true, repairId: created.repair.repairId, repair: created.repair, notify: created.notify }, params.callback);
    }

    if (action === 'getWarrantyByToken') {
      return output_(getWarrantyByToken_(params.token || ''), params.callback);
    }

    const adminResult = routeAdminAction_(action, params);
    if (adminResult !== null) return output_(adminResult, params.callback);

    return output_({ success: false, message: 'Unknown action' }, params.callback);
  } catch (error) {
    return output_({ success: false, message: error.message, stack: error.stack }, params.callback);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = payload.action || (e && e.parameter && e.parameter.action) || '';

    if (payload && payload.events && Array.isArray(payload.events)) {
      return handleLineWebhook_(payload, e);
    }

    if (action === 'setupLineConfigOnce') {
      return output_(setupLineConfigOnce_(payload));
    }

    if (action === 'createRepair') {
      const source = payload.repair ? Object.assign({}, payload, payload.repair) : payload;
      const created = createPublicRepair_(source);
      return output_({ success: true, repairId: created.repair.repairId, repair: created.repair, notify: created.notify });
    }

    const adminResult = routeAdminAction_(action, payload);
    if (adminResult !== null) return output_(adminResult);

    return output_({ success: false, message: 'Unknown action' });
  } catch (error) {
    return output_({ success: false, message: error.message, stack: error.stack });
  }
}

// 管理端 action 統一路由。GET（JSONP，供 Apps Script 內建管理頁沿用）與
// POST（GitHub Pages 管理頁，adminKey 放 request body，不進 URL）共用同一份邏輯。
// 回傳 null 表示非管理 action。
function routeAdminAction_(action, input) {
  if (action === 'getAdminSessionInfo') return handleAdminAction_(input, function(identity) { return buildAdminSessionInfo_(identity); });
  if (action === 'listRepairs') return handleAdminAction_(input, function() { return listRepairs_(input.caseId || ''); });
  if (action === 'deleteRepair') return handleManagerAction_(input, function() { return deleteRepairRecord_(input.repairId || ''); });
  if (action === 'updateRepairStatus') return handleManagerAction_(input, function() { return updateRepairStatus_(input.repairId || '', input.status || '', input.notifyCustomer || ''); });
  if (action === 'getWarrantyById') return handleAdminAction_(input, function() { return getWarrantyById_(input.caseId || input.id || ''); });
  if (action === 'findWarrantyByAddress') return handleAdminAction_(input, function() { return getWarrantyByAddress_(input.address || ''); });
  if (action === 'searchWarrantyAddresses') return handleAdminAction_(input, function() { return searchWarrantyAddresses_(input.q || input.address || ''); });
  if (action === 'searchWarrantyRecords') return handleAdminAction_(input, function() { return searchWarrantyRecords_(input.q || ''); });
  if (action === 'listWarrantyRecords') return handleAdminAction_(input, function() { return listWarrantyRecords_(); });
  if (action === 'deleteWarranty') return handleManagerAction_(input, function() { return deleteWarrantyRecord_(input.caseId || ''); });
  if (action === 'getLineBindingByPhone') return handleAdminAction_(input, function() { return getLineBindingByPhone_(input.phone || ''); });
  if (action === 'sendWarrantyCard') return handleAdminAction_(input, function() { return sendWarrantyCardByPhone_(input.phone || '', input.caseId || '', input || {}); });
  if (action === 'createWarranty') {
    return handleAdminAction_(input, function(identity) {
      const warranty = normalizeWarranty_(extractWarrantyInput_(input.warranty || input));
      if (warrantyExists_(warranty.caseId) && !identity.isManager) throw new Error('修改既有案件僅限管理者');
      upsertWarranty_(warranty);
      return { success: true, caseId: warranty.caseId, warranty: warranty };
    });
  }
  if (action === 'health') return handleAdminAction_(input, function() {
    return {
      success: true,
      service: 'warranty-apps-script',
      time: new Date().toISOString(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      lineConfigured: getLineConfigStatus_(),
      lastLineDebug: getLastLineDebug_()
    };
  });
  if (action === 'lineDebug') return handleAdminAction_(input, function() {
    return { success: true, lastLineDebug: getLastLineDebug_(), binding: getLineBindingByPhone_(input.phone || '') };
  });
  return null;
}

// 公開報修入口保護：
// 1. 未帶有效 adminKey 的請求一律要求有效 publicToken（防止用連號 caseId 灌單）
// 2. CacheService 頻率限制：單一 token 10 分鐘最多 5 筆、全站 1 小時最多 30 筆
function createPublicRepair_(input) {
  const isAdmin = verifyAdminApiKey_(input && input.adminKey);
  if (!isAdmin) {
    const token = String(input.token || '').trim();
    if (!token) throw new Error('缺少保固 token，請從保固書連結重新開啟報修頁');
    enforceRepairRateLimit_(token);
  }
  return createRepair_(extractRepairInput_(input));
}

function enforceRepairRateLimit_(token) {
  const cache = CacheService.getScriptCache();
  const tokenKey = 'rlRepair_' + String(token).slice(0, 64);
  const globalKey = 'rlRepairGlobal';
  const tokenCount = Number(cache.get(tokenKey) || 0);
  const globalCount = Number(cache.get(globalKey) || 0);
  if (tokenCount >= 5) throw new Error('此保固案件短時間內報修次數過多，請稍後再試');
  if (globalCount >= 30) throw new Error('系統目前報修流量較大，請稍後再試');
  cache.put(tokenKey, String(tokenCount + 1), 600);
  cache.put(globalKey, String(globalCount + 1), 3600);
}

function parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (jsonError) {
      // fall through to form parameters
    }
  }
  return e && e.parameter ? e.parameter : {};
}


function handleAdminAction_(input, fn) {
  const identity = getRequestAdminIdentity_(input);
  if (!identity.allowed) throw new Error('此 Google 帳號沒有後台權限');
  return fn(identity);
}

function handleManagerAction_(input, fn) {
  const identity = getRequestAdminIdentity_(input);
  if (!identity.allowed) throw new Error('此 Google 帳號沒有後台權限');
  if (!identity.isManager) throw new Error('此功能僅限管理者');
  return fn(identity);
}

function getRequestAdminIdentity_(input) {
  if (verifyAdminApiKey_(input && input.adminKey)) {
    return {
      allowed: true,
      isManager: true,
      role: 'manager',
      email: '',
      authMode: 'adminKey'
    };
  }
  return getCurrentAdminIdentity_();
}

function verifyAdminApiKeyOrThrow_(submittedKey) {
  if (verifyAdminApiKey_(submittedKey)) return true;
  throw new Error('管理 API 驗證失敗');
}

function verifyAdminApiKey_(submittedKey) {
  const provided = String(submittedKey || '').trim();
  const expected = getAdminApiKey_();
  return !!provided && !!expected && provided === expected;
}

function getAdminApiKey_() {
  // 安全性：只接受 Script Properties 中明確設定的 ADMIN_API_KEY。
  // 不再 fallback 到 LINE_ADMIN_SEND_PIN 或任何硬編碼預設值。
  // 若未設定，verifyAdminApiKey_ 會一律回傳 false（金鑰驗證停用，僅剩 Google 帳號驗證路徑）。
  return String(getScriptProperty_(SCRIPT_PROPERTY_KEYS.ADMIN_API_KEY) || '').trim();
}

function generatePublicToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function buildPublicWarrantyUrl_(token) {
  return DEFAULT_PUBLIC_BASE + '/index.html?token=' + encodeURIComponent(String(token || '').trim());
}

function buildPublicRepairUrl_(token) {
  return DEFAULT_PUBLIC_BASE + '/repair.html?token=' + encodeURIComponent(String(token || '').trim());
}

function ensureWarrantyPublicTokenAtRow_(sheet, headers, rowIndex, row) {
  const tokenIndex = normalizeHeaderRow_(headers).indexOf('publicToken');
  if (tokenIndex < 0) return String(rowToObject_(headers, row).publicToken || '').trim();
  const existing = String(row[tokenIndex] || '').trim();
  if (existing) return existing;
  const generated = generatePublicToken_();
  sheet.getRange(rowIndex, tokenIndex + 1).setValue(generated).setNumberFormat('@STRING@');
  row[tokenIndex] = generated;
  return generated;
}

function getWarrantyByToken_(token) {
  const targetToken = String(token || '').trim();
  if (!targetToken) return { success: false, message: 'token is required' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No data found' };
  const headers = values[0];
  const tokenIndex = normalizeHeaderRow_(headers).indexOf('publicToken');
  if (tokenIndex < 0) return { success: false, message: 'public token column not found' };
  for (var i = 1; i < values.length; i++) {
    const rowToken = ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
    if (rowToken === targetToken) {
      return { success: true, warranty: rowToWarranty_(headers, values[i]) };
    }
  }
  return { success: false, message: 'Warranty not found' };
}

function getExistingWarrantyPublicToken_(caseId) {
  const targetCaseId = String(caseId || '').trim();
  if (!targetCaseId) return '';
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return '';
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== targetCaseId) continue;
    return ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
  }
  return '';
}

function warrantyExists_(caseId) {
  const targetCaseId = String(caseId || '').trim();
  if (!targetCaseId) return false;
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetCaseId) return true;
  }
  return false;
}

function extractWarrantyInput_(input) {
  const issuer = input.issuer || {};
  return {
    caseId: input.caseId,
    publicToken: input.publicToken,
    projectName: input.projectName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    address: input.address,
    scope: input.scope,
    completionDate: input.completionDate,
    amount: input.amount,
    acceptanceDate: input.acceptanceDate,
    warrantyStart: input.warrantyStart,
    warrantyEnd: input.warrantyEnd,
    warrantyStatement: input.warrantyStatement,
    repairUrl: input.repairUrl,
    warrantyUrl: input.warrantyUrl,
    issuer: {
      company: issuer.company || input.issuerCompany,
      responsiblePerson: issuer.responsiblePerson || input.issuerResponsiblePerson,
      address: issuer.address || input.issuerAddress
    }
  };
}

function extractRepairInput_(input) {
  return {
    caseId: input.caseId,
    token: input.token,
    contactName: input.contactName,
    phone: input.phone,
    issueType: input.issueType,
    description: input.description,
    preferredContactTime: input.preferredContactTime,
    source: input.source,
    photoUploadStatus: input.photoUploadStatus,
    createdAt: input.createdAt
  };
}

function normalizeWarranty_(input) {
  const caseId = String(input.caseId || '').trim() || nextCaseId_();
  const warrantyStart = normalizeDateText_(input.warrantyStart);
  const warrantyEnd = normalizeDateText_(input.warrantyEnd);
  const publicToken = String(input.publicToken || '').trim() || getExistingWarrantyPublicToken_(caseId) || generatePublicToken_();
  const repairUrl = buildPublicRepairUrl_(publicToken);
  const warrantyUrl = buildPublicWarrantyUrl_(publicToken);
  return {
    caseId: caseId,
    statusText: deriveStatusText_(warrantyStart, warrantyEnd),
    projectName: String(input.projectName || '').trim(),
    customerName: String(input.customerName || '').trim(),
    customerPhone: String(input.customerPhone || '').trim(),
    address: String(input.address || '').trim(),
    scope: String(input.scope || '').trim(),
    completionDate: normalizeDateText_(input.completionDate),
    amount: String(input.amount || '').trim(),
    acceptanceDate: normalizeDateText_(input.acceptanceDate),
    warrantyStart: warrantyStart,
    warrantyEnd: warrantyEnd,
    warrantyStatement: String(input.warrantyStatement || '').trim(),
    issuerCompany: String((input.issuer && input.issuer.company) || '').trim(),
    issuerResponsiblePerson: String((input.issuer && input.issuer.responsiblePerson) || '').trim(),
    issuerAddress: String((input.issuer && input.issuer.address) || '').trim(),
    repairUrl: repairUrl,
    warrantyUrl: warrantyUrl,
    updatedAt: new Date().toISOString(),
    publicToken: publicToken
  };
}

function normalizeDateText_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return raw;
  return Utilities.formatDate(parsed, 'Asia/Taipei', 'yyyy-MM-dd');
}

function getCanonicalRepairUrl_(caseIdOrToken) {
  return buildPublicRepairUrl_(String(caseIdOrToken || '').trim());
}

function normalizeRepair_(input) {
  const directCaseId = String(input.caseId || '').trim();
  const token = String(input.token || '').trim();
  let warrantyResult = null;
  let caseId = directCaseId;
  if (token) {
    warrantyResult = getWarrantyByToken_(token);
    caseId = warrantyResult && warrantyResult.success && warrantyResult.warranty ? String(warrantyResult.warranty.caseId || '').trim() : '';
  } else if (caseId) {
    warrantyResult = getWarrantyById_(caseId);
  }
  if (!caseId) throw new Error('caseId is required');
  if (!warrantyResult) warrantyResult = getWarrantyById_(caseId);
  if (!warrantyResult.success || !warrantyResult.warranty) throw new Error('查無對應保固案件');
  const contactName = String(input.contactName || '').trim();
  const phone = normalizePhone_(input.phone || '');
  const issueType = String(input.issueType || '').trim();
  const description = String(input.description || '').trim();
  const preferredContactTime = String(input.preferredContactTime || '').trim();
  if (!contactName) throw new Error('contactName is required');
  if (!phone) throw new Error('phone is required');
  if (!issueType) throw new Error('issueType is required');
  if (!description) throw new Error('description is required');
  return {
    repairId: nextRepairId_(),
    caseId: caseId,
    projectName: String(warrantyResult.warranty.projectName || '').trim(),
    customerName: String(warrantyResult.warranty.customerName || '').trim(),
    warrantyCustomerPhone: normalizePhone_(warrantyResult.warranty.customerPhone || ''),
    contactName: contactName,
    phone: phone,
    issueType: issueType,
    description: description,
    preferredContactTime: preferredContactTime,
    source: String(input.source || 'repair-form').trim() || 'repair-form',
    photoUploadStatus: String(input.photoUploadStatus || 'reserved_for_future_drive_upload').trim(),
    createdAt: String(input.createdAt || '').trim() || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending'
  };
}

function createRepair_(input) {
  const repair = normalizeRepair_(input);
  appendRepair_(repair);
  const notifyResult = notifyRepairCreated_(repair);
  return {
    repair: repair,
    notify: notifyResult
  };
}

function formatDisplayDate_(value) {
  const normalized = normalizeDateText_(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return normalized || '未設定';
  return match[1] + '/' + match[2] + '/' + match[3];
}

function nextCaseId_() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  const year = new Date().getFullYear();
  const prefix = 'FG-' + year + '-';
  var maxNumber = 0;

  for (var i = 1; i < values.length; i++) {
    var caseId = String(values[i][0] || '').trim();
    if (caseId.indexOf(prefix) === 0) {
      var num = Number(caseId.slice(prefix.length));
      if (!isNaN(num) && num > maxNumber) maxNumber = num;
    }
  }

  return prefix + ('000' + (maxNumber + 1)).slice(-3);
}

function nextRepairId_() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  const values = sheet.getDataRange().getValues();
  const year = new Date().getFullYear();
  const prefix = 'RP-' + year + '-';
  var maxNumber = 0;

  for (var i = 1; i < values.length; i++) {
    var repairId = String(values[i][0] || '').trim();
    if (repairId.indexOf(prefix) === 0) {
      var num = Number(repairId.slice(prefix.length));
      if (!isNaN(num) && num > maxNumber) maxNumber = num;
    }
  }

  return prefix + ('000' + (maxNumber + 1)).slice(-3);
}

function deriveStatusText_(start, end) {
  const startDate = parseIsoDate_(start);
  const endDate = parseIsoDate_(end);
  if (!startDate || !endDate) return '日期未設定';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < startDate) return '尚未生效';
  if (today > endDate) return '已過保';
  return '保固生效中';
}

function parseIsoDate_(text) {
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text).trim());
  if (!match) return null;
  const date = new Date(match[1] + '-' + match[2] + '-' + match[3] + 'T00:00:00');
  if (isNaN(date.getTime())) return null;
  return date;
}

function getWarrantyById_(caseId) {
  if (!caseId) return { success: false, message: 'id is required' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No data found' };
  const headers = values[0];

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(caseId).trim()) {
      ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
      return { success: true, warranty: rowToWarranty_(headers, values[i]) };
    }
  }
  return { success: false, message: 'Warranty not found' };
}

function normalizeAddress_(text) {
  return String(text || '').trim().replace(/\s+/g, '').toLowerCase();
}

function getWarrantyByAddress_(address) {
  if (!address) return { success: false, message: 'address is required' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No data found' };
  const headers = values[0];
  const target = normalizeAddress_(address);
  var partialMatch = null;

  for (var i = 1; i < values.length; i++) {
    var rowAddress = normalizeAddress_(values[i][5]);
    if (!rowAddress) continue;
    if (rowAddress === target) {
      ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
      return { success: true, warranty: rowToWarranty_(headers, values[i]) };
    }
    if (!partialMatch && (rowAddress.indexOf(target) >= 0 || target.indexOf(rowAddress) >= 0)) {
      partialMatch = values[i];
    }
  }

  if (partialMatch) {
    ensureWarrantyPublicTokenAtRow_(sheet, headers, values.indexOf(partialMatch) + 1, partialMatch);
    return { success: true, warranty: rowToWarranty_(headers, partialMatch) };
  }
  return { success: false, message: 'Warranty not found' };
}

function searchWarrantyAddresses_(query) {
  return searchWarrantyRecords_(query);
}

function searchWarrantyRecords_(query) {
  const raw = String(query || '').trim();
  const target = normalizeKeyword_(raw);
  const targetPhone = normalizePhone_(raw);
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: true, items: [] };
  const headers = values[0];
  const seen = {};
  const items = [];

  for (var i = values.length - 1; i >= 1; i--) {
    ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
    var warranty = rowToWarranty_(headers, values[i]);
    var matched = !target && !targetPhone;
    if (!matched) {
      var fields = [
        warranty.caseId,
        warranty.address,
        warranty.customerName,
        warranty.customerPhone,
        warranty.projectName,
        warranty.statusText
      ];
      matched = !!target && fields.some(function(field) {
        return normalizeKeyword_(field).indexOf(target) >= 0;
      });
      if (!matched && targetPhone) {
        matched = normalizePhone_(warranty.customerPhone) === targetPhone || String(warranty.caseId || '').trim() === raw;
      }
    }
    if (!matched) continue;
    var key = String(warranty.caseId || '') + '|' + String(warranty.address || '');
    if (seen[key]) continue;
    seen[key] = true;
    items.push({
      caseId: warranty.caseId || '',
      address: warranty.address || '',
      customerName: warranty.customerName || '',
      customerPhone: warranty.customerPhone || '',
      projectName: warranty.projectName || '',
      statusText: warranty.statusText || ''
    });
    if (items.length >= 8) break;
  }

  return { success: true, items: items };
}

function getWarrantyStatusKey_(warranty) {
  const startDate = parseIsoDate_(warranty && warranty.warrantyStart);
  const endDate = parseIsoDate_(warranty && warranty.warrantyEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate || !endDate) return 'pending';
  if (today < startDate) return 'pending';
  if (today > endDate) return 'expired';
  return 'active';
}

function listWarrantyRecords_() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: true, items: [] };
  const headers = values[0];
  const items = [];
  for (var i = 1; i < values.length; i++) {
    ensureWarrantyPublicTokenAtRow_(sheet, headers, i + 1, values[i]);
    var warranty = rowToWarranty_(headers, values[i]);
    var binding = getLineBindingByPhone_(warranty.customerPhone || '');
    items.push({
      caseId: warranty.caseId || '',
      projectName: warranty.projectName || '',
      customerName: warranty.customerName || '',
      customerPhone: warranty.customerPhone || '',
      address: warranty.address || '',
      warrantyStart: warranty.warrantyStart || '',
      warrantyEnd: warranty.warrantyEnd || '',
      statusText: warranty.statusText || '',
      statusKey: getWarrantyStatusKey_(warranty),
      warrantyUrl: warranty.warrantyUrl || '',
      bindingBound: !!(binding && binding.success && binding.bound),
      bindingDisplayName: binding && binding.bound ? (binding.displayName || '') : '',
      bindingUpdatedAt: binding && binding.bound ? (binding.updatedAt || binding.lastBoundAt || '') : ''
    });
  }
  items.sort(function(a, b) {
    const order = { active: 0, pending: 1, expired: 2 };
    const statusDiff = (order[a.statusKey] || 9) - (order[b.statusKey] || 9);
    if (statusDiff !== 0) return statusDiff;
    const aDate = parseIsoDate_(a.warrantyEnd);
    const bDate = parseIsoDate_(b.warrantyEnd);
    const aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.caseId || '').localeCompare(String(b.caseId || ''));
  });
  return { success: true, items: items };
}

function deleteWarrantyRecord_(caseId) {
  const targetCaseId = String(caseId || '').trim();
  if (!targetCaseId) return { success: false, message: 'caseId is required' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No data found' };
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== targetCaseId) continue;
    const warranty = rowToWarranty_(headers, values[i]);
    sheet.deleteRow(i + 1);
    const deletedBinding = maybeDeleteOrphanLineContact_(warranty.customerPhone || '');
    return {
      success: true,
      deletedCaseId: targetCaseId,
      deletedBinding: deletedBinding,
      deletedWarranty: {
        caseId: warranty.caseId || '',
        projectName: warranty.projectName || '',
        customerName: warranty.customerName || '',
        customerPhone: warranty.customerPhone || ''
      }
    };
  }
  return { success: false, message: 'Warranty not found' };
}

function maybeDeleteOrphanLineContact_(phone) {
  const normalizedPhone = normalizePhone_(phone);
  if (!normalizedPhone) return false;
  if (hasWarrantyWithPhone_(normalizedPhone)) return false;
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return false;
  for (var i = values.length - 1; i >= 1; i--) {
    const stored = normalizePhone_(values[i][0]);
    const raw = normalizePhone_(values[i][1]);
    if (stored === normalizedPhone || raw === normalizedPhone) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function hasWarrantyWithPhone_(phone) {
  const normalizedPhone = normalizePhone_(phone);
  if (!normalizedPhone) return false;
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (normalizePhone_(values[i][4]) === normalizedPhone) return true;
  }
  return false;
}

function normalizeKeyword_(text) {
  return String(text || '').trim().replace(/\s+/g, '').toLowerCase();
}

function upsertWarranty_(warranty) {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const values = sheet.getDataRange().getValues();
  const row = warrantyToRow_(warranty);

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === warranty.caseId) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}

function appendRepair_(repair) {
  const sheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  const row = repairToRow_(repair);
  sheet.appendRow(row);
  sheet.getRange(sheet.getLastRow(), 1, 1, row.length).setNumberFormat('@STRING@');
}

function warrantyHeaders_() {
  return ['caseId', 'statusText', 'projectName', 'customerName', 'customerPhone', 'address', 'scope', 'completionDate', 'amount', 'acceptanceDate', 'warrantyStart', 'warrantyEnd', 'warrantyStatement', 'issuerCompany', 'issuerResponsiblePerson', 'issuerAddress', 'repairUrl', 'warrantyUrl', 'updatedAt', 'publicToken'];
}

function repairHeaders_() {
  return ['repairId', 'caseId', 'projectName', 'customerName', 'warrantyCustomerPhone', 'contactName', 'phone', 'issueType', 'description', 'preferredContactTime', 'source', 'photoUploadStatus', 'status', 'createdAt', 'updatedAt'];
}

function warrantyToRow_(w) {
  return [w.caseId, w.statusText, w.projectName, w.customerName, w.customerPhone, w.address, w.scope, w.completionDate, w.amount, w.acceptanceDate, w.warrantyStart, w.warrantyEnd, w.warrantyStatement, w.issuerCompany, w.issuerResponsiblePerson, w.issuerAddress, w.repairUrl, w.warrantyUrl, w.updatedAt, w.publicToken];
}

function repairToRow_(r) {
  return [r.repairId, r.caseId, r.projectName, r.customerName, r.warrantyCustomerPhone, r.contactName, r.phone, r.issueType, r.description, r.preferredContactTime, r.source, r.photoUploadStatus, r.status, r.createdAt, r.updatedAt];
}

function rowToWarranty_(headers, row) {
  const obj = {};
  normalizeHeaderRow_(headers).forEach(function(header, index) { obj[header] = row[index]; });
  const publicToken = String(obj.publicToken || '').trim();
  return {
    caseId: obj.caseId,
    statusText: obj.statusText,
    projectName: obj.projectName,
    customerName: obj.customerName,
    customerPhone: normalizePhone_(obj.customerPhone) || String(obj.customerPhone || '').trim(),
    address: obj.address,
    scope: obj.scope,
    completionDate: normalizeDateText_(obj.completionDate),
    amount: obj.amount,
    acceptanceDate: normalizeDateText_(obj.acceptanceDate),
    warrantyStart: normalizeDateText_(obj.warrantyStart),
    warrantyEnd: normalizeDateText_(obj.warrantyEnd),
    warrantyStatement: obj.warrantyStatement,
    issuer: {
      company: obj.issuerCompany,
      responsiblePerson: obj.issuerResponsiblePerson,
      address: obj.issuerAddress
    },
    repairUrl: publicToken ? buildPublicRepairUrl_(publicToken) : String(obj.repairUrl || '').trim(),
    warrantyUrl: publicToken ? buildPublicWarrantyUrl_(publicToken) : String(obj.warrantyUrl || '').trim(),
    publicToken: publicToken
  };
}

function rowToRepair_(headers, row) {
  const obj = rowToObject_(headers, row);
  return {
    repairId: String(obj.repairId || '').trim(),
    caseId: String(obj.caseId || '').trim(),
    projectName: String(obj.projectName || '').trim(),
    customerName: String(obj.customerName || '').trim(),
    warrantyCustomerPhone: normalizePhone_(obj.warrantyCustomerPhone || ''),
    contactName: String(obj.contactName || '').trim(),
    phone: normalizePhone_(obj.phone || ''),
    issueType: String(obj.issueType || '').trim(),
    description: String(obj.description || '').trim(),
    preferredContactTime: String(obj.preferredContactTime || '').trim(),
    source: String(obj.source || '').trim(),
    photoUploadStatus: String(obj.photoUploadStatus || '').trim(),
    status: String(obj.status || '').trim(),
    createdAt: String(obj.createdAt || '').trim(),
    updatedAt: String(obj.updatedAt || '').trim()
  };
}

function listRepairs_(caseId) {
  const targetCaseId = String(caseId || '').trim();
  const sheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: true, items: [] };
  const headers = values[0];
  const items = [];
  for (var i = values.length - 1; i >= 1; i--) {
    const repair = rowToRepair_(headers, values[i]);
    if (targetCaseId && repair.caseId !== targetCaseId) continue;
    items.push(repair);
  }
  items.sort(function(a, b) {
    if (a.status !== b.status) {
      if (a.status === 'pending') return -1;
      if (b.status === 'pending') return 1;
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  return { success: true, items: items };
}

function updateRepairStatus_(repairId, status, notifyCustomer) {
  const targetRepairId = String(repairId || '').trim();
  const nextStatus = String(status || '').trim();
  if (!targetRepairId) return { success: false, message: 'repairId is required' };
  if (['pending', 'completed'].indexOf(nextStatus) < 0) return { success: false, message: 'invalid status' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No repair data found' };
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== targetRepairId) continue;
    const repair = rowToRepair_(headers, values[i]);
    repair.status = nextStatus;
    repair.updatedAt = new Date().toISOString();
    const row = repairToRow_(repair);
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
    const notify = shouldNotifyCustomer_(notifyCustomer)
      ? (nextStatus === 'completed' ? notifyRepairCompleted_(repair) : notifyRepairCreated_(repair))
      : { success: false, skipped: true, message: 'notify skipped' };
    return { success: true, repair: repair, notify: notify };
  }
  return { success: false, message: 'Repair not found' };
}

function deleteRepairRecord_(repairId) {
  const targetRepairId = String(repairId || '').trim();
  if (!targetRepairId) return { success: false, message: 'repairId is required' };
  const sheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { success: false, message: 'No repair data found' };
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== targetRepairId) continue;
    const repair = rowToRepair_(headers, values[i]);
    sheet.deleteRow(i + 1);
    return { success: true, deletedRepair: repair };
  }
  return { success: false, message: 'Repair not found' };
}

function normalizePhone_(value) {
  let digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.indexOf('886') === 0) digits = '0' + digits.slice(3);
  if (digits.length === 9 && digits.indexOf('9') === 0) digits = '0' + digits;
  return digits;
}

function looksLikePhoneBindingText_(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (!/^[\d\s+()\-]+$/.test(raw)) return false;
  const phone = normalizePhone_(raw);
  return phone.length >= 8 && phone.length <= 12;
}

function getLineContactHeaders_() {
  return ['normalizedPhone', 'rawPhone', 'userId', 'displayName', 'pictureUrl', 'statusMessage', 'lastMessageText', 'lastBoundAt', 'updatedAt'];
}

function getLineBindingByPhone_(phone) {
  const normalizedPhone = normalizePhone_(phone);
  if (!normalizedPhone) return { success: false, bound: false, message: 'phone is required' };
  const contact = findLineContactByPhone_(normalizedPhone);
  if (!contact) {
    return {
      success: true,
      bound: false,
      phone: normalizedPhone,
      message: 'No LINE binding found for this phone'
    };
  }
  return {
    success: true,
    bound: true,
    phone: contact.normalizedPhone,
    displayName: contact.displayName,
    userIdMasked: maskUserId_(contact.userId),
    updatedAt: contact.updatedAt,
    lastBoundAt: contact.lastBoundAt
  };
}

function findLineContactByPhone_(normalizedPhone) {
  const target = normalizePhone_(normalizedPhone);
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    const stored = normalizePhone_(values[i][0]);
    const raw = normalizePhone_(values[i][1]);
    if (stored === target || raw === target) {
      const contact = rowToObject_(headers, values[i]);
      contact.normalizedPhone = stored || raw || target;
      contact.rawPhone = String(values[i][1] || '').trim();
      return contact;
    }
  }
  return null;
}

function findLineContactByUserId_(userId) {
  const target = String(userId || '').trim();
  if (!target) return null;
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][2] || '').trim() !== target) continue;
    const contact = rowToObject_(headers, values[i]);
    contact.normalizedPhone = normalizePhone_(values[i][0]) || normalizePhone_(values[i][1]) || '';
    contact.rawPhone = String(values[i][1] || '').trim();
    return contact;
  }
  return null;
}

function upsertLineContact_(contact) {
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  applySheetFormats_(sheet, SHEET_NAMES.LINE_CONTACTS);
  const values = sheet.getDataRange().getValues();
  const normalizedPhone = normalizePhone_(contact.normalizedPhone || contact.rawPhone || '');
  const row = [
    normalizedPhone || '',
    contact.rawPhone || normalizedPhone || '',
    contact.userId || '',
    contact.displayName || '',
    contact.pictureUrl || '',
    contact.statusMessage || '',
    contact.lastMessageText || '',
    contact.lastBoundAt || '',
    contact.updatedAt || ''
  ];

  for (var i = 1; i < values.length; i++) {
    const samePhone = normalizePhone_(values[i][0]) === normalizedPhone || normalizePhone_(values[i][1]) === normalizedPhone;
    const sameUser = contact.userId && String(values[i][2]).trim() === String(contact.userId).trim();
    if (samePhone || sameUser) {
      sheet.getRange(i + 1, 1, 1, row.length).setNumberFormat('@STRING@').setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
  sheet.getRange(sheet.getLastRow(), 1, 1, row.length).setNumberFormat('@STRING@');
}

function rowToObject_(headers, row) {
  const obj = {};
  normalizeHeaderRow_(headers).forEach(function(header, index) {
    obj[header] = row[index];
  });
  return obj;
}

function normalizeHeaderKey_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const keys = Object.keys(HEADER_ALIASES);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var aliases = HEADER_ALIASES[key] || [];
    for (var j = 0; j < aliases.length; j++) {
      if (String(aliases[j] || '').trim().toLowerCase() === lower) return key;
    }
  }
  return text;
}

function normalizeHeaderRow_(headers) {
  return (headers || []).map(function(header) {
    return normalizeHeaderKey_(header);
  });
}

function getSheetNameCandidates_(name) {
  const canonical = String(name || '').trim();
  return SHEET_NAME_ALIASES[canonical] || [canonical];
}

function findSheetByNameCandidates_(ss, name) {
  const candidates = getSheetNameCandidates_(name).map(function(item) { return String(item || '').trim(); });
  const sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = String(sheets[i].getName() || '').trim();
    if (candidates.indexOf(sheetName) >= 0) return sheets[i];
  }
  return null;
}

function maskUserId_(userId) {
  const text = String(userId || '');
  if (text.length <= 10) return text;
  return text.slice(0, 6) + '...' + text.slice(-4);
}

function handleLineWebhook_(payload, e) {
  // 安全性：Apps Script 讀不到 request header，無法驗 LINE 的 X-Line-Signature，
  // 因此以 URL 上的 webhook key 作為必要驗證。key 未設定時一律拒絕，不再放行。
  const configuredKey = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_WEBHOOK_KEY);
  const incomingKey = e && e.parameter ? String(e.parameter.key || '') : '';
  if (!configuredKey || incomingKey !== configuredKey) {
    return output_({ success: false, message: 'Invalid webhook key' });
  }

  const events = payload.events || [];
  events.forEach(function(event) {
    try {
      handleLineEvent_(event);
    } catch (error) {
      console.error('handleLineEvent_ failed', error);
    }
  });

  return output_({ success: true, handledEvents: events.length });
}

function handleLineEvent_(event) {
  const userId = event && event.source ? String(event.source.userId || '') : '';
  setLastLineDebug_({ stage: 'received', eventType: event && event.type, messageType: event && event.message && event.message.type, userIdMasked: maskUserId_(userId) });
  if (!userId) {
    setLastLineDebug_({ stage: 'missing_user_id', eventType: event && event.type });
    return;
  }

  if (event.type === 'follow') {
    setLastLineDebug_({ stage: 'follow_received', userIdMasked: maskUserId_(userId) });
    if (event.replyToken) {
      try {
        replyLineMessages_(event.replyToken, [{ type: 'text', text: '您好，請直接回傳您的手機號碼，以完成保固通知綁定。\n例如：0912345678' }]);
      } catch (error) {
        setLastLineDebug_({ stage: 'follow_reply_failed', userIdMasked: maskUserId_(userId), error: String(error && error.message || error) });
      }
    }
    return;
  }

  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const rawText = String(event.message.text || '').trim();
    const existingContact = findLineContactByUserId_(userId);
    if (!looksLikePhoneBindingText_(rawText)) {
      if (existingContact) {
        setLastLineDebug_({ stage: 'message_not_phone_already_bound', rawText: rawText, userIdMasked: maskUserId_(userId), normalizedPhone: existingContact.normalizedPhone || '' });
        return;
      }
      setLastLineDebug_({ stage: 'message_not_phone', rawText: rawText, userIdMasked: maskUserId_(userId) });
      if (event.replyToken) {
        try {
          replyLineMessages_(event.replyToken, [{ type: 'text', text: '請直接回傳您建立保固書時填寫的手機號碼，例如：0912345678' }]);
        } catch (error) {
          setLastLineDebug_({ stage: 'message_not_phone_reply_failed', rawText: rawText, error: String(error && error.message || error) });
        }
      }
      return;
    }

    const normalizedPhone = normalizePhone_(rawText);
    setLastLineDebug_({ stage: 'phone_parsed', normalizedPhone: normalizedPhone, rawText: rawText, userIdMasked: maskUserId_(userId) });
    const profile = getLineProfileSafe_(userId);
    const now = new Date().toISOString();
    upsertLineContact_({
      normalizedPhone: normalizedPhone,
      rawPhone: rawText,
      userId: userId,
      displayName: profile.displayName || '',
      pictureUrl: profile.pictureUrl || '',
      statusMessage: profile.statusMessage || '',
      lastMessageText: rawText,
      lastBoundAt: now,
      updatedAt: now
    });
    setLastLineDebug_({ stage: 'binding_saved', normalizedPhone: normalizedPhone, rawText: rawText, userIdMasked: maskUserId_(userId), displayName: profile.displayName || '' });

    if (event.replyToken) {
      const name = profile.displayName ? ('『' + profile.displayName + '』') : '您';
      try {
        replyLineMessages_(event.replyToken, [{ type: 'text', text: name + ' 已完成綁定手機 ' + normalizedPhone + '。\n之後管理者可直接透過官方帳號發送保固資訊卡給您。' }]);
        setLastLineDebug_({ stage: 'binding_reply_sent', normalizedPhone: normalizedPhone, userIdMasked: maskUserId_(userId) });
      } catch (error) {
        setLastLineDebug_({ stage: 'binding_reply_failed', normalizedPhone: normalizedPhone, userIdMasked: maskUserId_(userId), error: String(error && error.message || error) });
      }
    }
  }
}

function sendWarrantyCardByPhone_(phone, caseId, fallbackInput) {
  const binding = getLineBindingByPhone_(phone);
  if (!binding.success || !binding.bound) {
    return { success: false, message: '此手機尚未完成 LINE 綁定' };
  }

  const contact = findLineContactByPhone_(binding.phone);
  if (!contact || !contact.userId) {
    return { success: false, message: '找不到綁定的 LINE userId' };
  }

  let warrantyResult = getWarrantyById_(caseId);
  if ((!warrantyResult.success || !warrantyResult.warranty) && fallbackInput) {
    const fallbackWarranty = normalizeWarranty_(extractWarrantyInput_(fallbackInput));
    upsertWarranty_(fallbackWarranty);
    warrantyResult = { success: true, warranty: fallbackWarranty, recoveredFromFallback: true };
  }
  if (!warrantyResult.success || !warrantyResult.warranty) {
    return { success: false, message: '查無此案件' };
  }

  const message = buildWarrantyFlexMessage_(warrantyResult.warranty);
  const response = pushLineMessages_(contact.userId, [message]);
  return {
    success: true,
    message: '已送出保固資訊卡',
    phone: binding.phone,
    displayName: binding.displayName || '',
    caseId: caseId,
    lineResponse: response
  };
}

function shouldNotifyCustomer_(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function notifyRepairCreated_(repair) {
  return notifyRepairCustomerByPhone_(repair, buildRepairCreatedText_(repair));
}

function notifyRepairCompleted_(repair) {
  return notifyRepairCustomerByPhone_(repair, buildRepairCompletedText_(repair));
}

function notifyRepairCustomerByPhone_(repair, text) {
  const phone = repair && repair.warrantyCustomerPhone ? repair.warrantyCustomerPhone : '';
  const binding = getLineBindingByPhone_(phone);
  if (!binding.success || !binding.bound) {
    return {
      success: false,
      skipped: true,
      reason: 'unbound',
      message: '客戶尚未完成 LINE 綁定',
      phone: normalizePhone_(phone)
    };
  }
  const contact = findLineContactByPhone_(binding.phone);
  if (!contact || !contact.userId) {
    return {
      success: false,
      skipped: true,
      reason: 'missing_user_id',
      message: '找不到綁定的 LINE userId',
      phone: binding.phone
    };
  }
  const response = pushLineMessages_(contact.userId, [{ type: 'text', text: text }]);
  return {
    success: true,
    phone: binding.phone,
    displayName: binding.displayName || '',
    lineResponse: response
  };
}

function buildRepairCreatedText_(repair) {
  return [
    '您好，已收到您的報修申請。',
    '報修單號：' + (repair.repairId || '未提供'),
    '案件編號：' + (repair.caseId || '未提供'),
    '問題類型：' + (repair.issueType || '未提供'),
    '我們會依您填寫的內容盡快與您聯繫安排處理。'
  ].join('\n');
}

function buildRepairCompletedText_(repair) {
  return [
    '您好，您的報修案件已更新為處理完成。',
    '報修單號：' + (repair.repairId || '未提供'),
    '案件編號：' + (repair.caseId || '未提供'),
    '若仍需協助，歡迎再次透過保固頁提出報修。'
  ].join('\n');
}

function buildWarrantyFlexMessage_(warranty) {
  const companyName = warranty.issuer && warranty.issuer.company ? warranty.issuer.company : '電子保固書';
  const liffUrl = getWarrantyLiffUrl_(warranty);
  const canonicalWarrantyUrl = warranty && warranty.publicToken
    ? buildPublicWarrantyUrl_(warranty.publicToken)
    : '';
  const warrantyUrl = warranty.warrantyUrl || canonicalWarrantyUrl || liffUrl || '';
  const repairUrl = (!warranty.repairUrl || warranty.repairUrl === DEFAULT_REPAIR_URL || /line\.me\/R\/ti\/p/i.test(String(warranty.repairUrl || '')))
    ? buildPublicRepairUrl_(warranty.publicToken || '')
    : warranty.repairUrl;
  const statusColor = getStatusColor_(warranty.statusText);

  return {
    type: 'flex',
    altText: companyName + '｜' + warranty.caseId + ' 電子保固書',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1f2937',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: companyName, color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: '電子保固書', color: '#d1d5db', size: 'sm', margin: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: warranty.customerName || '未提供客戶名稱', weight: 'bold', size: 'xl', wrap: true },
          { type: 'text', text: warranty.projectName || '未提供案件名稱', size: 'sm', color: '#6b7280', wrap: true },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: '案件編號', size: 'sm', color: '#6b7280', flex: 3 },
              { type: 'text', text: warranty.caseId || '未提供', size: 'sm', color: '#111827', flex: 7, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: '保固期間', size: 'sm', color: '#6b7280', flex: 3 },
              { type: 'text', text: buildWarrantyPeriodText_(warranty), size: 'sm', color: '#111827', flex: 7, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: '保固狀態', size: 'sm', color: '#6b7280', flex: 3 },
              { type: 'text', text: warranty.statusText || '未提供', size: 'sm', color: statusColor, weight: 'bold', flex: 7, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: '工程地點', size: 'sm', color: '#6b7280', flex: 3 },
              { type: 'text', text: warranty.address || '未提供', size: 'sm', color: '#111827', flex: 7, wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#111827',
            action: {
              type: 'uri',
              label: '查看完整保固書',
              uri: warrantyUrl || liffUrl
            }
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'uri',
              label: '我要報修',
              uri: repairUrl
            }
          }
        ]
      }
    }
  };
}

function buildWarrantyPeriodText_(warranty) {
  return formatDisplayDate_(warranty.warrantyStart) + ' 至 ' + formatDisplayDate_(warranty.warrantyEnd);
}

function getStatusColor_(statusText) {
  const status = String(statusText || '');
  if (status === '保固生效中') return '#16a34a';
  if (status === '已過保') return '#dc2626';
  return '#ca8a04';
}

function getWarrantyLiffUrl_(warranty) {
  const liffId = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_LIFF_ID);
  if (!liffId || !warranty || !warranty.publicToken) return '';
  return 'https://liff.line.me/' + encodeURIComponent(liffId) + '?token=' + encodeURIComponent(warranty.publicToken);
}

function getLineConfigStatus_() {
  return {
    hasAccessToken: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN),
    hasChannelSecret: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_SECRET),
    hasWebhookKey: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_WEBHOOK_KEY),
    hasLiffId: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_LIFF_ID),
    hasAdminSendPin: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_ADMIN_SEND_PIN),
    hasAdminApiKey: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.ADMIN_API_KEY)
  };
}

function getLineProfileSafe_(userId) {
  try {
    return fetchLineProfile_(userId);
  } catch (error) {
    console.warn('fetchLineProfile_ failed', error);
    return {};
  }
}

function fetchLineProfile_(userId) {
  ensureLineAccessToken_();
  const url = 'https://api.line.me/v2/bot/profile/' + encodeURIComponent(userId);
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: buildLineAuthHeaders_(),
    muteHttpExceptions: true
  });
  return parseLineApiResponse_(response);
}

function replyLineMessages_(replyToken, messages) {
  return callLineMessagingApi_('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: messages
  });
}

function pushLineMessages_(userId, messages) {
  return callLineMessagingApi_('https://api.line.me/v2/bot/message/push', {
    to: userId,
    messages: messages
  });
}

function callLineMessagingApi_(url, payload) {
  ensureLineAccessToken_();
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: buildLineAuthHeaders_(),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return parseLineApiResponse_(response);
}

function parseLineApiResponse_(response) {
  const statusCode = response.getResponseCode();
  const text = response.getContentText() || '';
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = { raw: text };
    }
  }
  if (statusCode >= 200 && statusCode < 300) {
    return { ok: true, statusCode: statusCode, body: parsed };
  }
  throw new Error('LINE API error ' + statusCode + ': ' + text);
}

function buildLineAuthHeaders_() {
  const token = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN);
  return { Authorization: 'Bearer ' + token };
}

function ensureLineAccessToken_() {
  const token = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN);
  if (!token) throw new Error('LINE channel access token is not configured');
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function setLastLineDebug_(payload) {
  const data = Object.assign({ time: new Date().toISOString() }, payload || {});
  PropertiesService.getScriptProperties().setProperty(SCRIPT_PROPERTY_KEYS.LAST_LINE_DEBUG, JSON.stringify(data));
}

function getLastLineDebug_() {
  const raw = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LAST_LINE_DEBUG);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw: raw };
  }
}

function setupWarrantyDatabase() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const lineSheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const repairSheet = getOrCreateSheet_(SHEET_NAMES.REPAIRS, repairHeaders_());
  applySheetFormats_(sheet, SHEET_NAMES.WARRANTIES);
  applySheetFormats_(lineSheet, SHEET_NAMES.LINE_CONTACTS);
  applySheetFormats_(repairSheet, SHEET_NAMES.REPAIRS);
  return {
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    warrantySheetName: sheet.getName(),
    lineContactSheetName: lineSheet.getName(),
    repairSheetName: repairSheet.getName(),
    warrantyHeaderCount: warrantyHeaders_().length,
    lineContactHeaderCount: getLineContactHeaders_().length,
    repairHeaderCount: repairHeaders_().length,
    lastRow: sheet.getLastRow()
  };
}

function setupLineConfigOnce_(payload) {
  const status = getLineConfigStatus_();
  if (status.hasAccessToken || status.hasChannelSecret) {
    return { success: false, message: 'LINE config already initialized', status: status };
  }
  setLineConfigForSetup(payload.token, payload.secret, payload.webhookKey, payload.liffId, payload.adminSendPin, payload.adminApiKey);
  return { success: true, status: getLineConfigStatus_() };
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = findSheetByNameCandidates_(ss, name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  ensureSheetHeaders_(sheet, headers);
  applySheetFormats_(sheet, name);
  return sheet;
}

function ensureSheetHeaders_(sheet, headers) {
  if (!sheet || !headers || !headers.length) return;
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const normalized = normalizeHeaderRow_(current);
  let changed = false;
  headers.forEach(function(header, index) {
    const canonical = normalizeHeaderKey_(header);
    if (normalized[index] === canonical) return;
    const foundIndex = normalized.indexOf(canonical);
    if (foundIndex >= 0) return;
    sheet.getRange(1, index + 1).setValue(header);
    normalized[index] = canonical;
    changed = true;
  });
  if (changed) sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function applySheetFormats_(sheet, name) {
  if (!sheet) return;
  if (name === SHEET_NAMES.WARRANTIES) {
    sheet.getRange('A:A').setNumberFormat('@STRING@');
    sheet.getRange('E:E').setNumberFormat('@STRING@');
    sheet.getRange('T:T').setNumberFormat('@STRING@');
  }
  if (name === SHEET_NAMES.LINE_CONTACTS) {
    sheet.getRange('A:B').setNumberFormat('@STRING@');
  }
  if (name === SHEET_NAMES.REPAIRS) {
    sheet.getRange('A:G').setNumberFormat('@STRING@');
  }
}

function setLineConfigForSetup(token, secret, webhookKey, liffId, adminSendPin, adminApiKey) {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    LINE_CHANNEL_ACCESS_TOKEN: String(token || '').trim(),
    LINE_CHANNEL_SECRET: String(secret || '').trim(),
    LINE_WEBHOOK_KEY: String(webhookKey || '').trim(),
    LINE_LIFF_ID: String(liffId || '').trim(),
    LINE_ADMIN_SEND_PIN: String(adminSendPin || '').trim(),
    ADMIN_API_KEY: String(adminApiKey || adminSendPin || '').trim()
  }, true);
  return getLineConfigStatus_();
}

function authorizeLineMessagingAccess() {
  ensureLineAccessToken_();
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
    method: 'get',
    headers: buildLineAuthHeaders_(),
    muteHttpExceptions: true
  });
  return {
    statusCode: response.getResponseCode(),
    body: response.getContentText()
  };
}

function renderAdminHtml_(page, params) {
  const identity = getRequestAdminIdentity_(params || {});
  const verifiedAdminKey = verifyAdminApiKey_((params && params.adminKey) || '') ? String(params.adminKey || '').trim() : '';
  if (!identity.allowed) {
    const pageValue = String(page || 'dashboard');
    const title = pageValue === 'query' ? '查詢保固書' : (pageValue === 'dashboard' ? '後台首頁' : '電子保固書建立');
    const actionUrl = buildAdminPageUrl_(pageValue);
    return HtmlService
      .createHtmlOutput('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Access denied</title></head><body style="font-family:Arial,sans-serif;padding:24px;line-height:1.8;max-width:720px;margin:0 auto;"><h2>無法存取後台</h2><p>目前這個 Apps Script 部署對部分個人 Google 帳號不一定拿得到登入者 email，所以就算你已經在 Google Sheet 加了帳號，也可能還是被拒絕。</p><p>目前偵測帳號：' + escapeHtml_(identity.email || '未取得') + '</p><p>你可以改用管理金鑰直接進入後台：</p><form method="get" action="' + escapeHtml_(actionUrl) + '" style="margin:16px 0;display:grid;gap:12px;"><input type="hidden" name="page" value="' + escapeHtml_(pageValue) + '"><label>管理金鑰 / PIN<br><input type="password" name="adminKey" style="width:100%;max-width:360px;padding:10px 12px;font-size:16px;"></label><button type="submit" style="width:fit-content;padding:10px 18px;font-size:16px;">用管理金鑰進入 ' + escapeHtml_(title) + '</button></form><p>如果你已經在 Google Sheet 設好帳號名單，之後我可以再幫你升級成正式的 Google Sign-In token 驗證版。</p><p>帳號名單工作表：管理帳號（AdminUsers）；表頭可用英文或中文：email / role / active，或 電子郵件 / 角色 / 啟用。</p></body></html>')
      .setTitle('後台存取限制');
  }

  const templateName = page === 'query' ? 'QueryApp' : (page === 'dashboard' ? 'DashboardApp' : 'AdminApp');
  const template = HtmlService.createTemplateFromFile(templateName);
  template.appConfigJson = JSON.stringify(getAdminAppConfig_(identity, params || {}));
  template.adminPageUrl = buildAdminPageUrl_('admin', verifiedAdminKey);
  template.queryPageUrl = buildAdminPageUrl_('query', verifiedAdminKey);
  template.dashboardPageUrl = buildAdminPageUrl_('dashboard', verifiedAdminKey);
  template.viewerEmail = identity.email || '';
  template.viewerRole = identity.role || 'staff';
  template.viewerIsManager = !!identity.isManager;
  return template
    .evaluate()
    .setTitle(page === 'query' ? '查詢保固書' : (page === 'dashboard' ? '後台首頁' : '電子保固書建立'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function adminUserHeaders_() {
  return ['email', 'role', 'active', 'name', 'note', 'updatedAt'];
}

function getAdminUsersSheet_() {
  return getOrCreateSheet_(SHEET_NAMES.ADMIN_USERS, adminUserHeaders_());
}

function getCurrentAdminIdentity_() {
  const email = getActiveUserEmail_();
  if (!email) return { allowed: false, email: '', role: '', isManager: false, authMode: 'google' };
  const sheet = getAdminUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const ownerEmail = getScriptOwnerEmail_();
  if ((values.length <= 1 || !hasActiveAdminUserRows_(values)) && ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
    ensureBootstrapOwnerAdminUser_(sheet, values, email);
    return { allowed: true, email: email, role: 'manager', isManager: true, authMode: 'google_bootstrap_owner' };
  }
  const roleMap = getAdminRoleMap_(values);
  const record = roleMap[email.toLowerCase()];
  if (!record) return { allowed: false, email: email, role: '', isManager: false, authMode: 'google' };
  return {
    allowed: true,
    email: email,
    role: record.role,
    isManager: record.role === 'manager',
    authMode: 'google'
  };
}

function hasActiveAdminUserRows_(values) {
  for (var i = 1; i < values.length; i++) {
    if (isAdminUserRowActive_(values[i][2])) return true;
  }
  return false;
}

function ensureBootstrapOwnerAdminUser_(sheet, values, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  const roleMap = getAdminRoleMap_(values);
  if (roleMap[normalizedEmail]) return;
  sheet.appendRow([normalizedEmail, 'manager', 'TRUE', 'Owner bootstrap', 'auto created for deployment owner', new Date().toISOString()]);
}

function getAdminRoleMap_(values) {
  const map = {};
  for (var i = 1; i < values.length; i++) {
    const row = values[i];
    const email = String(row[0] || '').trim().toLowerCase();
    const role = normalizeAdminRole_(row[1]);
    const active = isAdminUserRowActive_(row[2]);
    if (!email || !active || !role) continue;
    map[email] = { role: role, name: String(row[3] || '').trim() };
  }
  return map;
}

function normalizeAdminRole_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'manager' || normalized === 'admin' || normalized === 'owner' || normalized === '管理者' || normalized === '主管') return 'manager';
  if (normalized === 'staff' || normalized === 'editor' || normalized === 'user' || normalized === '一般人員' || normalized === '人員' || normalized === '一般') return 'staff';
  return '';
}

function isAdminUserRowActive_(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized == '是' || normalized == '啟用' || normalized == 'active';
}

function getActiveUserEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim();
  } catch (error) {
    return '';
  }
}

function getScriptOwnerEmail_() {
  try {
    return String(Session.getEffectiveUser().getEmail() || '').trim();
  } catch (error) {
    return '';
  }
}

function buildAdminSessionInfo_(identity) {
  return {
    success: true,
    email: identity.email || '',
    role: identity.role || '',
    isManager: !!identity.isManager,
    authMode: identity.authMode || ''
  };
}

function getAdminAppConfig_(identity, params) {
  const verifiedAdminKey = verifyAdminApiKey_((params && params.adminKey) || '') ? String(params.adminKey || '').trim() : '';
  return {
    apiBase: buildAdminApiBase_(),
    publicBase: DEFAULT_PUBLIC_BASE,
    liffId: String(getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_LIFF_ID) || '').trim(),
    companyName: '楓根室內裝修設計有限公司',
    companyPhone: '0900-000-000',
    companyAddress: '高雄市楠梓區清成街 31 號',
    repairOfficialUrl: DEFAULT_REPAIR_URL,
    repairFormBase: 'repair.html',
    warrantyPageBase: 'index.html',
    useGoogleSessionAuth: !(identity && identity.authMode === 'adminKey'),
    adminKey: verifiedAdminKey
  };
}

function getPublicApiBase_() {
  return String(
    getScriptProperty_(SCRIPT_PROPERTY_KEYS.PUBLIC_API_BASE)
    || 'https://script.google.com/macros/s/AKfycbxhiL2RwaD6yOlQJVb8MQwJW6zuz0rvcNQdIiCmtwM7JvlWqWzIvaSiGFF6fWXJbw9NYA/exec'
  ).trim();
}

function buildAdminApiBase_() {
  return String(ScriptApp.getService().getUrl() || '').trim() || getPublicApiBase_();
}

function buildAdminPageUrl_(page, adminKey) {
  const base = String(ScriptApp.getService().getUrl() || '').trim();
  var query = '?page=' + encodeURIComponent(page);
  var verifiedAdminKey = verifyAdminApiKey_(adminKey) ? String(adminKey || '').trim() : '';
  if (verifiedAdminKey) query += '&adminKey=' + encodeURIComponent(verifiedAdminKey);
  if (!base) return query;
  return base + query;
}

function setAdminWebConfigForOps_(allowedEmails, publicApiBase) {
  const props = PropertiesService.getScriptProperties();
  const normalizedApiBase = String(publicApiBase || '').trim();
  const update = {};
  if (normalizedApiBase) update[SCRIPT_PROPERTY_KEYS.PUBLIC_API_BASE] = normalizedApiBase;
  if (Object.keys(update).length) props.setProperties(update, true);
  return {
    success: true,
    publicApiBase: getPublicApiBase_(),
    adminUsersSheet: SHEET_NAMES.ADMIN_USERS
  };
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function output_(data, callback) {
  var text = JSON.stringify(data);
  if (callback) return ContentService.createTextOutput(callback + '(' + text + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
