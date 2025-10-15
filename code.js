// ProGlove Scanner - Complete System (Firebase Cloud Sync)
window.appData = {
    mode: null, user: null, dishLetter: null, scanning: false,
    myScans: [], activeBowls: [], preparedBowls: [], returnedBowls: [],
    scanHistory: [], customerData: [], dishTimes: {},
    lastActivity: Date.now(), lastCleanup: null, lastSync: null
};

const USERS = [
    {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
    {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
];

function getStandardizedDate() {
    return new Date().toISOString().split('T')[0];
}

function isKitchenTime() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 10;
}

// Initialize Firebase and load data
function initializeFirebase() {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded');
            throw new Error('Firebase SDK not loaded');
        }

        const firebaseConfig = {
            apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
            authDomain: "proglove-scanner.firebaseapp.com",
            databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "proglove-scanner",
            storageBucket: "proglove-scanner.firebasestorage.app",
            messagingSenderId: "177575768177",
            appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        console.log('✅ Firebase initialized successfully');
        // Load data from Firebase
        loadFromFirebase();
        
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        // Fallback to localStorage
        loadFromStorage();
        initializeUI();
        showMessage('⚠️ Using local storage (Firebase failed)', 'warning');
        document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
    }
}

// Load data from Firebase (PRIMARY)
function loadFromFirebase() {
    try {
        const db = firebase.database();
        const appDataRef = db.ref('progloveData');
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            console.log('Firebase connection timeout');
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Offline mode - Cloud connection failed', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Connection Timeout';
        }, 10000);

        appDataRef.on('value', (snapshot) => {
            clearTimeout(connectionTimeout);
            
            if (snapshot.exists()) {
                const firebaseData = snapshot.val();
                window.appData = { ...window.appData, ...firebaseData };
                console.log('✅ Data loaded from Firebase');
                showMessage('✅ Connected to Cloud • Real-time sync active', 'success');
                document.getElementById('systemStatus').textContent = '✅ Cloud Connected • Real-time Sync';
                document.getElementById('backupStatus').textContent = '💾 Cloud sync active';
            } else {
                // No data in Firebase, try localStorage
                loadFromStorage();
                showMessage('✅ Cloud connected (no data yet)', 'info');
                document.getElementById('systemStatus').textContent = '✅ Cloud Connected • No Data Yet';
            }
            initializeUI();
        }, (error) => {
            clearTimeout(connectionTimeout);
            console.error('Firebase load error:', error);
            // Fallback to localStorage
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Load Error';
        });
    } catch (error) {
        console.error('Firebase error:', error);
        loadFromStorage();
        initializeUI();
    }
}

// Initialize UI after data is loaded
function initializeUI() {
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyResetTimer();
    
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
}

// Sync to Firebase (PRIMARY storage)
function syncToFirebase() {
    try {
        const db = firebase.database();
        const backupData = {
            activeBowls: [...window.appData.activeBowls],
            preparedBowls: [...window.appData.preparedBowls],
            returnedBowls: [...window.appData.returnedBowls],
            myScans: [...window.appData.myScans],
            scanHistory: [...window.appData.scanHistory],
            customerData: [...window.appData.customerData],
            dishTimes: {...window.appData.dishTimes},
            lastCleanup: window.appData.lastCleanup,
            lastSync: new Date().toISOString()
        };
        
        db.ref('progloveData').set(backupData)
            .then(() => {
                window.appData.lastSync = new Date().toISOString();
                console.log('✅ Data synced to Firebase');
            })
            .catch((error) => {
                console.error('Firebase sync failed:', error);
                // Save to localStorage as backup
                saveToStorage();
            });
    } catch (error) {
        console.error('Sync error:', error);
        saveToStorage();
    }
}

// Load from Firebase manually
function loadFromFirebaseManual() {
    showMessage('🔄 Loading from cloud...', 'info');
    loadFromFirebase();
}

// localStorage is now only a BACKUP
function saveToStorage() {
    try {
        localStorage.setItem('proglove_data', JSON.stringify(window.appData));
    } catch (error) {
        console.error('Local storage save failed:', error);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            window.appData = { ...window.appData, ...parsed };
            console.log('📁 Data loaded from local storage (backup)');
        }
    } catch (error) {
        console.error('Local storage load failed:', error);
        // Initialize empty arrays if everything fails
        initializeDataArrays();
    }
}

function initializeDataArrays() {
    // Ensure all arrays exist
    if (!window.appData.myScans) window.appData.myScans = [];
    if (!window.appData.activeBowls) window.appData.activeBowls = [];
    if (!window.appData.preparedBowls) window.appData.preparedBowls = [];
    if (!window.appData.returnedBowls) window.appData.returnedBowls = [];
    if (!window.appData.scanHistory) window.appData.scanHistory = [];
    if (!window.appData.customerData) window.appData.customerData = [];
    if (!window.appData.dishTimes) window.appData.dishTimes = {};
}

// Load Firebase SDK dynamically
function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        // Check if Firebase is already loaded
        if (typeof firebase !== 'undefined') {
            console.log('Firebase already loaded');
            resolve();
            return;
        }

        // Load Firebase App
        const scriptApp = document.createElement('script');
        scriptApp.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        scriptApp.onload = function() {
            console.log('Firebase App loaded');
            // Load Firebase Database
            const scriptDatabase = document.createElement('script');
            scriptDatabase.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
            scriptDatabase.onload = function() {
                console.log('Firebase Database loaded');
                resolve();
            };
            scriptDatabase.onerror = function() {
                reject(new Error('Failed to load Firebase Database'));
            };
            document.head.appendChild(scriptDatabase);
        };
        scriptApp.onerror = function() {
            reject(new Error('Failed to load Firebase App'));
        };
        document.head.appendChild(scriptApp);
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Scanner System Starting...');
    
    // Load Firebase SDK first, then initialize
    loadFirebaseSDK()
        .then(() => {
            console.log('✅ Firebase SDK loaded successfully');
            initializeFirebase();
        })
        .catch((error) => {
            console.error('❌ Failed to load Firebase SDK:', error);
            // Fallback to local storage
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage (Firebase SDK failed to load)', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
        });
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    const input = e.target;
    const scanValue = input.value.trim();
    
    if (scanValue.includes('vyt') || scanValue.includes('VYT')) {
        input.value = '';
        if (!window.appData.user) {
            showMessage('❌ Select user first', 'error');
            return;
        }
        if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
            showMessage('❌ Select dish letter first', 'error');
            return;
        }
        processScan(scanValue);
    }
    updateLastActivity();
}

function initializeUsers() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
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
    showMessage(`📱 ${mode.toUpperCase()} mode - Cloud Sync`, 'info');
}

function updateStatsLabels() {
    const label = document.getElementById('prepLabel');
    if (label) label.textContent = window.appData.mode === 'kitchen' ? 'Prepared Today' : 'Returned Today';
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    const users = window.appData.mode === 'kitchen' ? 
        USERS.filter(u => u.role === 'Kitchen') : 
        USERS.filter(u => u.role === 'Return');
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    window.appData.user = dropdown.value;
    if (window.appData.user) {
        showMessage(`✅ ${window.appData.user} selected`, 'success');
        if (window.appData.mode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            loadDishLetters();
        }
    }
    updateDisplay();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Select Dish Letter --</option>';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split('').forEach(char => {
        const option = document.createElement('option');
        option.value = char;
        option.textContent = char;
        dropdown.appendChild(option);
    });
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    
    window.appData.dishLetter = dropdown.value;
    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter}`, 'success');
    }
    updateDisplay();
}

function startScanning() {
    if (!window.appData.user) {
        showMessage('❌ Select user first', 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage('❌ Select dish letter first', 'error');
        return;
    }
    window.appData.scanning = true;
    updateDisplay();
    document.getElementById('progloveInput').focus();
    showMessage(`🎯 SCANNING ACTIVE - Cloud Sync`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    showMessage(`⏹ Scanning stopped`, 'info');
}

function processScan(code) {
    let result;
    let actualMode = window.appData.mode;
    if (isKitchenTime()) actualMode = 'kitchen';
    
    try {
        result = actualMode === 'kitchen' ? kitchenScan(code) : returnScan(code);
    } catch (error) {
        result = { message: "System error", type: "error", responseTime: 0 };
    }
    
    document.getElementById('responseTimeValue').textContent = result.responseTime + 'ms';
    showMessage(result.message, result.type);
    
    if (result.type === 'error') {
        const input = document.getElementById('progloveInput');
        input.classList.add('error');
        setTimeout(() => input.classList.remove('error'), 2000);
    }
    
    updateDisplay();
    updateOvernightStats();
    syncToFirebase(); // PRIMARY SYNC
    return result;
}

function kitchenScan(code) {
    const startTime = Date.now();
    const today = getStandardizedDate();
    
    // Check if already prepared today
    if (window.appData.preparedBowls.some(bowl => bowl.code === code && bowl.date === today)) {
        return { message: "❌ Already prepared: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    let sourceBowl = null;
    let sourceType = '';
    
    // FIRST check in activeBowls (this is where bowls should come from)
    const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === code);
    if (activeIndex !== -1) {
        sourceBowl = window.appData.activeBowls[activeIndex];
        sourceType = 'active';
        // REMOVE from activeBowls
        window.appData.activeBowls.splice(activeIndex, 1);
    }
    // If not in active, check if it exists in prepared (shouldn't happen but as fallback)
    else {
        const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === code);
        if (preparedIndex !== -1) {
            return { message: "❌ Already prepared: " + code, type: "error", responseTime: Date.now() - startTime };
        }
    }
    
    // Create new prepared bowl - REMOVE company and customer details if coming from active
    const newBowl = {
        code: code, 
        dish: window.appData.dishLetter || "AUTO", 
        user: window.appData.user,
        // If bowl was in active, clear company/customer details. Otherwise keep empty.
        company: sourceType === 'active' ? "" : "Unknown",
        customer: sourceType === 'active' ? "" : "Unknown", 
        date: today,
        time: new Date().toLocaleTimeString(), 
        timestamp: new Date().toISOString(), 
        status: 'PREPARED',
        source: sourceType // Track where it came from
    };
    
    window.appData.preparedBowls.push(newBowl);
    window.appData.myScans.push({
        type: 'kitchen', 
        code: code, 
        dish: window.appData.dishLetter, 
        user: window.appData.user, 
        timestamp: new Date().toISOString()
    });
    
    updateDishTimes(window.appData.dishLetter, window.appData.user);
    
    const message = sourceType === 'active' ? 
        `✅ ${window.appData.dishLetter} Prepared: ${code} (from active - details cleared)` : 
        `✅ ${window.appData.dishLetter} Prepared: ${code} (new bowl)`;
    
    return { message: message, type: "success", responseTime: Date.now() - startTime };
}

function returnScan(code) {
    const startTime = Date.now();
    const today = getStandardizedDate();
    
    if (!window.appData.user) {
        return { message: "❌ Select user first", type: "error", responseTime: Date.now() - startTime };
    }
    
    if (window.appData.returnedBowls.some(bowl => bowl.code === code && bowl.returnDate === today)) {
        return { message: "❌ Already returned: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    let sourceBowl = null;
    let sourceType = '';
    const activeBefore = window.appData.activeBowls.length;
    
    // FIRST check in activeBowls (this is where bowls should be returned from)
    const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === code);
    if (activeIndex !== -1) {
        sourceBowl = window.appData.activeBowls[activeIndex];
        sourceType = 'active';
        // REMOVE from activeBowls - THIS IS THE KEY FIX
        window.appData.activeBowls.splice(activeIndex, 1);
    }
    // THEN check in preparedBowls (as fallback)
    else {
        const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === code);
        if (preparedIndex !== -1) {
            sourceBowl = window.appData.preparedBowls[preparedIndex];
            sourceType = 'prepared';
            window.appData.preparedBowls.splice(preparedIndex, 1);
        }
    }
    
    if (!sourceBowl) {
        return { message: "❌ Bowl not found: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    const returnedBowl = {
        ...sourceBowl, 
        returnedBy: window.appData.user, 
        returnDate: today,
        returnTime: new Date().toLocaleTimeString(), 
        returnTimestamp: new Date().toISOString(), 
        status: 'RETURNED', 
        source: sourceType
    };
    
    window.appData.returnedBowls.push(returnedBowl);
    window.appData.myScans.push({
        type: 'return', 
        code: code, 
        user: window.appData.user, 
        timestamp: new Date().toISOString()
    });
    
    const activeAfter = window.appData.activeBowls.length;
    const countChange = sourceType === 'active' ? ` (Active: ${activeBefore} → ${activeAfter})` : ' (From Prepared)';
    
    return { 
        message: `✅ Returned: ${code}${countChange}`, 
        type: "success", 
        responseTime: Date.now() - startTime 
    };
}

function updateDishTimes(dishLetter, user) {
    const timeKey = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (!window.appData.dishTimes[dishLetter]) {
        window.appData.dishTimes[dishLetter] = {firstScan: timeKey, lastScan: timeKey, users: [user], count: 1};
    } else {
        window.appData.dishTimes[dishLetter].lastScan = timeKey;
        if (!window.appData.dishTimes[dishLetter].users.includes(user)) {
            window.appData.dishTimes[dishLetter].users.push(user);
        }
        window.appData.dishTimes[dishLetter].count++;
    }
}

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
    
    const overnightPrepared = window.appData.preparedBowls.filter(bowl => {
        const hour = new Date(bowl.timestamp).getHours();
        return hour >= 22 || hour < 10;
    });
    
    overnightPrepared.forEach(bowl => {
        window.appData.activeBowls.push({...bowl, status: 'ACTIVE', preparedTimestamp: bowl.timestamp, timestamp: new Date().toISOString()});
    });
    
    window.appData.lastCleanup = today;
    syncToFirebase();
    updateDisplay();
    showMessage('✅ Daily reset - Cloud Sync', 'success');
}

function updateDisplay() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const input = document.getElementById('progloveInput');
    const scanSection = document.getElementById('scanSection');
    
    const canScan = window.appData.user && !window.appData.scanning && 
                   (window.appData.mode !== 'kitchen' || window.appData.dishLetter);
    
    if (startBtn) startBtn.disabled = !canScan;
    if (stopBtn) stopBtn.disabled = !window.appData.scanning;
    
    if (input) {
        input.placeholder = window.appData.scanning ? "Scan VYT code..." : "Click START SCANNING...";
        input.disabled = !window.appData.scanning;
        if (scanSection) {
            scanSection.classList.toggle('scanning-active', window.appData.scanning);
        }
    }
    
    const today = getStandardizedDate();
    const userScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && getStandardizedDate(scan.timestamp) === today).length;
    const prepared = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returned = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
    
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;
    document.getElementById('prepCount').textContent = window.appData.mode === 'kitchen' ? prepared : returned;
    document.getElementById('myScansCount').textContent = userScans;
    document.getElementById('exportInfo').innerHTML = 
        `<strong>Data:</strong> Active: ${window.appData.activeBowls.length} | Prepared: ${prepared} | Returns: ${returned}`;
}

function updateOvernightStats() {
    try {
        const statsBody = document.getElementById('overnightStatsBody');
        const cycleInfo = document.getElementById('cycleInfo');
        if (!statsBody || !cycleInfo) return;
        
        const now = new Date();
        const hour = now.getHours();
        let cycleStart, cycleEnd, cycleText;
        
        if (hour >= 22 || hour < 10) {
            cycleStart = new Date(now); 
            if (hour < 10) cycleStart.setDate(cycleStart.getDate() - 1);
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
        
        const overnightScans = (window.appData.myScans || []).filter(scan => {
            if (!scan || !scan.timestamp) return false;
            try {
                const scanTime = new Date(scan.timestamp);
                return scanTime >= cycleStart && scanTime <= cycleEnd;
            } catch (error) {
                return false;
            }
        });
        
        const dishStats = {};
        overnightScans.forEach(scan => {
            const dish = (scan.dish || "Unknown");
            const user = (scan.user || "Unknown");
            const key = `${dish}-${user}`;
            
            if (!dishStats[key]) {
                dishStats[key] = { 
                    dish: dish, 
                    user: user, 
                    count: 0, 
                    startTime: null, 
                    endTime: null 
                };
            }
            
            dishStats[key].count++;
            
            try {
                const scanTime = new Date(scan.timestamp);
                if (!dishStats[key].startTime || scanTime < new Date(dishStats[key].startTime)) {
                    dishStats[key].startTime = scan.timestamp;
                }
                if (!dishStats[key].endTime || scanTime > new Date(dishStats[key].endTime)) {
                    dishStats[key].endTime = scan.timestamp;
                }
            } catch (error) {
                // Skip time processing if date is invalid
            }
        });
        
        const statsArray = Object.values(dishStats).sort((a, b) => {
            const dishA = a.dish || "Unknown";
            const dishB = b.dish || "Unknown";
            if (dishA !== dishB) return String(dishA).localeCompare(String(dishB));
            
            const timeA = a.startTime ? new Date(a.startTime) : new Date(0);
            const timeB = b.startTime ? new Date(b.startTime) : new Date(0);
            return timeA - timeB;
        });
        
        let html = statsArray.length === 0 ? 
            '<tr><td colspan="5" style="text-align: center;">No overnight scans</td></tr>' :
            statsArray.map(stat => {
                const start = stat.startTime ? 
                    new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                const end = stat.endTime ? 
                    new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                return `<tr>
                    <td class="dish-header">${stat.dish}</td>
                    <td>${stat.user}</td>
                    <td>${stat.count}</td>
                    <td>${start}</td>
                    <td>${end}</td>
                </tr>`;
            }).join('');
        
        statsBody.innerHTML = html;
    } catch (error) {
        console.error('Error in updateOvernightStats:', error);
    }
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    if (element) {
        element.textContent = text;
        element.className = 'feedback ' + type;
    }
}

// JSON IMPORT FUNCTIONS - FOR YOUR SPECIFIC JSON STRUCTURE
function processJsonData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonStatus = document.getElementById('jsonStatus');
    const patchResults = document.getElementById('patchResults');
    const patchSummary = document.getElementById('patchSummary');
    const failedMatches = document.getElementById('failedMatches');
    
    if (!jsonTextarea || !jsonTextarea.value.trim()) {
        showMessage('❌ No JSON data to process', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonTextarea.value.trim());
        const results = patchCustomerData(jsonData);
        
        // Update JSON status
        jsonStatus.innerHTML = `<strong>JSON Status:</strong> Processed ${results.total} VYT codes`;
        
        // Show patch results
        patchResults.style.display = 'block';
        patchSummary.innerHTML = `
            ✅ ${results.matched} bowls updated | 
            ❌ ${results.failed} failed matches |
            🆕 ${results.created} new bowls created
        `;
        
        // Show failed matches
        if (results.failedCodes.length > 0) {
            failedMatches.innerHTML = `
                <strong>No matching bowls found for:</strong> ${results.failedCodes.slice(0, 10).join(', ')}${results.failedCodes.length > 10 ? '...' : ''}
            `;
        } else {
            failedMatches.innerHTML = '';
        }
        
        if (results.matched > 0 || results.created > 0) {
            showMessage(`✅ Updated ${results.matched} bowls + Created ${results.created} new bowls`, 'success');
            saveToStorage();
            syncToFirebase();
        } else {
            showMessage('❌ No VYT codes found in JSON data', 'error');
        }
        
    } catch (error) {
        showMessage('❌ Invalid JSON format: ' + error.message, 'error');
        jsonStatus.innerHTML = `<strong>JSON Status:</strong> Invalid JSON format`;
    }
}

function patchCustomerData(jsonData) {
    let matched = 0;
    let failed = 0;
    let created = 0;
    let total = 0;
    const failedCodes = [];
    
    // Extract all VYT codes from your complex JSON structure
    const vytCodes = [];
    
    if (jsonData.boxes && Array.isArray(jsonData.boxes)) {
        jsonData.boxes.forEach(box => {
            if (box.dishes && Array.isArray(box.dishes)) {
                box.dishes.forEach(dish => {
                    if (dish.bowlCodes && Array.isArray(dish.bowlCodes)) {
                        dish.bowlCodes.forEach(bowlCode => {
                            if (bowlCode && bowlCode.trim()) {
                                vytCodes.push({
                                    code: bowlCode.trim().toUpperCase(),
                                    company: jsonData.name || "Unknown Company",
                                    customer: dish.name || "Unknown Dish",
                                    dish: dish.label || "Unknown",
                                    boxType: box.type || "Unknown"
                                });
                            }
                        });
                    }
                });
            }
        });
    }
    
    total = vytCodes.length;
    
    vytCodes.forEach(item => {
        const vytCodeUrl = item.code;
        const company = item.company;
        const customer = item.customer;
        const dish = item.dish;
        
        if (!vytCodeUrl) {
            failed++;
            failedCodes.push('Empty VYT code');
            return;
        }
        
        // Search in active bowls - EXACT URL MATCH
        let bowlFound = false;
        
        // Check active bowls first - exact URL match
        const activeIndex = window.appData.activeBowls.findIndex(bowl => 
            bowl.code === vytCodeUrl
        );
        
        if (activeIndex !== -1) {
            // Update existing bowl
            window.appData.activeBowls[activeIndex] = {
                ...window.appData.activeBowls[activeIndex],
                company: company || window.appData.activeBowls[activeIndex].company,
                customer: customer || window.appData.activeBowls[activeIndex].customer,
                dish: dish || window.appData.activeBowls[activeIndex].dish
            };
            bowlFound = true;
            matched++;
        } 
        // Check prepared bowls
        else {
            const preparedIndex = window.appData.preparedBowls.findIndex(bowl => 
                bowl.code === vytCodeUrl
            );
            
            if (preparedIndex !== -1) {
                window.appData.preparedBowls[preparedIndex] = {
                    ...window.appData.preparedBowls[preparedIndex],
                    company: company || window.appData.preparedBowls[preparedIndex].company,
                    customer: customer || window.appData.preparedBowls[preparedIndex].customer,
                    dish: dish || window.appData.preparedBowls[preparedIndex].dish
                };
                bowlFound = true;
                matched++;
            }
        }
        
        if (!bowlFound) {
            // Create new bowl if not found
            const newBowl = {
                code: vytCodeUrl,
                company: company || "Unknown Company",
                customer: customer || "Unknown Customer", 
                dish: dish || "Unknown",
                status: 'ACTIVE',
                timestamp: new Date().toISOString(),
                date: getStandardizedDate(),
                source: 'json_import'
            };
            
            window.appData.activeBowls.push(newBowl);
            created++;
        }
    });
    
    return {
        matched,
        failed,
        created,
        total,
        failedCodes
    };
}

// Export functions
function exportActiveBowls() {
    try {
        const dataStr = JSON.stringify(window.appData.activeBowls, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `active-bowls-${getStandardizedDate()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showMessage('✅ Active bowls exported', 'success');
    } catch (error) {
        showMessage('❌ Export failed', 'error');
    }
}

function exportReturnData() {
    try {
        const dataStr = JSON.stringify(window.appData.returnedBowls, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `return-data-${getStandardizedDate()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showMessage('✅ Return data exported', 'success');
    } catch (error) {
        showMessage('❌ Export failed', 'error');
    }
}

function exportAllData() {
    try {
        const dataStr = JSON.stringify(window.appData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `proglove-data-${getStandardizedDate()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showMessage('✅ All data exported', 'success');
    } catch (error) {
        showMessage('❌ Export failed', 'error');
    }
}

// Global functions
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.exportActiveBowls = exportActiveBowls;
window.exportReturnData = exportReturnData;
window.exportAllData = exportAllData;
window.processJsonData = processJsonData;
window.loadFromFirebaseManual = loadFromFirebaseManual;
window.syncToFirebase = syncToFirebase;
