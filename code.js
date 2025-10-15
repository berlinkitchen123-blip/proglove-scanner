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
    try {
        const date = dateString ? new Date(dateString) : new Date();
        if (isNaN(date.getTime())) {
            return new Date().toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    } catch (error) {
        console.error('❌ Date conversion error:', error);
        return new Date().toISOString().split('T')[0];
    }
}

function isKitchenTime() {
    try {
        const currentHour = new Date().getHours();
        return currentHour >= 22 || currentHour < 10;
    } catch (error) {
        console.error('❌ Time check error:', error);
        return false;
    }
}

// ========== SYSTEM DEBUG & VALIDATION ==========
function validateSystem() {
    try {
        const errors = [];
        
        if (!window.appData) errors.push("❌ appData not initialized");
        if (!Array.isArray(window.appData.activeBowls)) errors.push("❌ activeBowls not array");
        if (!Array.isArray(window.appData.preparedBowls)) errors.push("❌ preparedBowls not array");
        if (!Array.isArray(window.appData.returnedBowls)) errors.push("❌ returnedBowls not array");
        if (!Array.isArray(window.appData.myScans)) errors.push("❌ myScans not array");
        
        if (errors.length > 0) {
            console.error('SYSTEM VALIDATION ERRORS:', errors);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ validateSystem error:', error);
        return false;
    }
}

function debugSystem() {
    console.log('=== SYSTEM DEBUG ===');
    console.log('User:', window.appData.user);
    console.log('Mode:', window.appData.mode);
    console.log('Dish Letter:', window.appData.dishLetter);
    console.log('Scanning:', window.appData.scanning);
    console.log('Active bowls:', window.appData.activeBowls.length);
    console.log('Prepared bowls:', window.appData.preparedBowls.length);
    console.log('Returned bowls:', window.appData.returnedBowls.length);
    console.log('My scans:', window.appData.myScans.length);
    console.log('====================');
}

// Initialize System
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Scanner System...');
    
    try {
        loadFromStorage();
        if (!validateSystem()) {
            console.warn('⚠️ System validation failed, resetting data...');
            resetSystemData();
        }
        
        initializeUsers();
        updateDisplay();
        updateOvernightStats();
        startDailyResetTimer();
        
        document.getElementById('progloveInput').addEventListener('input', handleScanInput);
        document.addEventListener('click', updateLastActivity);
        document.addEventListener('keydown', updateLastActivity);
        
        startEmergencyCleanup();
        
        if (typeof initializeFirebase === 'function') {
            initializeFirebase();
        }
        
        console.log('✅ System initialized successfully');
        showMessage('✅ System ready', 'success');
        
    } catch (error) {
        console.error('❌ System initialization failed:', error);
        showMessage('❌ System initialization failed', 'error');
    }
});

function resetSystemData() {
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
    saveToStorage();
}

function updateLastActivity() {
    try {
        window.appData.lastActivity = Date.now();
    } catch (error) {
        console.error('❌ updateLastActivity error:', error);
    }
}

function startEmergencyCleanup() {
    try {
        setInterval(() => {
            const input = document.getElementById('progloveInput');
            if (input && input.value.length > 50) {
                console.log('🔄 Emergency input reset');
                input.value = '';
            }
        }, 2000);
    } catch (error) {
        console.error('❌ Emergency cleanup error:', error);
    }
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    
    try {
        const input = e.target;
        const scanValue = input.value.trim();
        
        console.log('🔍 SCAN INPUT:', scanValue);
        
        // Check if we have a valid VYT code
        if (scanValue.length >= 6 && (scanValue.includes('vyt') || scanValue.includes('VYT'))) {
            console.log('✅ VALID SCAN DETECTED');
            
            // Clear input immediately
            input.value = '';
            
            // Validate system state before processing
            if (!window.appData.user) {
                showMessage('❌ Please select user first', 'error');
                return;
            }
            
            if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
                showMessage('❌ Please select dish letter first', 'error');
                return;
            }
            
            // Process the scan
            const result = processScan(scanValue);
            console.log('📊 Scan result:', result);
            
        } else if (scanValue.length > 20) {
            // Clear garbage input
            console.log('🔄 Clearing long input:', scanValue);
            input.value = '';
        }
        
        updateLastActivity();
        
    } catch (error) {
        console.error('❌ HANDLE SCAN INPUT ERROR:', error);
        console.error('Error details:', error.message, error.stack);
        
        // Clear the input field on error
        const input = document.getElementById('progloveInput');
        if (input) input.value = '';
        
        showMessage('❌ Scan error - please try again', 'error');
    }
}

// ========== USER AND MODE MANAGEMENT ==========
function initializeUsers() {
    try {
        const dropdown = document.getElementById('userDropdown');
        if (!dropdown) {
            console.error('❌ userDropdown not found');
            return;
        }
        
        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        USERS.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name + (user.role ? ` (${user.role})` : '');
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error('❌ initializeUsers error:', error);
    }
}

function setMode(mode) {
    try {
        if (mode !== 'kitchen' && mode !== 'return') {
            console.error('❌ Invalid mode:', mode);
            return;
        }
        
        window.appData.mode = mode;
        window.appData.user = null;
        window.appData.dishLetter = null;
        window.appData.scanning = false;
        
        // Update UI safely
        const kitchenBtn = document.getElementById('kitchenBtn');
        const returnBtn = document.getElementById('returnBtn');
        const dishSection = document.getElementById('dishSection');
        const userDropdown = document.getElementById('userDropdown');
        const dishDropdown = document.getElementById('dishDropdown');
        const progloveInput = document.getElementById('progloveInput');
        
        if (kitchenBtn) kitchenBtn.classList.toggle('active', mode === 'kitchen');
        if (returnBtn) returnBtn.classList.toggle('active', mode === 'return');
        if (dishSection) dishSection.classList.toggle('hidden', mode !== 'kitchen');
        if (userDropdown) userDropdown.value = '';
        if (dishDropdown) dishDropdown.value = '';
        if (progloveInput) progloveInput.value = '';
        
        loadUsers();
        updateStatsLabels();
        updateDisplay();
        updateLastActivity();
        
        showMessage(`📱 ${mode.toUpperCase()} mode selected`, 'info');
    } catch (error) {
        console.error('❌ setMode error:', error);
        showMessage('❌ Mode selection error', 'error');
    }
}

function updateStatsLabels() {
    try {
        const prepLabel = document.getElementById('prepLabel');
        if (prepLabel) {
            prepLabel.textContent = window.appData.mode === 'kitchen' ? 'Prepared Today' : 'Returned Today';
        }
    } catch (error) {
        console.error('❌ updateStatsLabels error:', error);
    }
}

function loadUsers() {
    try {
        const dropdown = document.getElementById('userDropdown');
        if (!dropdown) return;
        
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
    } catch (error) {
        console.error('❌ loadUsers error:', error);
    }
}

function selectUser() {
    try {
        const dropdown = document.getElementById('userDropdown');
        if (!dropdown) return;
        
        window.appData.user = dropdown.value;
        if (window.appData.user) {
            showMessage(`✅ ${window.appData.user} selected`, 'success');
            if (window.appData.mode === 'kitchen') {
                const dishSection = document.getElementById('dishSection');
                if (dishSection) dishSection.classList.remove('hidden');
                loadDishLetters();
            }
        }
        updateDisplay();
        updateLastActivity();
    } catch (error) {
        console.error('❌ selectUser error:', error);
        showMessage('❌ User selection error', 'error');
    }
}

function loadDishLetters() {
    try {
        const dropdown = document.getElementById('dishDropdown');
        if (!dropdown) return;
        
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
    } catch (error) {
        console.error('❌ loadDishLetters error:', error);
    }
}

function selectDishLetter() {
    try {
        const dropdown = document.getElementById('dishDropdown');
        if (!dropdown) return;
        
        window.appData.dishLetter = dropdown.value;
        if (window.appData.dishLetter) {
            showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
        }
        updateDisplay();
        updateLastActivity();
    } catch (error) {
        console.error('❌ selectDishLetter error:', error);
        showMessage('❌ Dish selection error', 'error');
    }
}

// ========== SCANNING FUNCTIONS ==========
function startScanning() {
    try {
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
        
        const input = document.getElementById('progloveInput');
        if (input) input.focus();
        
        updateLastActivity();
        showMessage(`🎯 SCANNING ACTIVE - Ready to scan`, 'success');
    } catch (error) {
        console.error('❌ startScanning error:', error);
        showMessage('❌ Start scanning error', 'error');
    }
}

function stopScanning() {
    try {
        window.appData.scanning = false;
        updateDisplay();
        updateLastActivity();
        showMessage(`⏹ Scanning stopped`, 'info');
    } catch (error) {
        console.error('❌ stopScanning error:', error);
        showMessage('❌ Stop scanning error', 'error');
    }
}

function processScan(code) {
    console.log('🔍 Processing scan:', code);
    
    let result;
    try {
        let actualMode = window.appData.mode;
        if (isKitchenTime()) {
            actualMode = 'kitchen';
            console.log('⏰ Auto-switched to KITCHEN mode');
        }
        
        if (actualMode === 'kitchen') {
            result = kitchenScan(code);
        } else {
            result = returnScan(code);
        }
        
        console.log('✅ Scan result:', result);
    } catch (error) {
        console.error('❌ processScan error:', error);
        result = { message: "System error: " + error.message, type: "error", responseTime: 0 };
    }
    
    try {
        const responseTimeElement = document.getElementById('responseTimeValue');
        if (responseTimeElement) {
            responseTimeElement.textContent = result.responseTime + 'ms';
        }
        
        showMessage(result.message, result.type);
        
        if (result.type === 'error') {
            const input = document.getElementById('progloveInput');
            if (input) {
                input.classList.add('error');
                setTimeout(() => input.classList.remove('error'), 2000);
            }
        }
        
        updateDisplay();
        updateOvernightStats();
        updateLastActivity();
        
    } catch (uiError) {
        console.error('❌ UI update error after scan:', uiError);
    }
    
    return result;
}

function kitchenScan(code) {
    const startTime = Date.now();
    const originalCode = code;
    const today = getStandardizedDate();
    
    try {
        // Check if already prepared today
        const alreadyPrepared = window.appData.preparedBowls.some(bowl => 
            bowl.code === originalCode && bowl.date === today);
        
        if (alreadyPrepared) {
            return { message: "❌ Already prepared today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
        
        // Remove from active if exists
        window.appData.activeBowls = window.appData.activeBowls.filter(bowl => bowl.code !== originalCode);
        
        // Add to prepared
        const newPreparedBowl = {
            code: originalCode,
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
            code: originalCode,
            dish: window.appData.dishLetter,
            user: window.appData.user,
            timestamp: new Date().toISOString()
        });
        
        window.appData.scanHistory.unshift({
            type: 'kitchen',
            code: originalCode,
            user: window.appData.user,
            timestamp: new Date().toISOString(),
            message: `${window.appData.dishLetter} Prepared: ${originalCode}`
        });
        
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => console.log('Firebase sync failed'));
        }
        
        return { message: `✅ ${window.appData.dishLetter} Prepared: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
        
    } catch (error) {
        console.error('❌ kitchenScan error:', error);
        return { message: "❌ Kitchen scan error: " + error.message, type: "error", responseTime: Date.now() - startTime };
    }
}

function returnScan(code) {
    const startTime = Date.now();
    const originalCode = code;
    const today = getStandardizedDate();
    
    try {
        // Validate user
        if (!window.appData.user) {
            return { message: "❌ Please select user first", type: "error", responseTime: Date.now() - startTime };
        }
        
        // Check if already returned today
        const alreadyReturned = window.appData.returnedBowls.some(bowl => 
            bowl.code === originalCode && bowl.returnDate === today);
        
        if (alreadyReturned) {
            return { message: "❌ Already returned today: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
        
        let sourceBowl = null;
        let sourceType = '';
        
        // Check prepared bowls
        const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === originalCode);
        if (preparedIndex !== -1) {
            sourceBowl = window.appData.preparedBowls[preparedIndex];
            sourceType = 'prepared';
            window.appData.preparedBowls.splice(preparedIndex, 1);
        } 
        // Check active bowls
        else {
            const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === originalCode);
            if (activeIndex !== -1) {
                sourceBowl = window.appData.activeBowls[activeIndex];
                sourceType = 'active';
                window.appData.activeBowls.splice(activeIndex, 1);
            }
        }
        
        if (!sourceBowl) {
            return { message: "❌ Bowl not found: " + originalCode, type: "error", responseTime: Date.now() - startTime };
        }
        
        // Create returned bowl
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
            message: `Returned: ${originalCode}`
        });
        
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => console.log('Firebase sync failed'));
        }
        
        return { message: `✅ Returned: ${originalCode}`, type: "success", responseTime: Date.now() - startTime };
        
    } catch (error) {
        console.error('❌ returnScan error:', error);
        return { message: "❌ Return scan error: " + error.message, type: "error", responseTime: Date.now() - startTime };
    }
}

// ========== DISH TIME TRACKING ==========
function updateDishTimes(dishLetter, user) {
    try {
        const now = new Date();
        const timeKey = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (!window.appData.dishTimes[dishLetter]) {
            window.appData.dishTimes[dishLetter] = {
                firstScan: timeKey,
                lastScan: timeKey,
                users: [user],
                count: 1
            };
        } else {
            window.appData.dishTimes[dishLetter].lastScan = timeKey;
            if (!window.appData.dishTimes[dishLetter].users.includes(user)) {
                window.appData.dishTimes[dishLetter].users.push(user);
            }
            window.appData.dishTimes[dishLetter].count++;
        }
    } catch (error) {
        console.error('❌ updateDishTimes error:', error);
    }
}

// ========== DAILY RESET FUNCTIONS ==========
function startDailyResetTimer() {
    try {
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 22 && now.getMinutes() === 0) {
                resetDailyStatistics();
            }
        }, 60000);
    } catch (error) {
        console.error('❌ startDailyResetTimer error:', error);
    }
}

function resetDailyStatistics() {
    try {
        const today = getStandardizedDate();
        if (window.appData.lastCleanup === today) return;
        
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
        
        window.appData.lastCleanup = today;
        
        if (typeof syncToFirebase === 'function') {
            syncToFirebase().catch(() => console.log('Firebase sync failed'));
        }
        
        updateDisplay();
        updateOvernightStats();
        showMessage('✅ Daily statistics reset', 'success');
    } catch (error) {
        console.error('❌ resetDailyStatistics error:', error);
    }
}

// ========== DATA EXPORT FUNCTIONS ==========
function exportAllData() {
    try {
        const today = getStandardizedDate();
        const todayPrepared = window.appData.preparedBowls.filter(bowl => bowl.date === today);
        const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
        
        let csvContent = "PROGLOVE SCANNER - COMPLETE DATA EXPORT\n";
        csvContent += `Exported on: ${new Date().toLocaleString()}\n\n`;
        
        // Prepared bowls
        csvContent += "PREPARED BOWLS (TODAY)\n";
        csvContent += "VYT Code,Dish Letter,Prepared By,Date,Time,Company,Customer\n";
        todayPrepared.forEach(bowl => {
            csvContent += `"${bowl.code}","${bowl.dish}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.company}","${bowl.customer}"\n`;
        });
        csvContent += "\n";
        
        // Active bowls
        csvContent += "ACTIVE BOWLS\n";
        csvContent += "VYT Code,Dish Letter,Prepared By,Date,Time,Company,Customer,Status\n";
        window.appData.activeBowls.forEach(bowl => {
            csvContent += `"${bowl.code}","${bowl.dish}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.company}","${bowl.customer}","${bowl.status}"\n`;
        });
        csvContent += "\n";
        
        // Returned bowls
        csvContent += "RETURNED BOWLS (TODAY)\n";
        csvContent += "VYT Code,Dish Letter,Returned By,Return Date,Return Time,Original Prepared By,Company,Customer\n";
        todayReturns.forEach(bowl => {
            csvContent += `"${bowl.code}","${bowl.dish}","${bowl.returnedBy}","${bowl.returnDate}","${bowl.returnTime}","${bowl.user}","${bowl.company}","${bowl.customer}"\n`;
        });
        
        downloadCSV(csvContent, `proglove_data_${today}.csv`);
        showMessage('✅ All data exported', 'success');
    } catch (error) {
        console.error('❌ exportAllData error:', error);
        showMessage('❌ Export error', 'error');
    }
}

function exportActiveBowls() {
    try {
        if (window.appData.activeBowls.length === 0) {
            showMessage('❌ No active bowls to export', 'error');
            return;
        }
        const csvData = convertToCSV(window.appData.activeBowls, 
            ['code', 'dish', 'user', 'date', 'time', 'company', 'customer', 'status']);
        downloadCSV(csvData, 'active_bowls.csv');
        showMessage('✅ Active bowls exported', 'success');
    } catch (error) {
        console.error('❌ exportActiveBowls error:', error);
        showMessage('❌ Export error', 'error');
    }
}

function exportReturnData() {
    try {
        const today = getStandardizedDate();
        const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
        if (todayReturns.length === 0) {
            showMessage('❌ No return data to export', 'error');
            return;
        }
        const csvData = convertToCSV(todayReturns, 
            ['code', 'dish', 'returnedBy', 'returnDate', 'returnTime', 'user', 'company', 'customer']);
        downloadCSV(csvData, 'return_data.csv');
        showMessage('✅ Return data exported', 'success');
    } catch (error) {
        console.error('❌ exportReturnData error:', error);
        showMessage('❌ Export error', 'error');
    }
}

function convertToCSV(data, fields) {
    try {
        const headers = fields.join(',');
        const rows = data.map(item => fields.map(field => `"${item[field] || ''}"`).join(','));
        return [headers, ...rows].join('\n');
    } catch (error) {
        console.error('❌ convertToCSV error:', error);
        return '';
    }
}

function downloadCSV(csvData, filename) {
    try {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('❌ downloadCSV error:', error);
        showMessage('❌ Download error', 'error');
    }
}

// ========== UTILITY FUNCTIONS ==========
function updateDisplay() {
    try {
        // Update button states
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const userDropdown = document.getElementById('userDropdown');
        const dishDropdown = document.getElementById('dishDropdown');
        const input = document.getElementById('progloveInput');
        const scanSection = document.getElementById('scanSection');
        
        if (userDropdown) userDropdown.disabled = false;
        if (dishDropdown) dishDropdown.disabled = false;
        
        let canScan = window.appData.user && !window.appData.scanning;
        if (window.appData.mode === 'kitchen') canScan = canScan && window.appData.dishLetter;
        
        if (startBtn) startBtn.disabled = !canScan;
        if (stopBtn) stopBtn.disabled = !window.appData.scanning;
        
        if (input) {
            if (window.appData.scanning) {
                input.placeholder = "Scan VYT code...";
                input.disabled = false;
                if (scanSection) scanSection.classList.add('scanning-active');
            } else {
                input.placeholder = "Click START SCANNING...";
                input.disabled = true;
                if (scanSection) scanSection.classList.remove('scanning-active');
            }
        }
        
        // Update statistics
        const today = getStandardizedDate();
        const userTodayScans = window.appData.myScans.filter(scan => 
            scan.user === window.appData.user && getStandardizedDate(scan.timestamp) === today).length;
        const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
        const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
        
        const activeCount = document.getElementById('activeCount');
        const prepCount = document.getElementById('prepCount');
        const myScansCount = document.getElementById('myScansCount');
        const exportInfo = document.getElementById('exportInfo');
        
        if (activeCount) activeCount.textContent = window.appData.activeBowls.length;
        if (prepCount) prepCount.textContent = window.appData.mode === 'kitchen' ? preparedToday : returnedToday;
        if (myScansCount) myScansCount.textContent = userTodayScans;
        if (exportInfo) exportInfo.innerHTML = 
            `<strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} | Prepared: ${preparedToday} | Returns: ${returnedToday}`;
            
    } catch (error) {
        console.error('❌ updateDisplay error:', error);
    }
}

function updateOvernightStats() {
    try {
        const statsBody = document.getElementById('overnightStatsBody');
        const cycleInfo = document.getElementById('cycleInfo');
        if (!statsBody || !cycleInfo) return;
        
        const now = new Date();
        const currentHour = now.getHours();
        let cycleStart, cycleEnd, cycleText;
        
        if (currentHour >= 22 || currentHour < 10) {
            cycleStart = new Date(now); 
            if (currentHour < 10) cycleStart.setDate(cycleStart.getDate() - 1);
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
        
        let html = '';
        if (statsArray.length === 0) {
            html = '<tr><td colspan="5" style="text-align: center;">No overnight scans</td></tr>';
        } else {
            statsArray.forEach(stat => {
                const startTime = stat.startTime ? new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                const endTime = stat.endTime ? new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                html += `<tr><td class="dish-header">${stat.dish}</td><td>${stat.user}</td><td>${stat.count}</td><td>${startTime}</td><td>${endTime}</td></tr>`;
            });
        }
        statsBody.innerHTML = html;
    } catch (error) {
        console.error('❌ updateOvernightStats error:', error);
    }
}

function saveToStorage() {
    try {
        localStorage.setItem('proglove_data', JSON.stringify(window.appData));
    } catch (error) {
        console.error('❌ saveToStorage error:', error);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            const data = JSON.parse(saved);
            window.appData = { ...window.appData, ...data };
        }
    } catch (error) {
        console.error('❌ loadFromStorage error:', error);
    }
}

function showMessage(text, type) {
    try {
        const element = document.getElementById('feedback');
        if (element) {
            element.textContent = text;
            element.className = 'feedback ' + type;
        }
    } catch (error) {
        console.error('❌ showMessage error:', error);
    }
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
window.debugSystem = debugSystem;
window.validateSystem = validateSystem;
