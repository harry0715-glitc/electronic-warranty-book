const SHEET_NAMES = {
  WARRANTIES: 'Warranties',
  REPAIRS: 'Repairs'
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  if (action === 'getWarranty') {
    const result = getWarrantyById_(e.parameter.id || '');
    return output_(result, e.parameter.callback);
  }
  if (action === 'health') {
    return output_({ success: true, service: 'warranty-apps-script', time: new Date().toISOString() }, e.parameter.callback);
  }
  return output_({ success: false, message: 'Unknown action' }, e.parameter.callback);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action || '';

    if (action === 'createWarranty') {
      const warranty = normalizeWarranty_(payload.warranty || {});
      upsertWarranty_(warranty);
      return output_({ success: true, caseId: warranty.caseId, warranty: warranty });
    }

    if (action === 'createRepair') {
      const repair = normalizeRepair_(payload.repair || {});
      appendRepair_(repair);
      return output_({ success: true, repair: repair });
    }

    return output_({ success: false, message: 'Unknown action' });
  } catch (error) {
    return output_({ success: false, message: error.message, stack: error.stack });
  }
}

function normalizeWarranty_(input) {
  if (!input.caseId) throw new Error('caseId is required');
  return {
    caseId: String(input.caseId || '').trim(),
    statusText: String(input.statusText || '保固生效中').trim(),
    projectName: String(input.projectName || '').trim(),
    customerName: String(input.customerName || '').trim(),
    customerPhone: String(input.customerPhone || '').trim(),
    address: String(input.address || '').trim(),
    scope: String(input.scope || '').trim(),
    completionDate: String(input.completionDate || '').trim(),
    amount: String(input.amount || '').trim(),
    acceptanceDate: String(input.acceptanceDate || '').trim(),
    warrantyStart: String(input.warrantyStart || '').trim(),
    warrantyEnd: String(input.warrantyEnd || '').trim(),
    warrantyStatement: String(input.warrantyStatement || '').trim(),
    issuerCompany: String((input.issuer && input.issuer.company) || '').trim(),
    issuerResponsiblePerson: String((input.issuer && input.issuer.responsiblePerson) || '').trim(),
    issuerAddress: String((input.issuer && input.issuer.address) || '').trim(),
    repairUrl: String(input.repairUrl || '').trim(),
    contactUrl: String(input.contactUrl || '').trim(),
    warrantyUrl: String(input.warrantyUrl || '').trim(),
    notes: String(input.notes || '').trim(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeRepair_(input) {
  if (!input.caseId) throw new Error('caseId is required');
  return {
    caseId: String(input.caseId || '').trim(),
    contactName: String(input.contactName || '').trim(),
    phone: String(input.phone || '').trim(),
    issueType: String(input.issueType || '').trim(),
    description: String(input.description || '').trim(),
    createdAt: String(input.createdAt || new Date().toISOString()).trim()
  };
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
  sheet.appendRow(repairToRow_(repair));
}

function warrantyHeaders_() {
  return ['caseId', 'statusText', 'projectName', 'customerName', 'customerPhone', 'address', 'scope', 'completionDate', 'amount', 'acceptanceDate', 'warrantyStart', 'warrantyEnd', 'warrantyStatement', 'issuerCompany', 'issuerResponsiblePerson', 'issuerAddress', 'repairUrl', 'contactUrl', 'warrantyUrl', 'notes', 'updatedAt'];
}

function repairHeaders_() {
  return ['caseId', 'contactName', 'phone', 'issueType', 'description', 'createdAt'];
}

function warrantyToRow_(w) {
  return [w.caseId, w.statusText, w.projectName, w.customerName, w.customerPhone, w.address, w.scope, w.completionDate, w.amount, w.acceptanceDate, w.warrantyStart, w.warrantyEnd, w.warrantyStatement, w.issuerCompany, w.issuerResponsiblePerson, w.issuerAddress, w.repairUrl, w.contactUrl, w.warrantyUrl, w.notes, w.updatedAt];
}

function repairToRow_(r) {
  return [r.caseId, r.contactName, r.phone, r.issueType, r.description, r.createdAt];
}

function rowToWarranty_(headers, row) {
  const obj = {};
  headers.forEach(function(header, index) {
    obj[header] = row[index];
  });
  return {
    caseId: obj.caseId,
    statusText: obj.statusText,
    projectName: obj.projectName,
    customerName: obj.customerName,
    customerPhone: obj.customerPhone,
    address: obj.address,
    scope: obj.scope,
    completionDate: obj.completionDate,
    amount: obj.amount,
    acceptanceDate: obj.acceptanceDate,
    warrantyStart: obj.warrantyStart,
    warrantyEnd: obj.warrantyEnd,
    warrantyStatement: obj.warrantyStatement,
    issuer: {
      company: obj.issuerCompany,
      responsiblePerson: obj.issuerResponsiblePerson,
      address: obj.issuerAddress
    },
    repairUrl: obj.repairUrl,
    contactUrl: obj.contactUrl,
    warrantyUrl: obj.warrantyUrl,
    notes: obj.notes
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
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function output_(data, callback) {
  var text = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + text + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
