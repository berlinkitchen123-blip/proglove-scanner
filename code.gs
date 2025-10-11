function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = '1GZD-cSxI5s4nmfmUefEWOnuzvInncAd9KVaFF41Axxo'; // YOUR SPREADSHEET ID
    const sheet = SpreadsheetApp.openById(spreadsheetId);
    
    // Set CORS headers
    const response = ContentService.createTextOutput();
    response.setHeader('Access-Control-Allow-Origin', '*')
            .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            .setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    switch(action) {
      case 'getAllData':
        const data = getAllData(sheet);
        response.setContent(JSON.stringify(data));
        break;
      case 'uploadScans':
        const uploadData = JSON.parse(e.postData.contents);
        const uploadResult = uploadScans(sheet, uploadData.scans);
        response.setContent(JSON.stringify(uploadResult));
        break;
      default:
        response.setContent(JSON.stringify({error: 'Invalid action'}));
        response.setStatusCode(400);
    }
    
    response.setMimeType(ContentService.MimeType.JSON);
    return response;
    
  } catch (error) {
    const response = ContentService.createTextOutput(JSON.stringify({error: error.message}));
    response.setMimeType(ContentService.MimeType.JSON);
    response.setStatusCode(500);
    response.setHeader('Access-Control-Allow-Origin', '*');
    return response;
  }
}

function getAllData(sheet) {
  const data = {};
  
  try {
    // Get Active Data (Sheet1 - your main sheet)
    const activeSheet = sheet.getSheetByName('Sheet1');
    if (activeSheet && activeSheet.getLastRow() > 1) {
      data.activeData = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, 9).getValues();
    } else {
      data.activeData = [];
    }
    
    // Get Preparation Data (Sheet2)
    const prepSheet = sheet.getSheetByName('Sheet2');
    if (prepSheet && prepSheet.getLastRow() > 1) {
      data.preparation = prepSheet.getRange(2, 1, prepSheet.getLastRow()-1, 9).getValues();
    } else {
      data.preparation = [];
    }
    
    // Get Archive Data (Sheet3)
    const archiveSheet = sheet.getSheetByName('Sheet3');
    if (archiveSheet && archiveSheet.getLastRow() > 1) {
      data.archive = archiveSheet.getRange(2, 1, archiveSheet.getLastRow()-1, 9).getValues();
    } else {
      data.archive = [];
    }
    
    // Get Company Data (Sheet4)
    const companySheet = sheet.getSheetByName('Sheet4');
    if (companySheet && companySheet.getLastRow() > 1) {
      data.companyData = companySheet.getRange(2, 1, companySheet.getLastRow()-1, 4).getValues();
    } else {
      data.companyData = [];
    }
    
    // Default users (you can create a Users sheet later)
    data.users = [
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
    
  } catch (error) {
    console.error('Error getting data:', error);
    // Return empty data structure on error
    data.activeData = [];
    data.preparation = [];
    data.archive = [];
    data.companyData = [];
    data.users = [
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
  
  return data;
}

function uploadScans(sheet, scans) {
  try {
    if (!scans || !Array.isArray(scans)) {
      return {error: 'No scans data provided'};
    }
    
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    scans.forEach(scan => {
      try {
        if (scan.type === 'kitchen') {
          // Add to Preparation sheet (Sheet2)
          const prepSheet = sheet.getSheetByName('Sheet2');
          const newRow = [
            scan.fullVYTCode,
            scan.dishLetter,
            scan.user,
            scan.date,
            scan.time,
            'PREPARED',
            scan.company,
            scan.customer,
            scan.department
          ];
          prepSheet.appendRow(newRow);
          results.successful++;
          
        } else if (scan.type === 'return') {
          // Add to Archive sheet (Sheet3)
          const archiveSheet = sheet.getSheetByName('Sheet3');
          const newRow = [
            scan.fullVYTCode,
            scan.originalData ? scan.originalData[1] : 'A', // Dish Letter
            scan.originalData ? scan.originalData[2] : scan.user, // User
            scan.originalData ? scan.originalData[3] : scan.date, // Date
            scan.time,
            'RETURNED',
            scan.originalData ? scan.originalData[6] : scan.company, // Company
            scan.originalData ? scan.originalData[7] : scan.customer, // Customer
            scan.originalData ? scan.originalData[8] : scan.department  // Department
          ];
          archiveSheet.appendRow(newRow);
          
          // Remove from Active Data (Sheet1)
          const activeSheet = sheet.getSheetByName('Sheet1');
          const activeData = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, 9).getValues();
          
          const rowToDelete = activeData.findIndex(row => 
            row[0] === scan.fullVYTCode
          );
          
          if (rowToDelete !== -1) {
            activeSheet.deleteRow(rowToDelete + 2); // +2 because header row and 1-based index
          }
          
          results.successful++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to process scan ${scan.fullVYTCode}: ${error.message}`);
      }
    });
    
    return {
      success: true,
      message: `Processed ${scans.length} scans`,
      details: results
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Handle OPTIONS request for CORS preflight
function doOptions() {
  const response = ContentService.createTextOutput();
  response.setHeader('Access-Control-Allow-Origin', '*')
          .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
