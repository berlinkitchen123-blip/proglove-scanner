// ProGlove Scanner - Complete System
window.appData = {
    mode: null,
    user: null,
    dishLetter: null,
    scanning: false,
    myScans: [],
    activeBowls: [],
    preparedBowls: [],
    returnedBowls: [],
    scanHistory: [],
    customerData: [],
    lastActivity: Date.now(),
    lastCleanup: null
};

// CORRECTED USER LIST
const USERS = [
    {name: "Hamid", role: "Kitchen"},
    {name: "Richa", role: "Kitchen"},
    {name: "Jash", role: "Kitchen"},
    {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"},
    {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"},
    {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"},
    {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
];

// STANDARDIZED DATE FUNCTION
function getStandardizedDate(dateString = null) {
    const date = dateString ? new Date(dateString) : new Date();
    return date.toISOString().split('T')[0];
}

// Initialize System
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Scanner System...');
    initializeFirebase();
    loadFromStorage();
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyCleanupTimer();
    
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

// JSON Data Processing
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();
    
    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        
        console.log('🔍 Starting JSON patch process...');
        
        const patchResults = {
            matched: 0,
            failed: []
        };

        // Extract all bowl codes from JSON
        const extractedData = [];
        
        const deliveries = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        deliveries.forEach((delivery, deliveryIndex) => {
            const companyName = delivery.name || "Unknown Company";
            console.log(`Processing delivery ${deliveryIndex + 1}: ${companyName}`);
            
            if (delivery.boxes && Array.isArray(delivery.boxes)) {
                delivery.boxes.forEach((box, boxIndex) => {
                    console.log(`  Processing box ${boxIndex + 1}: ${box.uniqueIdentifier || 'No ID'}`);
                    
                    if (box.dishes && Array.isArray(box.dishes)) {
                        box.dishes.forEach((dish, dishIndex) => {
                            const dishLetter = dish.label || "Unknown";
                            console.log(`    Processing dish ${dishIndex + 1}: ${dish.name || 'No name'} (Label: ${dishLetter})`);
                            
                            // Get customers for this dish
                            let customerNames = "Unknown";
                            let isMultipleCustomers = false;
                            
                            if (dish.users && Array.isArray(dish.users) && dish.users.length > 0) {
                                const customers = dish.users.map(user => user.username).filter(name => name);
                                if (customers.length > 0) {
                                    customerNames = customers.join(', ');
                                    isMultipleCustomers = customers.length > 1;
                                }
                            }
                            
                            if (dish.bowlCodes && Array.isArray(dish.bowlCodes) && dish.bowlCodes.length > 0) {
                                dish.bowlCodes.forEach((bowlCode, codeIndex) => {
                                    const originalCode = bowlCode;
                                    
                                    extractedData.push({
                                        code: originalCode,
                                        company: companyName,
                                        customer: customerNames,
                                        dish: dishLetter,
                                        multipleCustomers: isMultipleCustomers
                                    });
                                    
                                    console.log(`      ✅ Extracted: ${originalCode} | Dish: ${dishLetter} | Customers: ${customerNames}`);
                                });
                            }
                        });
                    }
                });
            }
        });

        // Process each extracted code
        extractedData.forEach((item, index) => {
            const originalCode = item.code;
            
            // Find active bowls with exact code
            const matchingBowls = window.appData.activeBowls.filter(bowl => bowl.code === originalCode);
            
            if (matchingBowls.length > 0) {
                matchingBowls.forEach(bowl => {
                    bowl.company = item.company;
                    bowl.customer = item.customer;
                    bowl.dish = item.dish || bowl.dish;
                    bowl.multipleCustomers = item.multipleCustomers;
                });
                
                patchResults.matched += matchingBowls.length;
            } else {
                patchResults.failed.push({
                    code: originalCode,
                    customer: item.customer,
                    reason: 'No active bowl found'
                });
            }
        });

        // Update display and save
        updateDisplay();
        saveToStorage();
        
        // Sync to Firebase
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => {
                console.log('Firebase sync failed, but data saved locally');
            });
        }
        
        // Show results
        const resultMessage = `✅ JSON patch completed:\n• Total codes: ${extractedData.length}\n• Bowls updated: ${patchResults.matched}\n• Failed: ${patchResults.failed.length}`;
        showMessage(resultMessage, 'success');
        
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

// Ensure dish consistency
function ensureDishConsistency() {
    const dishGroups = {};
    window.appData.activeBowls.forEach(bowl => {
        if (!dishGroups[bowl.dish]) dishGroups[bowl.dish] = [];
        dishGroups[bowl.dish].push(bowl);
    });
    
    Object.values(dishGroups).forEach(bowls => {
        if (bowls.length > 1) {
            const customerCounts = {};
            bowls.forEach(bowl => {
                const key = `${bowl.customer}|${bowl.multipleCustomers}`;
                customerCounts[key] = (customerCounts[key] || 0) + 1;
            });
            
            let mostCommonData = null;
            let maxCount = 0;
            Object.entries(customerCounts).forEach(([key, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonData = key;
                }
            });
            
            if (mostCommonData) {
                const [customer, multipleFlag] = mostCommonData.split('|');
                const isMultiple = multipleFlag === 'true';
                bowls.forEach(bowl => {
                    bowl.customer = customer;
                    bowl.multipleCustomers = isMultiple;
                });
            }
        }
    });
}

// Color coding for customer names
function getCustomerNameColor(bowl) {
    if (bowl.multipleCustomers) return 'red-text';
    if (bowl.customer && bowl.customer !== "Unknown") return 'green-text';
    return '';
}

// Daily Cleanup Timer
function startDailyCleanupTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            clearReturnData();
        }
    }, 60000);
}

function clearReturnData() {
    const today = getStandardizedDate();
    if (window.appData.lastCleanup === today) return;
    
    window.appData.returnedBowls = [];
    window.appData.lastCleanup = today;
    saveToStorage();
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed after cleanup');
        });
    }
    
    showMessage('✅ Return data cleared for new day', 'success');
    updateDisplay();
}

// Storage Functions
function saveToStorage() {
    try {
        localStorage.setItem('proglove_data', JSON.stringify(window.appData));
    } catch (error) {
        console.log('Storage save note:', error.message);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            const data = JSON.parse(saved);
            window.appData = { ...window.appData, ...data };
            console.log('Data loaded from storage');
        }
    } catch (error) {
        console.log('No previous data found - starting fresh');
    }
}

// User and Mode Management
function initializeUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name + (user.role ? ` (${user.role})` : '');
        dropdown.appendChild(option);
    });
}

function setMode(mode) {
    window.appData.mode = mode;
    window.appData.user = null;
    window.appData.dishLetter = null;
    window.appData.scanning = false;
    
    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
    
    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    document.getElementById('userDropdown').value = '';
    document.getElementById('dishDropdown').value = '';
    document.getElementById('progloveInput').value = '';
    
    loadUsers();
    updateStatsLabels();
    updateDisplay();
    updateLastActivity();
    showMessage(`📱 ${mode.toUpperCase()} mode selected`, 'info');
}

function updateStatsLabels() {
    const prepLabel = document.getElementById('prepLabel');
    if (window.appData.mode === 'kitchen') {
        prepLabel.textContent = 'Prepared Today';
    } else {
        prepLabel.textContent = 'Returned Today';
    }
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    
    let usersToShow = [];
    if (window.appData.mode === 'kitchen') {
        usersToShow = USERS.filter(user => user.role === 'Kitchen');
    } else if (window.appData.mode === 'return') {
        usersToShow = USERS.filter(user => user.role === 'Return');
    }
    
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    window.appData.user = dropdown.value;
    
    if (window.appData.user) {
        showMessage(`✅ ${window.appData.user} selected`, 'success');
        if (window.appData.mode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            loadDishLetters();
        }
    }
    updateDisplay();
    updateLastActivity();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    dropdown.innerHTML = '<option value="">-- Select Dish Letter --</option>';
    
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        const option = document.createElement('option');
        option.value = letter;
        option.textContent = letter;
        dropdown.appendChild(option);
    });
    
    '1234'.split('').forEach(number => {
        const option = document.createElement('option');
        option.value = number;
        option.textContent = number;
        dropdown.appendChild(option);
    });
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    window.appData.dishLetter = dropdown.value;
    
    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
    }
    updateDisplay();
    updateLastActivity();
}

// Scanning Functions
function startScanning() {
    if (!window.appData.user) {
        showMessage('❌ Please select user first', 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage('❌ Please select dish letter first', 'error');
        return;
    }
    
    window.appData.scanning = true;
    updateDisplay();
    document.getElementById('progloveInput').focus();
    updateLastActivity();
    showMessage(`🎯 SCANNING ACTIVE - Ready to scan`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    updateLastActivity();
    showMessage(`⏹ Scanning stopped`, 'info');
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    
    const scanValue = e.target.value.trim();
    if (scanValue.length >= 2) {
        processScan(scanValue);
        setTimeout(() => e.target.value = '', 100);
    }
    updateLastActivity();
}

function processScan(code) {
    let result;
    
    if (window.appData.mode === 'kitchen') {
        result = kitchenScan(code);
    } else {
        result = returnScan(code);
    }
    
    document.getElementById('responseTimeValue').textContent = result.responseTime;
    showMessage(result.message, result.type);
    
    if (result.type === 'error') {
        document.getElementById('progloveInput').classList.add('error');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('error'), 2000);
    }
    
    updateDisplay();
    updateOvernightStats();
    updateLastActivity();
}

// Kitchen Scan
function kitchenScan(code) {
    const startTime = Date.now();
    const originalCode = code;
    const today = getStandardizedDate();
    
    if (window.appData.activeBowls.some(bowl => bowl.code === originalCode)) {
        return { message: "❌ Bowl already active: " + originalCode, type: "error", responseTime: Date.now() - startTime };
    }
    
    if (window.appData.preparedBowls.some(bowl => bowl.code === originalCode && bowl.date === today)) {
        return { message: "❌ Already prepared today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
    }
    
    const newBowl = {
        code: originalCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown",
        customer: "Unknown",
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'ACTIVE',
        multipleCustomers: false
    };
    
    window.appData.activeBowls.push(newBowl);
    window.appData.preparedBowls.push({...newBowl, status: 'PREPARED'});
    
    window.appData.myScans.push({
        type: 'kitchen',
        code: originalCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: newBowl.company,
        customer: newBowl.customer,
        timestamp: new Date().toISOString()
    });
    
    saveToStorage();
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { message: `✅ ${window.appData.dishLetter} Prepared: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
}

// Return Scan
function returnScan(code) {
    const startTime = Date.now();
    const originalCode = code;
    const today = getStandardizedDate();
    
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === originalCode);
    
    if (activeBowlIndex === -1) {
        if (window.appData.returnedBowls.some(bowl => bowl.code === originalCode && bowl.returnDate === today)) {
            return { message: "❌ Already returned today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        } else {
            return { message: "❌ Bowl not found in active bowls: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
    }
    
    const activeBowl = window.appData.activeBowls[activeBowlIndex];
    window.appData.activeBowls.splice(activeBowlIndex, 1);
    
    window.appData.returnedBowls.push({
        ...activeBowl,
        returnedBy: window.appData.user,
        returnDate: today,
        returnTime: new Date().toLocaleTimeString(),
        returnTimestamp: new Date().toISOString(),
        status: 'RETURNED'
    });
    
    window.appData.myScans.push({
        type: 'return',
        code: originalCode,
        user: window.appData.user,
        company: activeBowl.company,
        customer: activeBowl.customer,
        timestamp: new Date().toISOString()
    });
    
    saveToStorage();
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { message: `✅ Returned: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
}

// Overnight Statistics - SIMPLE AND WORKING
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    
    const today = getStandardizedDate();
    const todayScans = window.appData.myScans.filter(scan => 
        getStandardizedDate(scan.timestamp) === today
    );

    // Group by dish + user
    const groups = {};
    todayScans.forEach(scan => {
        const key = scan.dish + '-' + scan.user;
        if (!groups[key]) {
            groups[key] = { dish: scan.dish, user: scan.user, count: 0, startTime: scan.timestamp };
        }
        groups[key].count++;
        if (new Date(scan.timestamp) < new Date(groups[key].startTime)) {
            groups[key].startTime = scan.timestamp;
        }
    });

    // Convert to array and sort
    const results = Object.values(groups).sort((a, b) => {
        if (a.dish !== b.dish) return a.dish.localeCompare(b.dish);
        return a.user.localeCompare(b.user);
    });

    // Show results
    if (results.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="4">No scans today</td></tr>';
    } else {
        let html = '';
        results.forEach(item => {
            const time = new Date(item.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            html += `<tr><td>${item.dish}</td><td>${item.user}</td><td>${item.count}</td><td>${time}</td></tr>`;
        });
        statsBody.innerHTML = html;
    }
    
    cycleInfo.textContent = "Today's Activity";
}

// Data Export Functions
function exportActiveBowls() {
    if (window.appData.activeBowls.length === 0) {
        showMessage('❌ No active bowls to export', 'error');
        return;
    }
    
    const csvData = convertToCSV(window.appData.activeBowls, ['code', 'dish', 'company', 'customer', 'user', 'date', 'time']);
    downloadCSV(csvData, 'active_bowls.csv');
    showMessage('✅ Active bowls exported as CSV', 'success');
}

function exportReturnData() {
    const today = getStandardizedDate();
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    
    if (todayReturns.length === 0) {
        showMessage('❌ No return data to export today', 'error');
        return;
    }
    
    const csvData = convertToCSV(todayReturns, ['code', 'dish', 'company', 'customer', 'returnedBy', 'returnDate', 'returnTime']);
    downloadCSV(csvData, 'return_data.csv');
    showMessage('✅ Return data exported as CSV', 'success');
}

function exportAllData() {
    const allData = {
        activeBowls: window.appData.activeBowls,
        preparedBowls: window.appData.preparedBowls,
        returnedBowls: window.appData.returnedBowls,
        customerData: window.appData.customerData,
        scanHistory: window.appData.scanHistory,
        exportTime: new Date().toISOString()
    };
    
    const csvData = convertAllDataToCSV(allData);
    downloadCSV(csvData, 'complete_scanner_data.csv');
    showMessage('✅ All data exported as CSV', 'success');
}

function convertAllDataToCSV(allData) {
    let csvContent = "PROGLOVE SCANNER - COMPLETE DATA EXPORT\n";
    csvContent += `Exported on: ${new Date().toLocaleString()}\n\n`;
    
    // Active Bowls
    csvContent += "ACTIVE BOWLS\n";
    csvContent += "Code,Dish,Company,Customer,User,Date,Time,Status\n";
    allData.activeBowls.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    csvContent += "\n";
    
    // Prepared Bowls (Today)
    const today = getStandardizedDate();
    const todayPrepared = allData.preparedBowls.filter(bowl => bowl.date === today);
    csvContent += "PREPARED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,User,Date,Time,Status\n";
    todayPrepared.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    
    return csvContent;
}

function convertToCSV(data, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => fields.map(field => `"${item[field] || ''}"`).join(','));
    return [headers, ...rows].join('\n');
}

function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Display Functions
function updateDisplay() {
    document.getElementById('userDropdown').disabled = false;
    document.getElementById('dishDropdown').disabled = false;
    
    let canScan = window.appData.user && !window.appData.scanning;
    if (window.appData.mode === 'kitchen') canScan = canScan && window.appData.dishLetter;
    document.getElementById('startBtn').disabled = !canScan;
    document.getElementById('stopBtn').disabled = !window.appData.scanning;
    
    const input = document.getElementById('progloveInput');
    if (window.appData.scanning) {
        document.getElementById('scanSection').classList.add('scanning-active');
        input.placeholder = "Scan VYT code...";
        input.disabled = false;
    } else {
        document.getElementById('scanSection').classList.remove('scanning-active');
        input.placeholder = "Click START SCANNING...";
        input.disabled = !window.appData.scanning;
    }
    
    const today = getStandardizedDate();
    const userTodayScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && 
        getStandardizedDate(scan.timestamp) === today
    ).length;
    
    const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
    
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;
    
    if (window.appData.mode === 'kitchen') {
        document.getElementById('prepCount').textContent = preparedToday;
        document.getElementById('myScansCount').textContent = userTodayScans;
    } else {
        document.getElementById('prepCount').textContent = returnedToday;
        document.getElementById('myScansCount').textContent = userTodayScans;
    }
    
    document.getElementById('exportInfo').innerHTML = `
        <strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} bowls • Prepared: ${preparedToday} today • Returns: ${returnedToday} today
    `;
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// Make functions globally available
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.processJSONData = processJSONData;
window.exportActiveBowls = exportActiveBowls;
window.exportReturnData = exportReturnData;
window.exportAllData = exportAllData;
window.loadFromFirebase = loadFromFirebase;
