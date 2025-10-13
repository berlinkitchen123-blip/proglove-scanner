// ProGlove Scanner - Complete Bowl Tracking System
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

// JSON Data Processing (PASTE instead of upload)
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();
    
    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        
        // Expected JSON format: [{ "vyt_code": "VYT123", "company": "Company A", "customer": "Customer X", "dish": "A" }]
        if (!Array.isArray(jsonData)) {
            throw new Error('JSON should be an array of objects');
        }
        
        window.appData.customerData = jsonData;
        
        // Match customer data with active bowls
        matchCustomerDataWithBowls();
        
        showMessage(`✅ JSON processed: ${jsonData.length} customer records loaded`, 'success');
        document.getElementById('jsonStatus').innerHTML = `<strong>JSON Status:</strong> ${jsonData.length} customer records loaded`;
        
        // Sync to Firebase
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => {
                console.log('Firebase sync failed, but data saved locally');
            });
        }
        
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

function matchCustomerDataWithBowls() {
    window.appData.activeBowls.forEach(bowl => {
        const customerInfo = window.appData.customerData.find(c => c.vyt_code === bowl.code);
        if (customerInfo) {
            bowl.company = customerInfo.company;
            bowl.customer = customerInfo.customer;
            bowl.dish = customerInfo.dish || bowl.dish;
        }
    });
    
    updateDisplay();
}

// Daily Cleanup Timer (7PM Return Data Clear)
function startDailyCleanupTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            clearReturnData();
        }
    }, 60000);
}

function clearReturnData() {
    const today = new Date().toLocaleDateString('en-GB');
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

function kitchenScan(code) {
    const startTime = Date.now();
    const fullCode = code.toUpperCase();
    const today = new Date().toLocaleDateString('en-GB');
    
    // Error Detection: Duplicate scan
    if (window.appData.activeBowls.some(bowl => bowl.code === fullCode)) {
        return { 
            message: "❌ Bowl already active: " + fullCode, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    if (window.appData.preparedBowls.some(bowl => bowl.code === fullCode && bowl.date === today)) {
        return { 
            message: "❌ Already prepared today: " + fullCode, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    // Find customer data from JSON
    const customerInfo = window.appData.customerData.find(c => c.vyt_code === fullCode);
    
    const newBowl = {
        code: fullCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: customerInfo ? customerInfo.company : "Unknown",
        customer: customerInfo ? customerInfo.customer : "Unknown",
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'ACTIVE'
    };
    
    window.appData.activeBowls.push(newBowl);
    window.appData.preparedBowls.push({...newBowl, status: 'PREPARED'});
    
    window.appData.myScans.push({
        type: 'kitchen',
        code: fullCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: newBowl.company,
        customer: newBowl.customer,
        timestamp: new Date().toISOString()
    });
    
    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: fullCode,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `${window.appData.dishLetter} Prepared: ${fullCode}`
    });
    
    saveToStorage();
    
    // REAL-TIME FIREBASE SYNC
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { 
        message: `✅ ${window.appData.dishLetter} Prepared: ${fullCode}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

function returnScan(code) {
    const startTime = Date.now();
    const fullCode = code.toUpperCase();
    const today = new Date().toLocaleDateString('en-GB');
    
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === fullCode);
    
    if (activeBowlIndex === -1) {
        if (window.appData.returnedBowls.some(bowl => bowl.code === fullCode && bowl.returnDate === today)) {
            return { 
                message: "❌ Already returned today: " + fullCode, 
                type: "error",
                responseTime: Date.now() - startTime
            };
        } else {
            return { 
                message: "❌ Bowl not found in active bowls: " + fullCode, 
                type: "error",
                responseTime: Date.now() - startTime
            };
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
        code: fullCode,
        user: window.appData.user,
        company: activeBowl.company,
        customer: activeBowl.customer,
        timestamp: new Date().toISOString(),
        originalData: activeBowl
    });
    
    window.appData.scanHistory.unshift({
        type: 'return',
        code: fullCode,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `Returned: ${fullCode}`
    });
    
    saveToStorage();
    
    // REAL-TIME FIREBASE SYNC
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { 
        message: `✅ Returned: ${fullCode}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// Overnight Statistics Table (10PM-10AM)
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    
    // Calculate overnight cycle (10PM previous day to 10AM current day)
    const now = new Date();
    const today10AM = new Date(now);
    today10AM.setHours(10, 0, 0, 0);
    
    const yesterday10PM = new Date(now);
    yesterday10PM.setDate(yesterday10PM.getDate() - 1);
    yesterday10PM.setHours(22, 0, 0, 0);
    
    const isOvernightCycle = now >= yesterday10PM && now <= today10AM;
    cycleInfo.textContent = isOvernightCycle ? 
        `Yesterday 10PM - Today 10AM` : 
        `Today 10PM - Tomorrow 10AM`;
    
    // Filter scans for overnight cycle
    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= yesterday10PM && scanTime <= today10AM;
    });
    
    // Group by dish and user
    const dishStats = {};
    overnightScans.forEach(scan => {
        const key = `${scan.dish}-${scan.user}`;
        if (!dishStats[key]) {
            dishStats[key] = {
                dish: scan.dish,
                user: scan.user,
                scans: [],
                count: 0,
                startTime: null,
                endTime: null
            };
        }
        
        dishStats[key].scans.push(scan);
        dishStats[key].count++;
        
        const scanTime = new Date(scan.timestamp);
        if (!dishStats[key].startTime || scanTime < new Date(dishStats[key].startTime)) {
            dishStats[key].startTime = scan.timestamp;
        }
        if (!dishStats[key].endTime || scanTime > new Date(dishStats[key].endTime)) {
            dishStats[key].endTime = scan.timestamp;
        }
    });
    
    // Convert to array and sort
    const statsArray = Object.values(dishStats).sort((a, b) => {
        if (a.dish !== b.dish) return a.dish.localeCompare(b.dish);
        return new Date(a.startTime) - new Date(b.startTime);
    });
    
    // Update table
    if (statsArray.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No overnight scans in current cycle</td></tr>';
        return;
    }
    
    let html = '';
    statsArray.forEach(stat => {
        const startTime = stat.startTime ? new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        const endTime = stat.endTime ? new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        
        html += `
            <tr>
                <td class="dish-header">${stat.dish}</td>
                <td>${stat.user}</td>
                <td>${stat.count}</td>
                <td>${startTime}</td>
                <td>${endTime}</td>
            </tr>
        `;
    });
    
    statsBody.innerHTML = html;
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
    const today = new Date().toLocaleDateString('en-GB');
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    
    if (todayReturns.length === 0) {
        showMessage('❌ No return data to export today', 'error');
        return;
    }
    
    const csvData = convertToCSV(todayReturns, ['code', 'dish', 'company', 'customer', 'returnedBy', 'returnDate', 'returnTime']);
    downloadCSV(csvData, 'return_data.csv');
    showMessage('✅ Return data exported as CSV', 'success');
}

function convertToCSV(data, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => {
        return fields.map(field => `"${item[field] || ''}"`).join(',');
    });
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
    
    const today = new Date().toLocaleDateString('en-GB');
    const userTodayScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && 
        new Date(scan.timestamp).toLocaleDateString('en-GB') === today
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

// Enhanced JSON Processing with Detailed Results
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();
    
    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        
        if (!Array.isArray(jsonData)) {
            throw new Error('JSON should be an array of objects');
        }
        
        const patchResults = matchCustomerDataWithBowlsDetailed(jsonData);
        
        showMessage(`✅ JSON patch completed: ${patchResults.matched} bowls updated, ${patchResults.failed.length} failed`, 'success');
        
        // Show detailed results
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Matched: ${patchResults.matched} bowls | Failed: ${patchResults.failed.length} customers`;
        
        const failedDiv = document.getElementById('failedMatches');
        if (patchResults.failed.length > 0) {
            let failedHtml = '<strong>Failed matches:</strong><br>';
            patchResults.failed.forEach(failed => {
                failedHtml += `• ${failed.vyt_code} - ${failed.customer}<br>`;
            });
            failedDiv.innerHTML = failedHtml;
        } else {
            failedDiv.innerHTML = '<em>All customer data matched successfully!</em>';
        }
        
        document.getElementById('jsonStatus').innerHTML = `<strong>JSON Status:</strong> ${jsonData.length} customer records processed`;
        
        // Sync to Firebase
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => {
                console.log('Firebase sync failed, but data saved locally');
            });
        }
        
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

// Detailed customer data matching with results
function matchCustomerDataWithBowlsDetailed(jsonData) {
    const results = {
        matched: 0,
        failed: []
    };
    
    jsonData.forEach(customer => {
        const matchingBowls = window.appData.activeBowls.filter(bowl => bowl.code === customer.vyt_code);
        
        if (matchingBowls.length > 0) {
            // Update all matching bowls
            matchingBowls.forEach(bowl => {
                bowl.company = customer.company;
                bowl.customer = customer.customer;
                bowl.dish = customer.dish || bowl.dish;
            });
            results.matched += matchingBowls.length;
        } else {
            // No active bowl found for this customer
            results.failed.push({
                vyt_code: customer.vyt_code,
                customer: customer.customer,
                company: customer.company
            });
        }
    });
    
    updateDisplay();
    return results;
}

// Export All Data to Excel
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
    const today = new Date().toLocaleDateString('en-GB');
    const todayPrepared = allData.preparedBowls.filter(bowl => bowl.date === today);
    csvContent += "PREPARED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,User,Date,Time,Status\n";
    todayPrepared.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    csvContent += "\n";
    
    // Returned Bowls (Today)
    const todayReturns = allData.returnedBowls.filter(bowl => bowl.returnDate === today);
    csvContent += "RETURNED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,Returned By,Return Date,Return Time\n";
    todayReturns.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${bowl.returnedBy}","${bowl.returnDate}","${bowl.returnTime}"\n`;
    });
    csvContent += "\n";
    
    // Customer Data
    csvContent += "CUSTOMER DATA\n";
    csvContent += "VYT Code,Company,Customer,Dish\n";
    allData.customerData.forEach(customer => {
        csvContent += `"${customer.vyt_code}","${customer.company}","${customer.customer}","${customer.dish}"\n`;
    });
    csvContent += "\n";
    
    // Recent Scan History
    csvContent += "RECENT SCAN HISTORY (Last 50)\n";
    csvContent += "Type,Code,User,Company,Customer,Timestamp,Message\n";
    allData.scanHistory.slice(0, 50).forEach(scan => {
        csvContent += `"${scan.type}","${scan.code}","${scan.user}","${scan.company || ''}","${scan.customer || ''}","${scan.timestamp}","${scan.message}"\n`;
    });
    
    return csvContent;
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
window.loadFromFirebase = loadFromFirebase;
window.exportAllData = exportAllData;
