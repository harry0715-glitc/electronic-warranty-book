const SHEET_NAMES = {
  WARRANTIES: 'Warranties',
  LINE_CONTACTS: 'LineContacts',
  REPAIRS: 'Repairs'
};

const DEFAULT_PUBLIC_BASE = 'https://harry0715-glitc.github.io/electronic-warranty-book';
const DEFAULT_REPAIR_URL = 'https://line.me/R/ti/p/@yhh1711p';
const DEFAULT_ADMIN_SEND_PIN = '521527';

const SCRIPT_PROPERTY_KEYS = {
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  LINE_WEBHOOK_KEY: 'LINE_WEBHOOK_KEY',
  LINE_LIFF_ID: 'LINE_LIFF_ID',
  LINE_ADMIN_SEND_PIN: 'LINE_ADMIN_SEND_PIN',
  LAST_LINE_DEBUG: 'LAST_LINE_DEBUG'
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();

  if (action === 'createRepair') {
    try {
      const created = createRepair_(extractRepairInput_(e.parameter || {}));
      return output_({ success: true, repairId: created.repair.repairId, repair: created.repair, notify: created.notify }, e.parameter.callback);
    } catch (error) {
      return output_({ success: false, message: error.message, stack: error.stack }, e.parameter.callback);
    }
  }

  if (action === 'listRepairs') {
    const result = listRepairs_(e.parameter.caseId || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'deleteRepair') {
    const result = deleteRepairRecord_(e.parameter.repairId || '', e.parameter.pin || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'updateRepairStatus') {
    const result = updateRepairStatus_(e.parameter.repairId || '', e.parameter.status || '', e.parameter.pin || '', e.parameter.notifyCustomer || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'getWarranty') {
    const result = getWarrantyById_(e.parameter.id || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'findWarrantyByAddress') {
    const result = getWarrantyByAddress_(e.parameter.address || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'searchWarrantyAddresses') {
    const result = searchWarrantyAddresses_(e.parameter.q || e.parameter.address || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'searchWarrantyRecords') {
    const result = searchWarrantyRecords_(e.parameter.q || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'listWarrantyRecords') {
    const result = listWarrantyRecords_();
    return output_(result, e.parameter.callback);
  }

  if (action === 'deleteWarranty') {
    const result = deleteWarrantyRecord_(e.parameter.caseId || '', e.parameter.pin || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'getLineBindingByPhone') {
    const result = getLineBindingByPhone_(e.parameter.phone || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'sendWarrantyCard') {
    const result = sendWarrantyCardByPhone_(e.parameter.phone || '', e.parameter.caseId || '', e.parameter.pin || '', e.parameter || {});
    return output_(result, e.parameter.callback);
  }

  if (action === 'createWarranty') {
    try {
      const warranty = normalizeWarranty_(extractWarrantyInput_(e.parameter || {}));
      upsertWarranty_(warranty);
      return output_({ success: true, caseId: warranty.caseId, warranty: warranty }, e.parameter.callback);
    } catch (error) {
      return output_({ success: false, message: error.message, stack: error.stack }, e.parameter.callback);
    }
  }

  if (action === 'health') {
    return output_({
      success: true,
      service: 'warranty-apps-script',
      time: new Date().toISOString(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      lineConfigured: getLineConfigStatus_(),
      lastLineDebug: getLastLineDebug_()
    }, e.parameter.callback);
  }

  if (action === 'lineDebug') {
    return output_({ success: true, lastLineDebug: getLastLineDebug_(), binding: getLineBindingByPhone_(e.parameter.phone || '') }, e.parameter.callback);
  }

  return output_({ success: false, message: 'Unknown action' }, e.parameter.callback);
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

    if (action === 'createWarranty') {
      const warranty = normalizeWarranty_(extractWarrantyInput_(payload.warranty || payload));
      upsertWarranty_(warranty);
      return output_({ success: true, caseId: warranty.caseId, warranty: warranty });
    }

    if (action === 'createRepair') {
      const created = createRepair_(extractRepairInput_(payload.repair || payload));
      return output_({ success: true, repairId: created.repair.repairId, repair: created.repair, notify: created.notify });
    }

    return output_({ success: false, message: 'Unknown action' });
  } catch (error) {
    return output_({ success: false, message: error.message, stack: error.stack });
  }
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

function extractWarrantyInput_(input) {
  const issuer = input.issuer || {};
  return {
    caseId: input.caseId,
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
  const repairUrl = String(input.repairUrl || '').trim() || getCanonicalRepairUrl_(caseId);
  const warrantyUrl = String(input.warrantyUrl || '').trim() || (DEFAULT_PUBLIC_BASE + '/index.html?id=' + encodeURIComponent(caseId));
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
    updatedAt: new Date().toISOString()
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

function getCanonicalRepairUrl_(caseId) {
  return DEFAULT_PUBLIC_BASE + '/repair.html?id=' + encodeURIComponent(String(caseId || '').trim());
}

function normalizeRepair_(input) {
  const caseId = String(input.caseId || '').trim();
  if (!caseId) throw new Error('caseId is required');
  const warrantyResult = getWarrantyById_(caseId);
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
      return { success: true, warranty: rowToWarranty_(headers, values[i]) };
    }
    if (!partialMatch && (rowAddress.indexOf(target) >= 0 || target.indexOf(rowAddress) >= 0)) {
      partialMatch = values[i];
    }
  }

  if (partialMatch) {
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

function deleteWarrantyRecord_(caseId, pin) {
  const targetCaseId = String(caseId || '').trim();
  if (!targetCaseId) return { success: false, message: 'caseId is required' };
  if (!verifyAdminSendPin_(pin)) return { success: false, message: '發送碼錯誤' };
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
  return ['caseId', 'statusText', 'projectName', 'customerName', 'customerPhone', 'address', 'scope', 'completionDate', 'amount', 'acceptanceDate', 'warrantyStart', 'warrantyEnd', 'warrantyStatement', 'issuerCompany', 'issuerResponsiblePerson', 'issuerAddress', 'repairUrl', 'warrantyUrl', 'updatedAt'];
}

function repairHeaders_() {
  return ['repairId', 'caseId', 'projectName', 'customerName', 'warrantyCustomerPhone', 'contactName', 'phone', 'issueType', 'description', 'preferredContactTime', 'source', 'photoUploadStatus', 'status', 'createdAt', 'updatedAt'];
}

function warrantyToRow_(w) {
  return [w.caseId, w.statusText, w.projectName, w.customerName, w.customerPhone, w.address, w.scope, w.completionDate, w.amount, w.acceptanceDate, w.warrantyStart, w.warrantyEnd, w.warrantyStatement, w.issuerCompany, w.issuerResponsiblePerson, w.issuerAddress, w.repairUrl, w.warrantyUrl, w.updatedAt];
}

function repairToRow_(r) {
  return [r.repairId, r.caseId, r.projectName, r.customerName, r.warrantyCustomerPhone, r.contactName, r.phone, r.issueType, r.description, r.preferredContactTime, r.source, r.photoUploadStatus, r.status, r.createdAt, r.updatedAt];
}

function rowToWarranty_(headers, row) {
  const obj = {};
  headers.forEach(function(header, index) { obj[header] = row[index]; });
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
    repairUrl: obj.repairUrl,
    warrantyUrl: obj.warrantyUrl
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

function updateRepairStatus_(repairId, status, pin, notifyCustomer) {
  const targetRepairId = String(repairId || '').trim();
  const nextStatus = String(status || '').trim();
  if (!targetRepairId) return { success: false, message: 'repairId is required' };
  if (!verifyAdminSendPin_(pin)) return { success: false, message: '發送碼錯誤' };
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

function deleteRepairRecord_(repairId, pin) {
  const targetRepairId = String(repairId || '').trim();
  if (!targetRepairId) return { success: false, message: 'repairId is required' };
  if (!verifyAdminSendPin_(pin)) return { success: false, message: '發送碼錯誤' };
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
  headers.forEach(function(header, index) {
    obj[header] = row[index];
  });
  return obj;
}

function maskUserId_(userId) {
  const text = String(userId || '');
  if (text.length <= 10) return text;
  return text.slice(0, 6) + '...' + text.slice(-4);
}

function handleLineWebhook_(payload, e) {
  const configuredKey = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_WEBHOOK_KEY);
  const incomingKey = e && e.parameter ? String(e.parameter.key || '') : '';
  if (configuredKey && incomingKey !== configuredKey) {
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
    if (!looksLikePhoneBindingText_(rawText)) {
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

function sendWarrantyCardByPhone_(phone, caseId, pin, fallbackInput) {
  if (!verifyAdminSendPin_(pin)) {
    return { success: false, message: '發送碼錯誤' };
  }

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
  const canonicalWarrantyUrl = warranty && warranty.caseId
    ? (DEFAULT_PUBLIC_BASE + '/index.html?id=' + encodeURIComponent(warranty.caseId))
    : '';
  const warrantyUrl = warranty.warrantyUrl || canonicalWarrantyUrl || liffUrl || '';
  const repairUrl = (!warranty.repairUrl || warranty.repairUrl === DEFAULT_REPAIR_URL || /line\.me\/R\/ti\/p/i.test(String(warranty.repairUrl || '')))
    ? getCanonicalRepairUrl_(warranty.caseId)
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
  if (!liffId || !warranty || !warranty.caseId) return '';
  return 'https://liff.line.me/' + encodeURIComponent(liffId) + '?id=' + encodeURIComponent(warranty.caseId);
}

function getLineConfigStatus_() {
  return {
    hasAccessToken: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_ACCESS_TOKEN),
    hasChannelSecret: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_CHANNEL_SECRET),
    hasWebhookKey: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_WEBHOOK_KEY),
    hasLiffId: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_LIFF_ID),
    hasAdminSendPin: !!getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_ADMIN_SEND_PIN)
  };
}

function verifyAdminSendPin_(submittedPin) {
  return String(submittedPin || '').trim() === DEFAULT_ADMIN_SEND_PIN;
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
  setLineConfigForSetup(payload.token, payload.secret, payload.webhookKey, payload.liffId, payload.adminSendPin);
  return { success: true, status: getLineConfigStatus_() };
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  applySheetFormats_(sheet, name);
  return sheet;
}

function applySheetFormats_(sheet, name) {
  if (!sheet) return;
  if (name === SHEET_NAMES.WARRANTIES) {
    sheet.getRange('E:E').setNumberFormat('@STRING@');
  }
  if (name === SHEET_NAMES.LINE_CONTACTS) {
    sheet.getRange('A:B').setNumberFormat('@STRING@');
  }
  if (name === SHEET_NAMES.REPAIRS) {
    sheet.getRange('A:G').setNumberFormat('@STRING@');
  }
}

function setLineConfigForSetup(token, secret, webhookKey, liffId, adminSendPin) {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    LINE_CHANNEL_ACCESS_TOKEN: String(token || '').trim(),
    LINE_CHANNEL_SECRET: String(secret || '').trim(),
    LINE_WEBHOOK_KEY: String(webhookKey || '').trim(),
    LINE_LIFF_ID: String(liffId || '').trim(),
    LINE_ADMIN_SEND_PIN: String(adminSendPin || '').trim()
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

function output_(data, callback) {
  var text = JSON.stringify(data);
  if (callback) return ContentService.createTextOutput(callback + '(' + text + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
