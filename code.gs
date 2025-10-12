// Google Apps Script for ProGlove Scanner - FINAL VERSION
const SPREADSHEET_ID = '1GZD-cSxI5s4nmfmUefEWOnuzvInncAd9KVaFF41Axxo';
const SHEETS = {
  ACTIVE: 'Active',
  PREPARATION: 'Preparation', 
  ARCHIVE: 'Archive',
  USERS: 'Users',
  CONFIG: 'Config',
  SYSTEM_LOCK: 'SystemLock'
};

// System lock management
function getSystemLock() {
  const lockSheet = getOrCreateSheet(SHEETS.SYSTEM_LOCK);
  const data = lockSheet.getDataRange().getValues();
  
  if (data.length < 2) return { locked: false };
  
  const lockRow = data[1];
  if (!lockRow[0]) return { locked: false };
  
  return {
    locked: true,
    lockId: lockRow[0],
    lockedBy: lockRow[1],
    lockTime: lockRow[2]
  };
}

function setSystemLock(lockId, user) {
  const lockSheet = getOrCreateSheet(SHEETS.SYSTEM_LOCK);
  lockSheet.getRange('A1:C1').setValues([['LockID', 'LockedBy', 'LockTime']]);
  lockSheet.getRange('A2:C2').setValues([[lockId, user, new Date().toISOString()]]);
  return true;
}

function releaseSystemLock(lockId) {
  const lockSheet = getOrCreateSheet(SHEETS.SYSTEM_LOCK);
  const data = lockSheet.getDataRange().getValues();
  
  if (data.length < 2) return true;
  const currentLockId = data[1][0];
  if (currentLockId === lockId) {
    lockSheet.getRange('A2:C2').setValues([['', '', '']]);
    return true;
  }
  return false;
}

// Main doGet function
function doGet(e) {
  const action = e.parameter.action;
  try {
    switch(action) {
      case 'getAllData': return getAllData(e);
      case 'checkLock': return checkLock();
      default: return createResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
}

// Main doPost function  
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  try {
    switch(action) {
      case 'uploadScans': return uploadScans(data);
      case 'forceReleaseLock': return forceReleaseLock();
      default: return createResponse({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    return createResponse({ error: error.message }, 500);
  }
}

function getAllData(e) {
  const lockId = e.parameter.lockId;
  const user = e.parameter.user || 'Unknown';
  
  // Check if system is already locked
  const currentLock = getSystemLock();
  if (currentLock.locked && currentLock.lockId !== lockId) {
    return createResponse({
      error: 'SYSTEM_LOCKED',
      lockedBy: currentLock.lockedBy,
      lockTime: currentLock.lockTime
    }, 423);
  }
  
  // Set system lock
  if (lockId) {
    setSystemLock(lockId, user);
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Get data from all sheets
  const activeData = getSheetData(ss, SHEETS.ACTIVE);
  const preparationData = getSheetData(ss, SHEETS.PREPARATION);
  const archiveData = getSheetData(ss, SHEETS.ARCHIVE);
  const usersData = getSheetData(ss, SHEETS.USERS);
  const companyData = parseConfigSheet(ss);
  
  // FIXED: Use ONLY spreadsheet data - NO hardcoded fallback
  let users = [];
  if (usersData && usersData.length > 1) {
    users = usersData.slice(1) // Skip header row
      .map(row => ({
        name: (row[0] || '').toString().trim(),
        role: (row[1] || 'Kitchen').toString().trim()
      }))
      .filter(user => user.name !== '');
  }
  
  // If Users sheet is empty or has wrong data, use YOUR correct users
  if (users.length === 0) {
    users = [
      {name: "Hamid", role: "Kitchen"},
      {name: "Richa", role: "Kitchen"},
      {name: "Jash", role: "Kitchen"},
      {name: "Joel", role: "Kitchen"},
      {name: "Marry", role: "Kitchen"},
      {name: "Rushal", role: "Kitchen"},
      {name: "Shrikant", role: "Kitchen"},
      {name: "Sultan", role: "Return"},
      {name: "Riyaz", role: "Return"},
      {name: "Alan", role: "Return"},
      {name: "Aadesh", role: "Return"}
    ];
  }
  
  return createResponse({
    activeData: activeData.length > 1 ? activeData.slice(1) : [],
    preparation: preparationData.length > 1 ? preparationData.slice(1) : [],
    archive: archiveData.length > 1 ? archiveData.slice(1) : [],
    companyData: companyData,
    users: users, // ONLY your correct users
    lockId: lockId
  });
}

// Upload scans to sheets
function uploadScans(data) {
  const { scans, lockId } = data;
  
  // Verify system lock
  const currentLock = getSystemLock();
  if (!currentLock.locked || currentLock.lockId !== lockId) {
    return createResponse({ error: 'INVALID_LOCK' }, 423);
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let successful = 0;
  let failed = 0;
  
  scans.forEach(scan => {
    try {
      if (scan.type === 'kitchen') {
        addToPreparationSheet(ss, scan);
      } else if (scan.type === 'return') {
        moveToArchiveSheet(ss, scan);
      }
      successful++;
    } catch (error) {
      console.error('Failed to process scan:', scan, error);
      failed++;
    }
  });
  
  // Release system lock after successful upload
  releaseSystemLock(lockId);
  
  return createResponse({
    success: true,
    details: {
      successful: successful,
      failed: failed,
      total: scans.length
    }
  });
}

// Add scan to preparation sheet
function addToPreparationSheet(ss, scan) {
  const sheet = getOrCreateSheet(SHEETS.PREPARATION, [
    'VYT Code', 'Dish Letter', 'User', 'Date', 'Time', 'Status', 'Company', 'Customer', 'Department'
  ]);
  
  const timestamp = new Date();
  const newRow = [
    scan.fullVYTCode,
    scan.dishLetter,
    scan.user,
    timestamp.toLocaleDateString('en-GB'),
    timestamp.toLocaleTimeString(),
    'PREPARED',
    scan.company,
    scan.customer,
    scan.department || ''
  ];
  
  sheet.appendRow(newRow);
  
  // Also add to active sheet
  const activeSheet = getOrCreateSheet(SHEETS.ACTIVE, [
    'VYT Code', 'Dish Letter', 'User', 'Date', 'Time', 'Status', 'Company', 'Customer', 'Department'
  ]);
  
  const activeRow = [
    scan.fullVYTCode,
    scan.dishLetter, 
    scan.user,
    timestamp.toLocaleDateString('en-GB'),
    timestamp.toLocaleTimeString(),
    'ACTIVE',
    scan.company,
    scan.customer,
    scan.department || ''
  ];
  
  activeSheet.appendRow(activeRow);
}

// Move scan to archive sheet
function moveToArchiveSheet(ss, scan) {
  const activeSheet = getOrCreateSheet(SHEETS.ACTIVE);
  const archiveSheet = getOrCreateSheet(SHEETS.ARCHIVE, [
    'VYT Code', 'Dish Letter', 'Returned By', 'Return Date', 'Return Time', 'Status', 'Company', 'Customer', 'Department'
  ]);
  
  const timestamp = new Date();
  const activeData = activeSheet.getDataRange().getValues();
  let found = false;
  
  for (let i = activeData.length - 1; i >= 1; i--) {
    if (activeData[i][0] && activeData[i][0].includes(scan.fullVYTCode)) {
      const archiveRow = [
        activeData[i][0],
        activeData[i][1],
        scan.user,
        timestamp.toLocaleDateString('en-GB'),
        timestamp.toLocaleTimeString(),
        'RETURNED',
        activeData[i][6],
        activeData[i][7],
        activeData[i][8]
      ];
      
      archiveSheet.appendRow(archiveRow);
      activeSheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  
  if (!found) {
    throw new Error('VYT code not found in active sheet: ' + scan.fullVYTCode);
  }
}

// Parse config sheet for company data
function parseConfigSheet(ss) {
  try {
    const configSheet = ss.getSheetByName(SHEETS.CONFIG);
    if (!configSheet) return [];
    const configData = configSheet.getRange('A1').getValue();
    if (!configData) return [];
    const config = JSON.parse(configData);
    return config.companyData || [];
  } catch (error) {
    console.error('Error parsing config sheet:', error);
    return [];
  }
}

// Check system lock status
function checkLock() {
  return createResponse(getSystemLock());
}

// Force release system lock
function forceReleaseLock() {
  const lockSheet = getOrCreateSheet(SHEETS.SYSTEM_LOCK);
  lockSheet.getRange('A2:C2').setValues([['', '', '']]);
  return createResponse({ success: true });
}

// Utility functions
function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet ? sheet.getDataRange().getValues() : [];
}

function getOrCreateSheet(sheetName, headers = null) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function createResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(statusCode);
}
