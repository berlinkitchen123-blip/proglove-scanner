function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    const spreadsheetId = '1GZD-cSxI5s4nmfmUefEWOnuzvInncAd9KVaFF41Axxo';
    const sheet = SpreadsheetApp.openById(spreadsheetId);
    
    switch(action) {
      case 'getAllData':
        return getAllData(sheet);
      case 'uploadScans':
        return uploadScans(sheet, e.postData.contents);
      default:
        return createResponse({error: 'Invalid action'}, 400);
    }
  } catch (error) {
    return createResponse({error: error.message}, 500);
  }
}

function getAllData(sheet) {
  const data = {};
  
  // Get Active Data (Sheet1)
  const activeSheet = sheet.getSheetByName('Sheet1');
  data.activeData = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, 9).getValues();
  
  // Get Preparation Data (Sheet2)
  const prepSheet = sheet.getSheetByName('Sheet2');
  data.preparation = prepSheet.getRange(2, 1, prepSheet.getLastRow()-1, 9).getValues();
  
  // Get Archive Data (Sheet3)
  const archiveSheet = sheet.getSheetByName('Sheet3');
  data.archive = archiveSheet.getRange(2, 1, archiveSheet.getLastRow()-1, 9).getValues();
  
  // Get Company Data (Sheet4)
  const companySheet = sheet.getSheetByName('Sheet4');
  data.companyData = companySheet.getRange(2, 1, companySheet.getLastRow()-1, 4).getValues();
  
  // Get Users (hardcoded for now)
  data.users = [
    {name: "Hamid", role: "Kitchen"},
    {name: "Richa", role: "Kitchen"},
    {name: "Jash", role: "Kitchen"},
    {name: "Joel", role: "Kitchen"}
  ];
  
  return createResponse(data);
}

function uploadScans(sheet, postData) {
  const data = JSON.parse(postData);
  const scans = data.scans;
  
  if (!scans || !Array.isArray(scans)) {
    return createResponse({error: 'No scans data provided'}, 400);
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
          scan.originalData[1], // Dish Letter
          scan.originalData[2], // Original User
          scan.originalData[3], // Original Date
          new Date().toLocaleTimeString(),
          'RETURNED',
          scan.originalData[6], // Company
          scan.originalData[7], // Customer
          scan.originalData[8]  // Department
        ];
        archiveSheet.appendRow(newRow);
        
        // Remove from Active Data (Sheet1)
        const activeSheet = sheet.getSheetByName('Sheet1');
        const activeData = activeSheet.getRange(2, 1, activeSheet.getLastRow()-1, 9).getValues();
        
        const rowToDelete = activeData.findIndex(row => 
          row[0] === scan.fullVYTCode
        );
        
        if (rowToDelete !== -1) {
          activeSheet.deleteRow(rowToDelete + 2);
        }
        
        results.successful++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Failed to process scan ${scan.fullVYTCode}: ${error.message}`);
    }
  });
  
  return createResponse({
    success: true,
    message: `Processed ${scans.length} scans`,
    details: results
  });
}

function createResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(statusCode);
}
