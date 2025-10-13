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

const USERS = [
    {name: "Hamid", role: "Kitchen"},
    {name: "Richa", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"},
    {name: "Jash", role: "Kitchen"},
    {name: "Joel", role: "Kitchen"},
    {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"},
    {name: "M.Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"},
    {name: "Alan", role: "Return"},
    {name: "Aadesh", role: "Return"},
    {name: "Kitchen Team", role: "Return"}
];

// Initialize System
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Complete Scanner System...');
    initializeFirebase();
    loadFromStorage();
    initializeUsers();
    updateDisplay();
    updateSheets();
    updateOvernightStats();
    startDailyCleanupTimer();
    
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

// JSON Upload and Customer Data Processing
function processJSONFile() {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('❌ Please select a JSON file first', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            processCustomerData(jsonData);
        } catch (error) {
            showMessage('❌ Invalid JSON file format', 'error');
            console.error('JSON parse error:', error);
        }
    };
    reader.readAsText(file);
}

function processCustomerData(jsonData) {
    try {
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
    
    updateSheets();
}

// Color Coding System for Overdue Returns
function getOverdueColor(deliveryDate) {
    const delivery = new Date(deliveryDate);
    const today = new Date();
    const diffDays = Math.floor((today - delivery) / (1000 * 60 * 60 * 24));
    
    // Skip weekends in calculation
    let businessDays = 0;
    let currentDate = new Date(delivery);
    
    while (currentDate <= today) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
            businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Wednesday delivery color coding
    if (businessDays === 1) return 'yellow-bg';    // Thursday
    if (businessDays === 2) return 'pink-bg';      // Friday
    if (businessDays === 3) return 'orange-bg';    // Monday
    if (businessDays >= 4) return 'red-bg';        // Tuesday+
    
    return ''; // Not overdue
}

function getCustomerNameColor(dish, customer) {
    const dishCustomers = window.appData.customerData.filter(c => c.dish === dish);
    if (dishCustomers.length === 1) {
        return 'green-text';
    } else if (dishCustomers.length > 1) {
        return 'red-text';
    }
    return '';
}

// Daily Cleanup Timer (7PM Return Sheet Clear)
function startDailyCleanupTimer() {
    // Check every minute if it's 7PM
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            clearReturnSheet();
        }
    }, 60000);
}

function clearReturnSheet() {
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
    
    showMessage('✅ Return sheet cleared for new day - reusable bowls ready', 'success');
    updateSheets();
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
        usersToShow = USERS.filter(user => user.role === 'Return' || user.name === "Kitchen Team");
    }
    
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name + (user.role ? ` (${user.role})` : '');
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
    updateSheets();
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
        status: 'ACTIVE',
        deliveryDate: today // Track delivery date for overdue calculation
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
        message: `✅ ${window.appData.dishLetter} Prepared: ${fullCode} - Now ACTIVE for returns`, 
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
    
    const preparedBowlIndex = window.appData.preparedBowls.findIndex(bowl => 
        bowl.code === fullCode && bowl.date === today
    );
    if (preparedBowlIndex !== -1) {
        window.appData.preparedBowls.splice(preparedBowlIndex, 1);
    }
    
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
        message: `✅ Returned: ${fullCode} - Removed from active bowls`, 
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

// Sheet Management
function updateSheets() {
    updateActiveSheet();
    updateReturnSheet();
}

function updateActiveSheet() {
    const activeBody = document.getElementById('activeSheetBody');
    const activeCount = document.getElementById('activeBowlsCount');
    
    activeCount.textContent = window.appData.activeBowls.length;
    
    if (window.appData.activeBowls.length === 0) {
        activeBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No active bowls</td></tr>';
        return;
    }
    
    let html = '';
    window.appData.activeBowls.forEach(bowl => {
        const overdueColor = getOverdueColor(bowl.deliveryDate || bowl.date);
        const customerColor = getCustomerNameColor(bowl.dish, bowl.customer);
        
        html += `
            <tr class="${overdueColor}">
                <td>${bowl.code}</td>
                <td>${bowl.dish}</td>
                <td>${bowl.company}</td>
                <td class="${customerColor}">${bowl.customer}</td>
                <td>${bowl.user}</td>
                <td>${bowl.status}</td>
            </tr>
        `;
    });
    
    activeBody.innerHTML = html;
}

function updateReturnSheet() {
    const returnBody = document.getElementById('returnSheetBody');
    const returnsCount = document.getElementById('returnsCount');
    const today = new Date().toLocaleDateString('en-GB');
    
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    returnsCount.textContent = todayReturns.length;
    
    if (todayReturns.length === 0) {
        returnBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No returns today</td></tr>';
        return;
    }
    
    let html = '';
    todayReturns.forEach(bowl => {
        html += `
            <tr>
                <td>${bowl.code}</td>
                <td>${bowl.dish}</td>
                <td>${bowl.company}</td>
                <td>${bowl.customer}</td>
                <td>${bowl.returnedBy}</td>
                <td>${bowl.returnTime}</td>
            </tr>
        `;
    });
    
    returnBody.innerHTML = html;
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
    
    document.getElementById('localDataInfo').innerHTML = `
        <strong>Current Data:</strong> 
        ${window.appData.activeBowls.length} active bowls • 
        ${preparedToday} prepared today • 
        ${returnedToday} returned today •
        ${window.appData.myScans.length} total scans
    `;
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// Backup Functions
async function forceBackupNow() {
    const btn = document.getElementById('forceBackupBtn');
    btn.disabled = true;
    btn.textContent = "🔄 BACKING UP...";
    
    try {
        await syncToFirebase();
        showMessage('✅ Manual backup completed successfully!', 'success');
    } catch (error) {
        showMessage('❌ Manual backup failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = "🔥 BACKUP NOW";
    }
}

// Make functions globally available
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.processJSONFile = processJSONFile;
window.forceBackupNow = forceBackupNow;
window.loadFromFirebase = loadFromFirebase;
