// --- GLOBAL STATE ---
var appData = {
    mode: null,              
    user: null,               
    dishLetter: null,         
    scanning: false,          

    // Core data structures (Synced with Firebase)
    myScans: [],              
    activeBowls: [],          
    preparedBowls: [],        
    returnedBowls: [],        

    // Internal state
    db: null,
    refActive: null,         
    refPrepared: null,       
    refReturned: null,       
    refScans: null,          

    lastDataReset: null, 
    lastSync: null,
    isDomReady: false, 
    isInitialized: false, 
    scanTimer: null,
    isProcessingScan: false,
};
window.appData = appData;

// --- DATA CONSTANTS (Isolated for Safety) ---
const CONSTANTS = (function() {
    const USERS = [
        {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
        {name: "Jash", role: "Kitchen"}, {name: "Joel", role: "Kitchen"}, 
        {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"}, 
        {name: "Sreekanth", role: "Kitchen"}, 
        {name: "Sultan", role: "Return"}, 
        {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"}, 
        {name: "Adesh", role: "Return"}
    ];
    const DISH_LETTERS = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '1', '2', '3', '4' 
    ];
    return { USERS, DISH_LETTERS };
})();

// --- UTILITY FUNCTIONS ---
function formatDateStandard(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

function getReportingDayTimestamp() {
    const now = new Date();
    const cutoffHour = 22; 
    let startOfReportingDay = new Date(now);
    let endOfReportingDay = new Date(now);
    if (now.getHours() < cutoffHour) {
        startOfReportingDay.setDate(now.getDate() - 1); 
    }
    startOfReportingDay.setHours(cutoffHour, 0, 0, 0);
    endOfReportingDay.setHours(cutoffHour, 0, 0, 0);
    if (startOfReportingDay >= endOfReportingDay) {
        endOfReportingDay.setDate(endOfReportingDay.getDate() + 1);
    }
    return { start: startOfReportingDay.toISOString(), end: endOfReportingDay.toISOString() };
}

function showMessage(message, type = 'info', duration = 3000) {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;

    const msgElement = document.createElement('div');
    let colorClass = 'bg-blue-900 text-blue-200 border-blue-700';
    if (type === 'success') colorClass = 'bg-green-900 text-green-200 border-green-700';
    else if (type === 'error') colorClass = 'bg-red-900 text-red-200 border-red-700';
    else if (type === 'warning') colorClass = 'bg-orange-900 text-orange-200 border-orange-700';
    msgElement.className = `p-3 rounded-lg shadow-xl text-center text-sm mb-2 transition-all duration-300 border ${colorClass}`;
    msgElement.innerHTML = message;

    messageContainer.prepend(msgElement);
    setTimeout(() => {
        msgElement.style.opacity = '0';
        msgElement.style.maxHeight = '0';
        msgElement.style.padding = '0';
        setTimeout(() => msgElement.remove(), 500);
    }, duration);
}

function showScanError(message) {
    const scanInput = document.getElementById('scanInput');
    if (!scanInput) return;

    scanInput.placeholder = message;
    scanInput.classList.add('scanning-error');

    setTimeout(() => {
        scanInput.classList.remove('scanning-error');
        const isReadyToScan = appData.mode && appData.user && (appData.mode === 'return' || appData.dishLetter);

        if (!appData.scanning) {
            scanInput.placeholder = "Scanner stopped.";
        } else if (isReadyToScan) {
            scanInput.placeholder = `Ready to Scan in ${appData.mode.toUpperCase()} Mode...`;
        } else {
            scanInput.placeholder = 'Select User and Press START...';
        }
    }, 4000);
}

// --- FIREBASE SETUP & SYNC ---
function initializeFirebase() {
    try {
        const HARDCODED_FIREBASE_CONFIG = {
            apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
            authDomain: "proglove-scanner.firebaseapp.com",
            databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "proglove-scanner",
            messagingSenderId: "177575768177",
            appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0",
        };
        const firebaseConfig = HARDCODED_FIREBASE_CONFIG; 

        const appId = firebaseConfig.projectId;
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            return;
        }

        const app = firebase.initializeApp(firebaseConfig);
        appData.db = firebase.database();
        const basePath = `artifacts/${appId}/public/data/`;
        appData.refActive = firebase.database().ref(`${basePath}active_bowls`);
        appData.refPrepared = firebase.database().ref(`${basePath}prepared_bowls`);
        appData.refReturned = firebase.database().ref(`${basePath}returned_bowls`);
        appData.refScans = firebase.database().ref(`${basePath}scan_logs`);

        ensureDatabaseInitialized(appData.refActive);

        showMessage("✅ Application initialized. Please select a mode.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ ERROR: Firebase failed to initialize.", 'error');
    }
}

async function ensureDatabaseInitialized(ref) {
    try {
        const snapshot = await ref.once('value');
        if (!snapshot.exists() || snapshot.val() === null) {
            await appData.refActive.set([]); 
            await appData.refPrepared.set([]); 
            await appData.refReturned.set([]);
            await appData.refScans.set([]);
        }
        appData.isInitialized = true;
        loadFromFirebase();
    } catch (error) {
        console.error("CRITICAL ERROR: Failed during DB check/write.", error);
        showMessage("❌ CRITICAL ERROR: Database access failed. Check rules.", 'error', 10000);
    }
}

function loadFromFirebase() {
    appData.refActive.on('value', (snapshot) => {
        if (appData.isInitialized) { appData.activeBowls = snapshot.val() || []; updateDisplay(); }
    });
    appData.refPrepared.on('value', (snapshot) => {
        if (appData.isInitialized) { appData.preparedBowls = snapshot.val() || []; updateDisplay(); }
    });
    appData.refReturned.on('value', (snapshot) => {
        if (appData.isInitialized) { appData.returnedBowls = snapshot.val() || []; updateDisplay(); }
    });
    appData.refScans.on('value', (snapshot) => {
        if (appData.isInitialized) {
            appData.myScans = snapshot.val() || [];
            updateDisplay(); 
            const lastSyncInfoEl = document.getElementById('lastSyncInfo');
            if(lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
        }
    });
}

function syncToFirebase() {
    if (!appData.isInitialized) return;

    const writes = [
        appData.refActive.set(appData.activeBowls),
        appData.refPrepared.set(appData.preparedBowls),
        appData.refReturned.set(appData.returnedBowls),
        appData.refScans.set(appData.myScans),
    ];
    Promise.all(writes).catch(error => {
        console.error("Firebase sync failed:", error);
        showMessage("❌ ERROR: Data sync failed.", 'error');
    });
}

function clearActiveInventory() {
    if (!appData.isInitialized) return;

    const currentCount = appData.activeBowls.length;
    if (currentCount === 0) {
        showMessage("ℹ️ Active Inventory is already empty.", 'info');
        return;
    }

    appData.activeBowls = [];
    syncToFirebase();
    showMessage(`✅ Successfully cleared ${currentCount} Active Bowl records. Count is now 0.`, 'success', 5000);
}


// --- UI AND MODE MANAGEMENT ---
function populateUserDropdown(mode) {
    const userSelect = document.getElementById('userSelect'); 
    if (!userSelect) return;
    userSelect.innerHTML = '<option value="" disabled selected>-- Select User --</option>';
    if (!mode) return;
    const filteredUsers = CONSTANTS.USERS.filter(user => user.role.toLowerCase() === mode);
    filteredUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
}

function updateDisplay() {
    if (!appData.isDomReady) return;
    const today = formatDateStandard(new Date());

    const modeDisplay = document.getElementById('modeDisplay');
    const kitchenBtn = document.getElementById('kitchenBtn');
    const returnBtn = document.getElementById('returnBtn');
    const dishSection = document.getElementById('dishSection');
    const userSelect = document.getElementById('userSelect');
    const dishLetterSelect = document.getElementById('dishLetterSelect');
    const scanInput = document.getElementById('scanInput');
    const scanningCard = document.getElementById('scanningCard');
    const userSelectionCard = document.getElementById('userSelectionCard');

    if (appData.mode) {
        const modeText = appData.mode === 'kitchen' ? 'Status: Kitchen Prep Mode 🍳' : 'Status: Return Scan Mode 🔄';
        if(modeDisplay) {
            modeDisplay.textContent = modeText;
            modeDisplay.classList.remove('accent-red', 'accent-green');
            modeDisplay.classList.add(appData.mode === 'kitchen' ? 'accent-green' : 'accent-red');
        }
        if(userSelectionCard) userSelectionCard.style.opacity = 1; 
        if(userSelect) userSelect.disabled = false;

        if(kitchenBtn) kitchenBtn.classList.toggle('accent-green', appData.mode === 'kitchen');
        if(returnBtn) returnBtn.classList.toggle('accent-red', appData.mode === 'return');
    } else {
        if(modeDisplay) modeDisplay.textContent = 'Status: Please Select Mode';
        if(userSelectionCard) userSelectionCard.style.opacity = 0.5; 
        if(scanningCard) scanningCard.style.opacity = 0.5;
        if(userSelect) userSelect.disabled = true;
    }

    if (dishSection) dishSection.classList.toggle('hidden', appData.mode !== 'kitchen');

    const isReadyToScan = appData.mode && appData.user && (appData.mode === 'return' || appData.dishLetter);
    if(scanningCard) scanningCard.style.opacity = isReadyToScan ? 1 : 0.5;
    if(dishLetterSelect) dishLetterSelect.disabled = !appData.user;
    if (!isReadyToScan) appData.scanning = false;

    const activeCountEl = document.getElementById('activeCount'); 
    if (activeCountEl) activeCountEl.textContent = appData.activeBowls.length; 
    const preparedTodayCountEl = document.getElementById('preparedTodayCount');
    if (preparedTodayCountEl) preparedTodayCountEl.textContent = appData.preparedBowls.length;
    const exportReturnCountEl = document.getElementById('exportReturnCount');
    if (exportReturnCountEl) exportReturnCountEl.textContent = appData.returnedBowls.length;

    let myScansCount = 0;
    const { start, end } = getReportingDayTimestamp();
    if (appData.user && appData.dishLetter) {
        myScansCount = appData.myScans.filter(scan => 
            scan.type === 'kitchen' && 
            scan.timestamp >= start && scan.timestamp < end &&
            scan.user === appData.user &&
            scan.dishLetter === appData.dishLetter
        ).length;
    }

    const myScansCountEl = document.getElementById('myScansCount');
    if (myScansCountEl) myScansCountEl.textContent = myScansCount;
    const myDishLetterLabelEl = document.getElementById('myDishLetterLabel'); 
    if (myDishLetterLabelEl) myDishLetterLabelEl.textContent = appData.dishLetter || '---';

    const scanStatusEl = document.getElementById('scanStatus');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    if(scanStatusEl) scanStatusEl.textContent = appData.scanning ? 'Active' : 'Stopped';

    if(scanInput) {
        scanInput.disabled = !appData.scanning;
        scanInput.classList.toggle('scanning-active', appData.scanning && isReadyToScan);
    }
    if(startBtn) startBtn.disabled = !isReadyToScan || appData.scanning;
    if(stopBtn) stopBtn.disabled = !appData.scanning;
    
    renderLivePrepReport(getLivePrepReport());
}

function setMode(mode) {
    if (mode !== 'kitchen' && mode !== 'return') return;
    appData.user = null;
    appData.dishLetter = null;
    appData.mode = mode;
    stopScanning(); 
    populateUserDropdown(mode);
    const userSelect = document.getElementById('userSelect');
    if (userSelect) userSelect.value = '';
    const dishLetterSelect = document.getElementById('dishLetterSelect');
    if (dishLetterSelect) dishLetterSelect.value = '';
    showMessage(`Mode switched to: ${mode.toUpperCase()}. Please select a user.`, 'info');
    updateDisplay();
}

function selectUser(userName) {
    const user = CONSTANTS.USERS.find(u => u.name === userName);
    if (!user || !appData.mode) {
        appData.user = null;
        updateDisplay();
        return;
    }
    appData.user = userName;
    if (appData.mode === 'return') {
        appData.dishLetter = null; 
        showMessage(`User selected: ${userName}. Ready to scan in RETURN mode.`, 'success');
    } else {
        appData.dishLetter = null;
        showMessage(`User selected: ${userName}. Please select a Dish Letter.`, 'info');
        const dishLetterSelect = document.getElementById('dishLetterSelect');
        if(dishLetterSelect) dishLetterSelect.value = ''; 
    }
    updateDisplay();
}

function selectDishLetter(value) {
    if (appData.mode !== 'kitchen' || !appData.user) return;
    const upperValue = value.trim().toUpperCase();
    if (CONSTANTS.DISH_LETTERS.includes(upperValue)) {
        appData.dishLetter = upperValue;
        showMessage(`Dish Letter selected: ${upperValue}. Ready to scan.`, 'success');
        updateDisplay();
    }
}

// --- Core Scanning Logic ---

function startScanning() {
    const isReadyToScan = appData.mode && appData.user && (appData.mode === 'return' || appData.dishLetter);
    if (!isReadyToScan) {
        showMessage("❌ ERROR: Complete Steps 1 & 2 first.", 'error');
        return;
    }
    appData.scanning = true;
    document.getElementById('scanInput')?.focus();
    showMessage("✅ Scanner Activated.", 'success');
    updateDisplay();
}

function stopScanning() {
    appData.scanning = false;
    document.getElementById('scanInput')?.blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

function processScan(vytUrl) {
    if (!appData.scanning || !appData.user || appData.isProcessingScan) return;
    appData.isProcessingScan = true;

    const timestamp = new Date().toISOString();
    const exactVytUrl = vytUrl;

    if (appData.mode === 'kitchen') {
        if (appData.preparedBowls.some(b => b.vytUrl === exactVytUrl)) {
            showScanError("⚠️ DUPLICATE: Already prepared.");
            appData.isProcessingScan = false;
            return;
        }
    } else { // Return mode
        if (appData.returnedBowls.some(b => b.vytUrl === exactVytUrl && formatDateStandard(b.returnDate) === formatDateStandard(timestamp))) {
            showScanError("⚠️ DUPLICATE: Already returned.");
            appData.isProcessingScan = false;
            return;
        }
    }
    
    const scanRecord = {
        vytUrl: exactVytUrl,
        timestamp: timestamp,
        type: appData.mode,
        user: appData.user,
        dishLetter: appData.mode === 'kitchen' ? appData.dishLetter : 'N/A' 
    };
    appData.myScans.push(scanRecord);

    const result = appData.mode === 'kitchen' ? kitchenScan(exactVytUrl, timestamp) : returnScan(exactVytUrl, timestamp);

    if (result.success) {
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showScanError(result.message);
    }

    appData.isProcessingScan = false;
    updateDisplay(); 
}

function kitchenScan(vytUrl, timestamp) {
    const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    const activeIndex = appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    let statusMessage = "new prep cycle started.";

    if (activeIndex !== -1) {
        const recycledBowl = appData.activeBowls.splice(activeIndex, 1)[0];
        recycledBowl.returnDate = formatDateStandard(new Date(timestamp));
        appData.returnedBowls.push(recycledBowl);
        statusMessage = "recycled from active.";
    }

    const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    if (preparedIndex !== -1) appData.preparedBowls.splice(preparedIndex, 1);

    const newPreparedBowl = {
        vytUrl: vytUrl, dishLetter: appData.dishLetter, company: 'Unknown', customer: 'Unknown',
        preparedDate: formatDateStandard(new Date(timestamp)), preparedTime: timestamp, 
        user: appData.user, state: 'PREPARED_UNKNOWN'
    };
    appData.preparedBowls.push(newPreparedBowl);

    return { success: true, message: `✅ Prep: ${vytUrl.slice(-8)} to Dish ${appData.dishLetter} (${statusMessage})` };
}

function returnScan(vytUrl, timestamp) {
    const returnDate = formatDateStandard(new Date(timestamp));

    const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    if (preparedIndex !== -1) {
        const returnedBowl = appData.preparedBowls.splice(preparedIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        appData.returnedBowls.push(returnedBowl);
        return { success: true, message: `📦 Return: ${vytUrl.slice(-8)} (from Prepared)` };
    }

    const activeIndex = appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    if (activeIndex !== -1) {
        const returnedBowl = appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        appData.returnedBowls.push(returnedBowl);
        return { success: true, message: `📦 Return: ${vytUrl.slice(-8)} (from Active)` };
    }

    return { success: false, message: `❌ NOT FOUND: ${vytUrl.slice(-8)}` };
}

function processJSONData(jsonString) { 
    showMessage('JSON processing is not yet implemented.', 'warning'); 
    return { success: true };
}
function exportActiveBowls() { showMessage('Exporting Active Bowls...', 'info'); }
function exportReturnData() { showMessage('Exporting Return Data...', 'info'); }
function exportAllData() { showMessage('Exporting All Data...', 'info'); }
function resetTodaysPreparedBowls() { showMessage('Resetting scans...', 'warning'); }

// --- Reports ---
function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();
    const todaysKitchenScans = appData.myScans.filter(scan => 
        scan.type === 'kitchen' && 
        scan.timestamp >= start && scan.timestamp < end
    );
    const groupedData = todaysKitchenScans.reduce((acc, scan) => {
        const letter = scan.dishLetter;
        if (!acc[letter]) {
            acc[letter] = { dishLetter: letter, users: new Map(), count: 0 };
        }
        const userCount = acc[letter].users.get(scan.user) || 0;
        acc[letter].users.set(scan.user, userCount + 1);
        acc[letter].count++;
        return acc;
    }, {});
    const statsArray = Object.values(groupedData).map(item => ({
        ...item,
        users: Array.from(item.users, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)) 
    }));
    statsArray.sort((a, b) => CONSTANTS.DISH_LETTERS.indexOf(a.dishLetter) - CONSTANTS.DISH_LETTERS.indexOf(b.dishLetter));
    return statsArray;
}

function renderLivePrepReport(stats) {
    const container = document.getElementById('livePrepReportBody');
    if (!container) return;
    if (stats.length === 0) {
        container.innerHTML = `<tr><td colspan="3" class="table-empty-cell">No kitchen scans this cycle.</td></tr>`;
        return;
    }
    let html = '';
    stats.forEach(dish => {
        let firstRow = true;
        dish.users.forEach(user => {
            html += `<tr>${firstRow ? `<td rowspan="${dish.users.length}" class="px-3 py-2 font-bold text-center border-r text-pink-400">${dish.dishLetter}</td>` : ''}<td class="px-3 py-2">${user.name}</td><td class="px-3 py-2 text-center font-bold">${user.count}</td></tr>`;
            firstRow = false;
        });
    });
    container.innerHTML = html;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    appData.isDomReady = true;

    const dishLetterSelect = document.getElementById('dishLetterSelect');
    if(dishLetterSelect) {
        CONSTANTS.DISH_LETTERS.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            dishLetterSelect.appendChild(option);
        });
    }

    const scanInput = document.getElementById('scanInput');
    if(scanInput) {
        scanInput.addEventListener('input', (e) => {
            const scannedValue = e.target.value.trim();
            if (scannedValue.length > 5) { 
                if (appData.scanTimer) clearTimeout(appData.scanTimer);
                appData.scanTimer = setTimeout(() => {
                    if (scanInput.value.trim() === scannedValue && appData.scanning && !appData.isProcessingScan) {
                        processScan(scannedValue);
                        scanInput.value = ''; 
                    }
                }, 50);
            }
        });
        scanInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                const scannedValue = e.target.value.trim();
                if (scannedValue) processScan(scannedValue);
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        const scanInput = document.getElementById('scanInput');
        if (appData.scanning && scanInput && document.activeElement !== scanInput && e.key.length === 1 && /[\w\d]/.test(e.key)) {
            scanInput.focus();
        }
    });

    window.setMode = setMode;
    window.selectUser = selectUser;
    window.selectDishLetter = selectDishLetter;
    window.startScanning = startScanning;
    window.stopScanning = stopScanning;
    window.processJSONData = processJSONData;
    window.exportActiveBowls = exportActiveBowls;
    window.exportReturnData = exportReturnData;
    window.exportAllData = exportAllData;
    window.resetTodaysPreparedBowls = resetTodaysPreparedBowols;
    window.clearActiveInventory = clearActiveInventory;

    initializeFirebase();
});
