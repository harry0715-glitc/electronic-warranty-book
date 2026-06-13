const SHEET_NAMES = {
  WARRANTIES: 'Warranties',
  LINE_CONTACTS: 'LineContacts'
};

const SCRIPT_PROPERTY_KEYS = {
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE_CHANNEL_ACCESS_TOKEN',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  LINE_WEBHOOK_KEY: 'LINE_WEBHOOK_KEY',
  LINE_LIFF_ID: 'LINE_LIFF_ID',
  LINE_ADMIN_SEND_PIN: 'LINE_ADMIN_SEND_PIN'
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();

  if (action === 'getWarranty') {
    const result = getWarrantyById_(e.parameter.id || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'findWarrantyByAddress') {
    const result = getWarrantyByAddress_(e.parameter.address || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'getLineBindingByPhone') {
    const result = getLineBindingByPhone_(e.parameter.phone || '');
    return output_(result, e.parameter.callback);
  }

  if (action === 'sendWarrantyCard') {
    const result = sendWarrantyCardByPhone_(e.parameter.phone || '', e.parameter.caseId || '', e.parameter.pin || '');
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
      lineConfigured: getLineConfigStatus_()
    }, e.parameter.callback);
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

    if (action === 'createWarranty') {
      const warranty = normalizeWarranty_(extractWarrantyInput_(payload.warranty || payload));
      upsertWarranty_(warranty);
      return output_({ success: true, caseId: warranty.caseId, warranty: warranty });
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

function normalizeWarranty_(input) {
  const caseId = String(input.caseId || '').trim() || nextCaseId_();
  const warrantyStart = normalizeDateText_(input.warrantyStart);
  const warrantyEnd = normalizeDateText_(input.warrantyEnd);
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
    repairUrl: String(input.repairUrl || '').trim(),
    warrantyUrl: String(input.warrantyUrl || '').trim(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeDateText_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  return raw;
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

function warrantyHeaders_() {
  return ['caseId', 'statusText', 'projectName', 'customerName', 'customerPhone', 'address', 'scope', 'completionDate', 'amount', 'acceptanceDate', 'warrantyStart', 'warrantyEnd', 'warrantyStatement', 'issuerCompany', 'issuerResponsiblePerson', 'issuerAddress', 'repairUrl', 'warrantyUrl', 'updatedAt'];
}

function warrantyToRow_(w) {
  return [w.caseId, w.statusText, w.projectName, w.customerName, w.customerPhone, w.address, w.scope, w.completionDate, w.amount, w.acceptanceDate, w.warrantyStart, w.warrantyEnd, w.warrantyStatement, w.issuerCompany, w.issuerResponsiblePerson, w.issuerAddress, w.repairUrl, w.warrantyUrl, w.updatedAt];
}

function rowToWarranty_(headers, row) {
  const obj = {};
  headers.forEach(function(header, index) { obj[header] = row[index]; });
  return {
    caseId: obj.caseId,
    statusText: obj.statusText,
    projectName: obj.projectName,
    customerName: obj.customerName,
    customerPhone: obj.customerPhone,
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
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(normalizedPhone).trim()) {
      return rowToObject_(headers, values[i]);
    }
  }
  return null;
}

function upsertLineContact_(contact) {
  const sheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  const values = sheet.getDataRange().getValues();
  const row = [
    contact.normalizedPhone || '',
    contact.rawPhone || '',
    contact.userId || '',
    contact.displayName || '',
    contact.pictureUrl || '',
    contact.statusMessage || '',
    contact.lastMessageText || '',
    contact.lastBoundAt || '',
    contact.updatedAt || ''
  ];

  for (var i = 1; i < values.length; i++) {
    const samePhone = String(values[i][0]).trim() === String(contact.normalizedPhone || '').trim();
    const sameUser = contact.userId && String(values[i][2]).trim() === String(contact.userId).trim();
    if (samePhone || sameUser) {
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
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
  if (!userId) return;

  if (event.type === 'follow') {
    if (event.replyToken) {
      replyLineMessages_(event.replyToken, [{ type: 'text', text: '您好，請直接回傳您的手機號碼，以完成保固通知綁定。\n例如：0912345678' }]);
    }
    return;
  }

  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const rawText = String(event.message.text || '').trim();
    if (!looksLikePhoneBindingText_(rawText)) {
      if (event.replyToken) {
        replyLineMessages_(event.replyToken, [{ type: 'text', text: '請直接回傳您建立保固書時填寫的手機號碼，例如：0912345678' }]);
      }
      return;
    }

    const normalizedPhone = normalizePhone_(rawText);
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

    if (event.replyToken) {
      const name = profile.displayName ? ('『' + profile.displayName + '』') : '您';
      replyLineMessages_(event.replyToken, [{ type: 'text', text: name + ' 已完成綁定手機 ' + normalizedPhone + '。\n之後管理者可直接透過官方帳號發送保固資訊卡給您。' }]);
    }
  }
}

function sendWarrantyCardByPhone_(phone, caseId, pin) {
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

  const warrantyResult = getWarrantyById_(caseId);
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

function buildWarrantyFlexMessage_(warranty) {
  const companyName = warranty.issuer && warranty.issuer.company ? warranty.issuer.company : '電子保固書';
  const liffUrl = getWarrantyLiffUrl_(warranty);
  const warrantyUrl = warranty.warrantyUrl || liffUrl || '';
  const repairUrl = warranty.repairUrl || warrantyUrl;
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
              uri: liffUrl || warrantyUrl
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
  return normalizeDateText_(warranty.warrantyStart) + ' 至 ' + normalizeDateText_(warranty.warrantyEnd);
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
  const configured = getScriptProperty_(SCRIPT_PROPERTY_KEYS.LINE_ADMIN_SEND_PIN);
  return !!configured && String(submittedPin || '').trim() === configured;
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

function setupWarrantyDatabase() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WARRANTIES, warrantyHeaders_());
  const lineSheet = getOrCreateSheet_(SHEET_NAMES.LINE_CONTACTS, getLineContactHeaders_());
  return {
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    warrantySheetName: sheet.getName(),
    lineContactSheetName: lineSheet.getName(),
    warrantyHeaderCount: warrantyHeaders_().length,
    lineContactHeaderCount: getLineContactHeaders_().length,
    lastRow: sheet.getLastRow()
  };
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
  return sheet;
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

function output_(data, callback) {
  var text = JSON.stringify(data);
  if (callback) return ContentService.createTextOutput(callback + '(' + text + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
