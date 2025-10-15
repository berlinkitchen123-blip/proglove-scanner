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
    dishTimes: {},
    lastActivity: Date.now(),
    lastCleanup: null,
    lastSync: null
};

// USER LIST
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

// ========== CORE SYSTEM FUNCTIONS ==========
function getStandardizedDate(dateString = null) {
    const date = dateString ? new Date(dateString) : new Date();
    return date.toISOString().split('T')[0];
}

function isKitchenTime() {
    const currentHour = new Date().getHours();
    return currentHour >= 22 || currentHour < 10; // 10PM-10AM
}

// Initialize System
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Scanner System...');
    loadFromStorage();
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyResetTimer();
    
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
    
    // Start emergency input cleanup
    startEmergencyCleanup();
    
    if (typeof initializeFirebase === 'function') {
        initializeFirebase();
    }
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

function startEmergencyCleanup() {
    // Emergency input reset every 2 seconds
    setInterval(() => {
        const input = document.getElementById('progloveInput');
        if (input.value.length > 50) {
            console.log('🚨 EMERGENCY INPUT RESET - Too long:', input.value);
            input.value = '';
            showMessage('🔄 Input auto-cleared', 'info');
        }
    }, 2000);
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    
    const input = e.target;
    const scanValue = input.value;
    
    console.log('🔍 RAW INPUT:', scanValue, 'Length:', scanValue.length);
    
    // 🎯 DETECT ANY VYT CODE (use full URL as-is)
    if (scanValue.includes('vyt') || scanValue.includes('VYT')) {
        console.log('✅ VYT CODE DETECTED - PROCESSING FULL URL');
        
        // CLEAR INPUT IMMEDIATELY (before processing)
        input.value = '';
        
        // PROCESS with error handling - USE FULL ORIGINAL URL
        try {
            processScan(scanValue);
        } catch (error) {
            console.error('❌ SCAN PROCESSING ERROR:', error);
            showMessage('❌ System error - try scanning again', 'error');
        }
    } else if (scanValue.length > 30) {
        // 🎯 CLEAR GARBAGE INPUT (too long but no VYT)
        console.log('🔄 CLEARING GARBAGE INPUT');
        input.value = '';
        showMessage('🔄 Input cleared - ready for scan', 'info');
    }
    
    updateLastActivity();
}

// ========== USER AND MODE MANAGEMENT ==========
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

// ========== SCANNING FUNCTIONS ==========
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

function processScan(code) {
    console.log('🚨 processScan STARTED with FULL URL:', code);
    
    let result;
    
    // AUTO-SWITCH TO KITCHEN during 10PM-10AM
    let actualMode = window.appData.mode;
    if (isKitchenTime()) {
        actualMode = 'kitchen';
        console.log('⏰ Auto-switched to KITCHEN mode (10PM-10AM)');
    }
    
    try {
        if (actualMode === 'kitchen') {
            result = kitchenScan(code);
        } else {
            result = returnScan(code);
        }
        console.log('✅ processScan RESULT:', result);
    } catch (error) {
        console.log('❌ processScan ERROR:', error);
        result = { message: "System error: " + error.message, type: "error", responseTime: 0 };
    }
    
    document.getElementById('responseTimeValue').textContent = result.responseTime + 'ms';
    showMessage(result.message, result.type);
    if (result.type === 'error') {
        document.getElementById('progloveInput').classList.add('error');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('error'), 2000);
    }
    updateDisplay();
    updateOvernightStats();
    updateLastActivity();
    
    return result;
}

function kitchenScan(code) {
    const startTime = Date.now();
    const originalCode = code; // Keep FULL URL
    const today = getStandardizedDate();
    
    console.log('🍳 kitchenScan STARTED with:', originalCode);
    
    // ONLY CHECK: If already prepared today
    const alreadyPrepared = window.appData.preparedBowls.some(bowl => 
        bowl.code === originalCode && bowl.date === today);
    
    if (alreadyPrepared) {
        return { message: "❌ Already prepared today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
    }
    
    // ALWAYS REMOVE from active (if exists)
    window.appData.activeBowls = window.appData.activeBowls.filter(bowl => bowl.code !== originalCode);
    
    // ALWAYS ADD to prepared
    const newPreparedBowl = {
        code: originalCode, // Store FULL URL
        dish: window.appData.dishLetter || "AUTO",
        user: window.appData.user || "AUTO_KITCHEN",
        company: "Unknown",
        customer: "Unknown",
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'PREPARED'
    };
    
    window.appData.preparedBowls.push(newPreparedBowl);
    updateDishTimes(window.appData.dishLetter, window.appData.user);
    
    window.appData.myScans.push({
        type: 'kitchen',
        code: originalCode, // Store FULL URL
        dish: window.appData.dishLetter,
        user: window.appData.user,
        timestamp: new Date().toISOString()
    });
    
    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: originalCode, // Store FULL URL
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `${window.appData.dishLetter} Prepared: ${originalCode}`
    });
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => console.log('Firebase sync failed after kitchen scan'));
    }
    
    console.log('🍳 kitchenScan COMPLETED');
    return { message: `✅ ${window.appData.dishLetter} Prepared: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
}

function returnScan(code) {
    const startTime = Date.now();
    const originalCode = code;
    const today = getStandardizedDate();
    
    console.log('🔄 returnScan STARTED with:', originalCode);
    
    try {
        // Check if already returned today
        if (window.appData.returnedBowls.some(bowl => bowl.code === originalCode && bowl.returnDate === today)) {
            return { message: "❌ Already returned today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
        
        let sourceBowl = null;
        let sourceType = '';
        
        // First check prepared bowls
        const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === originalCode);
        if (preparedIndex !== -1) {
            sourceBowl = window.appData.preparedBowls[preparedIndex];
            sourceType = 'prepared';
            window.appData.preparedBowls.splice(preparedIndex, 1);
            console.log('📦 Found in prepared bowls, removed from prepared');
        } 
        // Then check active bowls
        else {
            const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === originalCode);
            if (activeIndex !== -1) {
                sourceBowl = window.appData.activeBowls[activeIndex];
                sourceType = 'active';
                window.appData.activeBowls.splice(activeIndex, 1);
                console.log('📦 Found in active bowls, removed from active');
            }
        }
        
        if (!sourceBowl) {
            return { message: "❌ Bowl not found in active or prepared: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
        
        // 🎯 SAFELY CREATE returned bowl - don't use spread if sourceBowl is corrupted
        const returnedBowl = {
            code: sourceBowl.code || originalCode,
            dish: sourceBowl.dish || "Unknown",
            user: sourceBowl.user || "Unknown",
            company: sourceBowl.company || "Unknown",
            customer: sourceBowl.customer || "Unknown",
            date: sourceBowl.date || today,
            time: sourceBowl.time || new Date().toLocaleTimeString(),
            timestamp: sourceBowl.timestamp || new Date().toISOString(),
            returnedBy: window.appData.user,
            returnDate: today,
            returnTime: new Date().toLocaleTimeString(),
            returnTimestamp: new Date().toISOString(),
            status: 'RETURNED',
            source: sourceType
        };
        
        window.appData.returnedBowls.push(returnedBowl);
        console.log('✅ Added to returned bowls');
        
        // Add to my scans
        window.appData.myScans.push({
            type: 'return',
            code: originalCode,
            user: window.appData.user,
            timestamp: new Date().toISOString()
        });
        
        // Add to scan history
        window.appData.scanHistory.unshift({
            type: 'return',
            code: originalCode,
            user: window.appData.user,
            timestamp: new Date().toISOString(),
            message: `Returned: ${originalCode} (from ${sourceType})`
        });
        
        // Sync to Firebase
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => console.log('Firebase sync failed after return scan'));
        }
        
        console.log('🔄 returnScan COMPLETED SUCCESSFULLY');
        return { message: `✅ Returned: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
        
    } catch (error) {
        console.error('❌ returnScan ERROR:', error);
        console.error('Error details:', error.message, error.stack);
        return { message: "❌ System error during return: " + error.message, type: "error", responseTime: Date.now() - startTime };
    }
}

// ========== DISH TIME TRACKING ==========
function updateDishTimes(dishLetter, user) {
    const now = new Date();
    const timeKey = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (!window.appData.dishTimes[dishLetter]) {
        window.appData.dishTimes[dishLetter] = {
            firstScan: timeKey,
            lastScan: timeKey,
            users: [user], // ✅ FIXED: Use ARRAY instead of Set
            count: 1
        };
    } else {
        window.appData.dishTimes[dishLetter].lastScan = timeKey;
        
        // ✅ FIXED: Use ARRAY operations instead of Set
        if (!window.appData.dishTimes[dishLetter].users.includes(user)) {
            window.appData.dishTimes[dishLetter].users.push(user);
        }
        
        window.appData.dishTimes[dishLetter].count++;
    }
}

// ========== DAILY RESET FUNCTIONS ==========
function startDailyResetTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 22 && now.getMinutes() === 0) {
            resetDailyStatistics();
        }
    }, 60000);
}

function resetDailyStatistics() {
    const today = getStandardizedDate();
    
    if (window.appData.lastCleanup === today) return;
    
    console.log('🔄 Resetting daily statistics at 10PM');
    
    const overnightPrepared = window.appData.preparedBowls.filter(bowl => {
        const bowlTime = new Date(bowl.timestamp);
        const bowlHour = bowlTime.getHours();
        return bowlHour >= 22 || bowlHour < 10;
    });
    
    overnightPrepared.forEach(bowl => {
        const activeBowl = {
            ...bowl,
            status: 'ACTIVE',
            preparedTimestamp: bowl.timestamp,
            timestamp: new Date().toISOString()
        };
        window.appData.activeBowls.push(activeBowl);
    });
    
    window.appData.myScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        const scanHour = scanTime.getHours();
        return scanHour >= 22 || scanHour < 10;
    });
    
    window.appData.lastCleanup = today;
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => console.log('Firebase sync failed after daily reset'));
    }
    
    updateDisplay();
    updateOvernightStats();
    showMessage('✅ Daily statistics reset - Overnight bowls moved to active', 'success');
}

// ========== JSON PROCESSING ==========
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();
    
    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        console.log('🔍 Starting JSON assignment process...');
        
        const patchResults = { matched: 0, failed: [], removedFromPrepared: 0, newActive: 0 };
        const extractedData = [];
        const deliveries = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        deliveries.forEach(delivery => {
            if (delivery.boxes && Array.isArray(delivery.boxes)) {
                delivery.boxes.forEach(box => {
                    if (box.dishes && Array.isArray(box.dishes)) {
                        box.dishes.forEach(dish => {
                            if (dish.bowlCodes && Array.isArray(dish.bowlCodes)) {
                                dish.bowlCodes.forEach(bowlCode => {
                                    let customerName = "Unknown";
                                    if (dish.users && dish.users.length > 0) {
                                        customerName = dish.users.map(user => user.username).join(', ');
                                    }
                                    extractedData.push({
                                        code: bowlCode,
                                        company: delivery.name || "Unknown Company",
                                        customer: customerName,
                                        dish: dish.label || "Unknown"
                                    });
                                });
                            }
                        });
                    }
                });
            }
        });

        extractedData.forEach(item => {
            const originalCode = item.code;
            
            const activeMatches = window.appData.activeBowls.filter(bowl => bowl.code === originalCode);
            if (activeMatches.length > 0) {
                activeMatches.forEach(bowl => {
                    bowl.company = item.company;
                    bowl.customer = item.customer;
                    bowl.dish = item.dish || bowl.dish;
                });
                patchResults.matched += activeMatches.length;
            }
            
            const preparedMatches = window.appData.preparedBowls.filter(bowl => bowl.code === originalCode);
            if (preparedMatches.length > 0) {
                preparedMatches.forEach(bowl => {
                    bowl.company = item.company;
                    bowl.customer = item.customer;
                    bowl.dish = item.dish || bowl.dish;
                });
                patchResults.matched += preparedMatches.length;
            }
            
            if (activeMatches.length === 0 && preparedMatches.length === 0) {
                const newBowl = {
                    code: originalCode,
                    dish: item.dish,
                    user: "JSON_ASSIGNMENT",
                    company: item.company,
                    customer: item.customer,
                    date: getStandardizedDate(),
                    time: new Date().toLocaleTimeString(),
                    timestamp: new Date().toISOString(),
                    status: 'ASSIGNED_FROM_JSON'
                };
                window.appData.activeBowls.push(newBowl);
                patchResults.newActive++;
            }
        });

        combineCustomerNamesByDish();
        
        updateDisplay();
        
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => console.log('Firebase sync failed after JSON processing'));
        }
        
        const resultMessage = `✅ JSON assignment completed:\n` +
                           `• Total codes: ${extractedData.length}\n` +
                           `• Bowls updated: ${patchResults.matched}\n` +
                           `• New active entries: ${patchResults.newActive}\n` +
                           `• Failed: ${patchResults.failed.length}`;
        
        showMessage(resultMessage, 'success');
        
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Found: ${extractedData.length} codes | Bowls Updated: ${patchResults.matched} | New Active: ${patchResults.newActive} | Failed: ${patchResults.failed.length}`;
        
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

function combineCustomerNamesByDish() {
    const dishGroups = {};
    window.appData.activeBowls.forEach(bowl => {
        const key = `${bowl.dish}-${bowl.company}`;
        if (!dishGroups[key]) dishGroups[key] = [];
        dishGroups[key].push(bowl);
    });
    
    Object.values(dishGroups).forEach(bowls => {
        if (bowls.length > 1) {
            const allCustomers = [...new Set(bowls.map(b => b.customer))].filter(name => name && name !== "Unknown");
            if (allCustomers.length > 1) {
                const combinedCustomers = allCustomers.join(', ');
                bowls.forEach(bowl => {
                    bowl.customer = combinedCustomers;
                    bowl.multipleCustomers = true;
                });
            }
        }
    });
}

// ========== DATA EXPORT FUNCTIONS ==========
function exportAllData() {
    const today = getStandardizedDate();
    const todayPrepared = window.appData.preparedBowls.filter(bowl => bowl.date === today);
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    
    let csvContent = "PROGLOVE SCANNER - COMPLETE DATA EXPORT\n";
    csvContent += `Exported on: ${new Date().toLocaleString()}\n\n`;
    
    csvContent += "PREPARED BOWLS (TODAY)\n";
    csvContent += "VYT Code,Dish Letter,Prepared By,Date,Time,Company,Customer,Multiple Customers\n";
    todayPrepared.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.company}","${bowl.customer}","${multipleFlag}"\n`;
    });
    csvContent += "\n";
    
    csvContent += "ACTIVE BOWLS\n";
    csvContent += "VYT Code,Dish Letter,Prepared By,Date,Time,Company,Customer,Multiple Customers,Status\n";
    window.appData.activeBowls.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.company}","${bowl.customer}","${multipleFlag}","${bowl.status}"\n`;
    });
    csvContent += "\n";
    
    csvContent += "RETURNED BOWLS (TODAY)\n";
    csvContent += "VYT Code,Dish Letter,Returned By,Return Date,Return Time,Original Prepared By,Company,Customer\n";
    todayReturns.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.returnedBy}","${bowl.returnDate}","${bowl.returnTime}","${bowl.user}","${bowl.company}","${bowl.customer}"\n`;
    });
    
    downloadCSV(csvContent, `proglove_data_${today}.csv`);
    showMessage('✅ All data exported as CSV with multiple sheets', 'success');
}

function exportActiveBowls() {
    if (window.appData.activeBowls.length === 0) {
        showMessage('❌ No active bowls to export', 'error');
        return;
    }
    const csvData = convertToCSV(window.appData.activeBowls, 
        ['code', 'dish', 'user', 'date', 'time', 'company', 'customer', 'status']);
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
    const csvData = convertToCSV(todayReturns, 
        ['code', 'dish', 'returnedBy', 'returnDate', 'returnTime', 'user', 'company', 'customer']);
    downloadCSV(csvData, 'return_data.csv');
    showMessage('✅ Return data exported as CSV', 'success');
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

// ========== UTILITY FUNCTIONS ==========
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
        scan.user === window.appData.user && getStandardizedDate(scan.timestamp) === today).length;
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
    
    document.getElementById('exportInfo').innerHTML = 
        `<strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} | Prepared: ${preparedToday} | Returns: ${returnedToday}`;
}

function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    
    const now = new Date();
    const currentHour = now.getHours();
    let cycleStart, cycleEnd, cycleText;
    
    if (currentHour >= 22 || currentHour < 10) {
        cycleStart = new Date(now); 
        if (currentHour < 10) {
            cycleStart.setDate(cycleStart.getDate() - 1);
        }
        cycleStart.setHours(22, 0, 0, 0);
        cycleEnd = new Date(now); 
        cycleEnd.setDate(cycleEnd.getDate() + 1); 
        cycleEnd.setHours(10, 0, 0, 0);
        cycleText = `Tonight 10PM - Tomorrow 10AM`;
    } else {
        cycleStart = new Date(now); 
        cycleStart.setDate(cycleStart.getDate() - 1); 
        cycleStart.setHours(22, 0, 0, 0);
        cycleEnd = new Date(now); 
        cycleEnd.setHours(10, 0, 0, 0);
        cycleText = `Last Night 10PM - Today 10AM`;
    }
    
    cycleInfo.textContent = cycleText;
    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= cycleStart && scanTime <= cycleEnd;
    });
    
    const dishStats = {};
    overnightScans.forEach(scan => {
        const key = `${scan.dish}-${scan.user}`;
        if (!dishStats[key]) {
            dishStats[key] = { dish: scan.dish, user: scan.user, count: 0, startTime: null, endTime: null };
        }
        dishStats[key].count++;
        const scanTime = new Date(scan.timestamp);
        if (!dishStats[key].startTime || scanTime < new Date(dishStats[key].startTime)) {
            dishStats[key].startTime = scan.timestamp;
        }
        if (!dishStats[key].endTime || scanTime > new Date(dishStats[key].endTime)) {
            dishStats[key].endTime = scan.timestamp;
        }
    });
    
    const statsArray = Object.values(dishStats).sort((a, b) => {
        if (a.dish !== b.dish) {
            const aIsNumber = !isNaN(a.dish), bIsNumber = !isNaN(b.dish);
            if (aIsNumber && !bIsNumber) return 1;
            if (!aIsNumber && bIsNumber) return -1;
            if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish);
            return a.dish.localeCompare(b.dish);
        }
        return new Date(a.startTime) - new Date(b.startTime);
    });
    
    if (statsArray.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No scans in current overnight cycle</td></tr>';
        return;
    }
    
    let html = '';
    statsArray.forEach(stat => {
        const startTime = stat.startTime ? new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        const endTime = stat.endTime ? new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        html += `<tr><td class="dish-header">${stat.dish}</td><td>${stat.user}</td><td>${stat.count}</td><td>${startTime}</td><td>${endTime}</td></tr>`;
    });
    statsBody.innerHTML = html;
}

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

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// ========== GLOBAL FUNCTIONS ==========
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.processJSONData = processJSONData;
window.exportActiveBowls = exportActiveBowls;
window.exportReturnData = exportReturnData;
window.exportAllData = exportAllData;
