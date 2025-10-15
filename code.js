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

// Start the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Scanner System Starting...');
    // Load Firebase SDK first, then initialize
    if (typeof firebase === 'undefined') {
        console.log('Firebase not loaded, loading script...');
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        script.onload = function() {
            const authScript = document.createElement('script');
            authScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
            authScript.onload = initializeFirebase;
            document.head.appendChild(authScript);
        };
        document.head.appendChild(script);
    } else {
        initializeFirebase();
    }
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
        `✅ ${window.appData.dishLetter} Prepared: ${code} (from active)` : 
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

// ... rest of your existing functions (startDailyResetTimer, resetDailyStatistics, updateDisplay, etc.) remain the same ...

// Start the application - UPDATED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Scanner System Starting...');
    // Load Firebase SDK first, then initialize
    if (typeof firebase === 'undefined') {
        console.log('Firebase not loaded, loading script...');
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        script.onload = function() {
            const authScript = document.createElement('script');
            authScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
            authScript.onload = initializeFirebase;
            document.head.appendChild(authScript);
        };
        document.head.appendChild(script);
    } else {
        initializeFirebase();
    }
});
