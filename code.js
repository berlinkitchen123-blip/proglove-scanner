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

// CORRECTED JSON Data Processing - Proper customer assignment
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

        // STEP 1: Extract all bowl codes from JSON with PROPER customer assignment
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
                            
                            // Get SPECIFIC customers for THIS dish
                            let customerNames = "Unknown";
                            let isMultipleCustomers = false;
                            
                            if (dish.users && Array.isArray(dish.users) && dish.users.length > 0) {
                                const customers = dish.users.map(user => user.username).filter(name => name);
                                if (customers.length > 0) {
                                    customerNames = customers.join(', ');
                                    isMultipleCustomers = customers.length > 1;
                                }
                            }
                            
                            console.log(`      Customers for dish ${dishLetter}: ${customerNames} (Multiple: ${isMultipleCustomers})`);
                            
                            if (dish.bowlCodes && Array.isArray(dish.bowlCodes) && dish.bowlCodes.length > 0) {
                                dish.bowlCodes.forEach((bowlCode, codeIndex) => {
                                    // Use ORIGINAL code exactly as in JSON
                                    const originalCode = bowlCode;
                                    
                                    extractedData.push({
                                        code: originalCode, // ORIGINAL code only
                                        company: companyName,
                                        customer: customerNames,
                                        dish: dishLetter,
                                        multipleCustomers: isMultipleCustomers,
                                        delivery: delivery.name,
                                        box: box.uniqueIdentifier
                                    });
                                    
                                    console.log(`      ✅ Extracted: ${originalCode} | Dish: ${dishLetter} | Customers: ${customerNames}`);
                                });
                            } else {
                                console.log(`      ⚠️ No bowlCodes in dish: ${dish.name}`);
                            }
                        });
                    }
                });
            }
        });

        console.log('📋 Extracted bowl codes:', extractedData);
        console.log('🔍 Current Active Bowls:', window.appData.activeBowls.map(b => b.code));

        // STEP 2: Process each extracted code - EXACT MATCHING ONLY
        extractedData.forEach((item, index) => {
            const originalCode = item.code;
            
            console.log(`Looking for active bowl: ${originalCode}`);
            
            // Find ALL active bowls with EXACT ORIGINAL CODE
            const matchingBowls = window.appData.activeBowls.filter(bowl => {
                return bowl.code === originalCode;
            });
            
            if (matchingBowls.length > 0) {
                console.log(`✅ Found ${matchingBowls.length} matches for ${originalCode}`);
                
                // Patch company, customer name, and dish to all matching bowls
                matchingBowls.forEach(bowl => {
                    const oldCompany = bowl.company;
                    const oldCustomer = bowl.customer;
                    const oldDish = bowl.dish;
                    
                    bowl.company = item.company;
                    bowl.customer = item.customer;
                    bowl.dish = item.dish || bowl.dish;
                    bowl.multipleCustomers = item.multipleCustomers;
                    
                    console.log(`🔄 Patched bowl ${bowl.code}:`);
                    console.log(`   Company: "${oldCompany}" → "${bowl.company}"`);
                    console.log(`   Customer: "${oldCustomer}" → "${bowl.customer}"`);
                    console.log(`   Dish: "${oldDish}" → "${bowl.dish}"`);
                    console.log(`   Multiple Customers: ${bowl.multipleCustomers}`);
                });
                
                patchResults.matched += matchingBowls.length;
            } else {
                console.log(`❌ No active bowl found for: ${originalCode}`);
                patchResults.failed.push({
                    code: originalCode,
                    company: item.company,
                    customer: item.customer,
                    dish: item.dish,
                    reason: 'No active bowl found with this exact code',
                    record: index + 1
                });
            }
        });

        // STEP 3: After individual patching, ensure consistency for same dish
        if (patchResults.matched > 0) {
            ensureDishConsistency();
        }
        
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
        const resultMessage = `✅ JSON patch completed:\n` +
                             `• Total codes found: ${extractedData.length}\n` +
                             `• Bowls updated: ${patchResults.matched}\n` +
                             `• Failed matches: ${patchResults.failed.length}`;
        
        showMessage(resultMessage, 'success');
        
        // Show detailed results
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Found: ${extractedData.length} codes | Matched: ${patchResults.matched} bowls | Failed: ${patchResults.failed.length}`;
        
        const failedDiv = document.getElementById('failedMatches');
        if (patchResults.failed.length > 0) {
            let failedHtml = '<strong>Failed matches:</strong><br>';
            patchResults.failed.forEach(failed => {
                failedHtml += `• ${failed.code} - ${failed.customer} (${failed.reason})<br>`;
            });
            failedDiv.innerHTML = failedHtml;
        } else {
            failedDiv.innerHTML = '<em>All codes matched successfully!</em>';
        }
        
        document.getElementById('jsonStatus').innerHTML = 
            `<strong>JSON Status:</strong> ${extractedData.length} codes extracted, ${patchResults.matched} bowls patched`;
        
        console.log('📊 Final patch results:', patchResults);
        
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

// Ensure all bowls with same dish have same customer data
function ensureDishConsistency() {
    const dishGroups = {};
    
    // Group by dish
    window.appData.activeBowls.forEach(bowl => {
        if (!dishGroups[bowl.dish]) {
            dishGroups[bowl.dish] = [];
        }
        dishGroups[bowl.dish].push(bowl);
    });
    
    // For each dish group, use the most common customer data
    Object.values(dishGroups).forEach(bowls => {
        if (bowls.length > 1) {
            // Find the most common customer data in this dish group
            const customerCounts = {};
            bowls.forEach(bowl => {
                const key = `${bowl.customer}|${bowl.multipleCustomers}`;
                customerCounts[key] = (customerCounts[key] || 0) + 1;
            });
            
            // Get the most common customer data
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
                
                // Apply to all bowls in this dish group
                bowls.forEach(bowl => {
                    bowl.customer = customer;
                    bowl.multipleCustomers = isMultiple;
                });
                
                console.log(`🔄 Consolidated dish ${bowls[0].dish}: ${customer} (Multiple: ${isMultiple})`);
            }
        }
    });
    
    // Also update prepared bowls
    window.appData.preparedBowls.forEach(prepBowl => {
        const activeBowl = window.appData.activeBowls.find(bowl => bowl.code === prepBowl.code);
        if (activeBowl) {
            prepBowl.customer = activeBowl.customer;
            prepBowl.company = activeBowl.company;
            prepBowl.dish = activeBowl.dish;
            prepBowl.multipleCustomers = activeBowl.multipleCustomers;
        }
    });
}

// Color coding for customer names - CORRECTED LOGIC
function getCustomerNameColor(bowl) {
    if (bowl.multipleCustomers) {
        return 'red-text'; // Multiple customers = RED
    } else if (bowl.customer && bowl.customer !== "Unknown") {
        return 'green-text'; // Single customer = GREEN
    }
    return ''; // Unknown/No customer = Normal (black)
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

// SIMPLE kitchenScan - Uses ORIGINAL codes only
function kitchenScan(code) {
    const startTime = Date.now();
    
    // Use ORIGINAL scanned code exactly
    const originalCode = code;
    
    const today = getStandardizedDate();
    
    // Error Detection: Duplicate scan (check exact ORIGINAL code)
    if (window.appData.activeBowls.some(bowl => bowl.code === originalCode)) {
        return { 
            message: "❌ Bowl already active: " + originalCode, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    if (window.appData.preparedBowls.some(bowl => bowl.code === originalCode && bowl.date === today)) {
        return { 
            message: "❌ Already prepared today: " + originalCode, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    const newBowl = {
        code: originalCode, // Store ORIGINAL code
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
        code: originalCode, // Use ORIGINAL code
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: newBowl.company,
        customer: newBowl.customer,
        timestamp: new Date().toISOString()
    });
    
    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: originalCode, // Use ORIGINAL code
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `${window.appData.dishLetter} Prepared: ${originalCode}`
    });
    
    saveToStorage();
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { 
        message: `✅ ${window.appData.dishLetter} Prepared: ${originalCode}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// SIMPLE returnScan - Uses ORIGINAL codes only
function returnScan(code) {
    const startTime = Date.now();
    
    // Use ORIGINAL scanned code exactly
    const originalCode = code;
    
    const today = getStandardizedDate();
    
    // Find active bowl by EXACT ORIGINAL code
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === originalCode);
    
    if (activeBowlIndex === -1) {
        if (window.appData.returnedBowls.some(bowl => bowl.code === originalCode && bowl.returnDate === today)) {
            return { 
                message: "❌ Already returned today: " + originalCode, 
                type: "error",
                responseTime: Date.now() - startTime
            };
        } else {
            return { 
                message: "❌ Bowl not found in active bowls: " + originalCode, 
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
        code: originalCode, // Use ORIGINAL code
        user: window.appData.user,
        company: activeBowl.company,
        customer: activeBowl.customer,
        timestamp: new Date().toISOString(),
        originalData: activeBowl
    });
    
    window.appData.scanHistory.unshift({
        type: 'return',
        code: originalCode, // Use ORIGINAL code
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `Returned: ${originalCode}`
    });
    
    saveToStorage();
    
    if (typeof syncToFirebase === 'function') {
        syncToFirebase().catch(() => {
            console.log('Firebase sync failed, but data saved locally');
        });
    }
    
    return { 
        message: `✅ Returned: ${originalCode}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// Overnight Statistics Table - Merge sessions for same user+dish
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Calculate overnight cycle (10PM today to 10AM tomorrow)
    const today10PM = new Date(now);
    today10PM.setHours(22, 0, 0, 0);
    
    const tomorrow10AM = new Date(now);
    tomorrow10AM.setDate(tomorrow10AM.getDate() + 1);
    tomorrow10AM.setHours(10, 0, 0, 0);
    
    let cycleStart, cycleEnd, cycleText;
    
    if (currentHour >= 22 || currentHour < 10) {
        // Overnight shift (10PM to 10AM)
        cycleStart = today10PM;
        cycleEnd = tomorrow10AM;
        cycleText = `Tonight 10PM - Tomorrow 10AM`;
    } else {
        // Day shift - show previous overnight stats
        const yesterday10PM = new Date(now);
        yesterday10PM.setDate(yesterday10PM.getDate() - 1);
        yesterday10PM.setHours(22, 0, 0, 0);
        
        const today10AM = new Date(now);
        today10AM.setHours(10, 0, 0, 0);
        
        cycleStart = yesterday10PM;
        cycleEnd = today10AM;
        cycleText = `Last Night 10PM - Today 10AM`;
    }
    
    cycleInfo.textContent = cycleText;
    
    // Filter scans for the current overnight cycle
    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= cycleStart && scanTime <= cycleEnd;
    });

    console.log(`📊 Overnight stats: ${overnightScans.length} scans in ${cycleText}`);

    // Group by user and dish - MERGE all sessions for same user+dish
    const sessionMap = {};

    overnightScans.forEach(scan => {
        const key = `${scan.user}-${scan.dish}`;
        
        if (!sessionMap[key]) {
            // Create new session for this user+dish combination
            sessionMap[key] = {
                dish: scan.dish,
                user: scan.user,
                scans: [scan],
                count: 1,
                startTime: scan.timestamp,
                lastScanTime: scan.timestamp
            };
        } else {
            // Merge into existing session for same user+dish
            sessionMap[key].scans.push(scan);
            sessionMap[key].count++;
            
            // Update start time if this scan is earlier
            const scanTime = new Date(scan.timestamp);
            const currentStartTime = new Date(sessionMap[key].startTime);
            if (scanTime < currentStartTime) {
                sessionMap[key].startTime = scan.timestamp;
            }
            
            // Update last scan time if this scan is later
            const currentLastTime = new Date(sessionMap[key].lastScanTime);
            if (scanTime > currentLastTime) {
                sessionMap[key].lastScanTime = scan.timestamp;
            }
        }
    });

    // Convert to array
    const sessions = Object.values(sessionMap);

    // Sort sessions: by dish, then by start time
    sessions.sort((a, b) => {
        if (a.dish !== b.dish) {
            const aIsNumber = !isNaN(a.dish);
            const bIsNumber = !isNaN(b.dish);
            
            if (aIsNumber && !bIsNumber) return 1;
            if (!aIsNumber && bIsNumber) return -1;
            if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish);
            return a.dish.localeCompare(b.dish);
        }
        return new Date(a.startTime) - new Date(b.startTime);
    });

    // Update table
    if (sessions.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No scans in current overnight cycle</td></tr>';
        return;
    }

    let html = '';
    sessions.forEach(session => {
        const startTime = session.startTime ? 
            new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
            '-';
        
        html += `
            <tr>
                <td class="dish-header">${session.dish}</td>
                <td>${session.user}</td>
                <td>${session.count}</td>
                <td>${startTime}</td>
            </tr>
        `;
    });

    statsBody.innerHTML = html;
}

// Data Export Functions with COLOR CODING
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

// Export All Data to Excel with COLOR CODING INFO
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
    csvContent += `Exported on: ${new Date().toLocaleString()}\n`;
    csvContent += "COLOR CODING: Single Customer=GREEN, Multiple Customers=RED, Unknown=BLACK\n\n";
    
    // Active Bowls
    csvContent += "ACTIVE BOWLS\n";
    csvContent += "Code,Dish,Company,Customer,Multiple Customers,User,Date,Time,Status\n";
    allData.activeBowls.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${multipleFlag}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    csvContent += "\n";
    
    // Prepared Bowls (Today)
    const today = getStandardizedDate();
    const todayPrepared = allData.preparedBowls.filter(bowl => bowl.date === today);
    csvContent += "PREPARED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,Multiple Customers,User,Date,Time,Status\n";
    todayPrepared.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${multipleFlag}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
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

// Display Functions with COLOR CODING
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
