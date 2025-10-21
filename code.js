// ProGlove Scanner - Complete Bowl Tracking System

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
        const firebaseConfig = HARDCODED_FIREBASE_CONFIG; // Using hardcoded for GitHub

        const appId = firebaseConfig.projectId;
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            console.error("Firebase library not loaded.");
            showMessage("❌ ERROR: Firebase library not loaded. Check index.html script tags.", 'error');
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

        showMessage("✅ Application initialized. Please select an operation mode.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ ERROR: Firebase failed to initialize. Check configuration or Firebase project rules.", 'error');
    }
}

async function ensureDatabaseInitialized(ref) {
    try {
        const snapshot = await ref.once('value');
        if (!snapshot.exists() || snapshot.val() === null) {
            console.log("🆕 Database structure is empty. Writing initial structure.");
            await appData.refActive.set([]); 
            await appData.refPrepared.set([]); 
            await appData.refReturned.set([]);
            await appData.refScans.set([]);
            console.log("⬇️ Initial data structure written successfully.");
        } else {
            console.log("⬆️ Database contains existing data.");
        }

        appData.isInitialized = true;
        loadFromFirebase();

    } catch (error) {
        console.error("CRITICAL ERROR: Failed during initial data check/write. Check rules.", error);
        document.getElementById('systemStatus')?.textContent = '⚠️ Offline Mode - CRITICAL DB Error';
        showMessage("❌ CRITICAL ERROR: Database access failed. Check rules or internet connection.", 'error', 10000);
    }
}


function loadFromFirebase() {
    document.getElementById('systemStatus')?.textContent = '🔄 Connecting to Cloud...'; 

    appData.refActive.on('value', (snapshot) => {
        if (appData.isInitialized) {
            appData.activeBowls = snapshot.val() || [];
            updateDisplay(); 
        }
    });
    appData.refPrepared.on('value', (snapshot) => {
        if (appData.isInitialized) {
            appData.preparedBowls = snapshot.val() || [];
            updateDisplay(); 
        }
    });
    appData.refReturned.on('value', (snapshot) => {
        if (appData.isInitialized) {
            appData.returnedBowls = snapshot.val() || [];
            updateDisplay(); 
        }
    });
    appData.refScans.on('value', (snapshot) => {
        if (appData.isInitialized) {
            appData.myScans = snapshot.val() || [];
            updateDisplay(); 
            console.log("⬆️ All data synchronized from Firebase.");

            const lastSyncInfoEl = document.getElementById('lastSyncInfo');
            if(lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
        }
    });
}

function syncToFirebase() {
    if (!appData.isInitialized) {
        console.warn("Sync attempted before full initialization. Skipping write.");
        return;
    }

    const writes = [
        appData.refActive.set(appData.activeBowls),
        appData.refPrepared.set(appData.preparedBowls),
        appData.refReturned.set(appData.returnedBowls),
        appData.refScans.set(appData.myScans),
    ];

    Promise.all(writes)
        .then(() => {
            appData.lastSync = new Date().toISOString();
            console.log("⬇️ Data successfully written to Firebase.");
        })
        .catch(error => {
            console.error("Firebase synchronization failed:", error);
            showMessage("❌ ERROR: Data sync failed. Check connection.", 'error');
        });
}

function clearActiveInventory() {
    if (!appData.isInitialized) {
        showMessage("❌ Cannot clear data. Application not fully initialized.", 'error');
        return;
    }

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
        const modeText = appData.mode === 'kitchen' ?
            'Status: Kitchen Prep Mode 🍳' : 'Status: Return Scan Mode 🔄';
        if(modeDisplay) {
            modeDisplay.textContent = modeText;
            modeDisplay.classList.remove('bg-gray-500', 'accent-red', 'accent-green');
            modeDisplay.classList.add(appData.mode === 'kitchen' ? 'accent-green' : 'accent-red');
        }
        if(userSelectionCard) userSelectionCard.style.opacity = 1; 
        if(userSelect) userSelect.disabled = false;

        if(kitchenBtn) kitchenBtn.classList.remove('accent-green', 'btn-neutral');
        if(returnBtn) returnBtn.classList.remove('accent-red', 'btn-neutral');

        if (appData.mode === 'kitchen') {
            if(kitchenBtn) kitchenBtn.classList.add('accent-green');
            if(returnBtn) returnBtn.classList.add('btn-neutral');
        } else {
            if(returnBtn) returnBtn.classList.add('accent-red');
            if(kitchenBtn) kitchenBtn.classList.add('btn-neutral');
        }

    } else {
        if(modeDisplay) modeDisplay.textContent = 'Status: Please Select Mode';
        if(userSelectionCard) userSelectionCard.style.opacity = 0.5; 
        if(scanningCard) scanningCard.style.opacity = 0.5;
        if(userSelect) userSelect.disabled = true;
        if(kitchenBtn) kitchenBtn.classList.add('btn-neutral');
        if(returnBtn) returnBtn.classList.add('btn-neutral');
    }

    if (dishSection) {
        if (appData.mode === 'kitchen') {
            dishSection.classList.remove('hidden');
        } else {
            dishSection.classList.add('hidden');
        }
    }

    const isReadyToScan = appData.mode && appData.user && (appData.mode === 'return' || appData.dishLetter);
    if (isReadyToScan) {
        if(scanningCard) scanningCard.style.opacity = 1;
        if(dishLetterSelect) dishLetterSelect.disabled = false;
        if (scanInput && !scanInput.classList.contains('scanning-error')) {
             scanInput.placeholder = `Ready to Scan in ${appData.mode.toUpperCase()} Mode...`;
        }
    } else {
        if(scanningCard) scanningCard.style.opacity = 0.5;
        if (appData.mode === 'kitchen' && dishLetterSelect) dishLetterSelect.disabled = !appData.user;

        appData.scanning = false;
    }


    const activeCountEl = document.getElementById('activeCount'); 
    if (activeCountEl) activeCountEl.textContent = appData.activeBowls.length; 

    const preparedTodayCountEl = document.getElementById('preparedTodayCount');
    if (preparedTodayCountEl) preparedTodayCountEl.textContent = appData.preparedBowls.length;
    const returnedTodayCount = appData.returnedBowls.filter(bowl => 
        formatDateStandard(bowl.returnDate) === today
    ).length;
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
    const myDishLetterLabelEl = document.getElementById('myDishLetterLabel'); 

    if (myScansCountEl) myScansCountEl.textContent = myScansCount;
    if (myDishLetterLabelEl) myDishLetterLabelEl.textContent = appData.dishLetter || '---';
    const scanStatusEl = document.getElementById('scanStatus');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    if(scanStatusEl) scanStatusEl.textContent = appData.scanning ? 'Active' : 'Stopped';

    if(scanInput) {
        scanInput.disabled = !appData.scanning;
        scanInput.classList.remove('scanning-active');

        if (appData.scanning && isReadyToScan) {
            scanInput.classList.add('scanning-active');
            if(startBtn) startBtn.disabled = true;
            if(stopBtn) stopBtn.disabled = false;
        } else {
            if(startBtn) startBtn.disabled = !isReadyToScan;
            if(stopBtn) stopBtn.disabled = true;
        }
    }

    const selectedUserEl = document.getElementById('selectedUser');
    if(selectedUserEl) selectedUserEl.textContent = appData.user || '---';

    const selectedDishLetterEl = document.getElementById('selectedDishLetter');
    if(selectedDishLetterEl) selectedDishLetterEl.textContent = appData.dishLetter || '---';
    const exportActiveCountEl = document.getElementById('exportActiveCount');
    if(exportActiveCountEl) exportActiveCountEl.textContent = appData.activeBowls.length;

    const exportPreparedCountEl = document.getElementById('exportPreparedCount');
    if(exportPreparedCountEl) exportPreparedCountEl.textContent = appData.preparedBowls.length;

    const livePrepData = getLivePrepReport();
    renderLivePrepReport(livePrepData);
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
    if (!user) {
        appData.user = null;
        updateDisplay();
        return;
    }

    if (!appData.mode) {
        showMessage("❌ ERROR: Please select an Operation Mode (Kitchen/Return) first.", 'error');
        const userSelect = document.getElementById('userSelect');
        if(userSelect) userSelect.value = ''; 
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
    if (appData.mode !== 'kitchen' || !appData.user) {
        showMessage("❌ ERROR: User or Mode not properly set.", 'error');
        const dishLetterSelect = document.getElementById('dishLetterSelect');
        if(dishLetterSelect) dishLetterSelect.value = ''; 
        return;
    }

    const upperValue = value.trim().toUpperCase();
    if (CONSTANTS.DISH_LETTERS.includes(upperValue)) {
        appData.dishLetter = upperValue;
        showMessage(`Dish Letter selected: ${upperValue}. Ready to scan.`, 'success');
        updateDisplay();
    } else {
        showMessage("❌ ERROR: Invalid Dish Letter/Number selected.", 'error');
    }
}

function clearActiveInventory() {
    if (!appData.isInitialized) {
        showMessage("❌ Cannot clear data. Application not fully initialized.", 'error');
        return;
    }

    const currentCount = appData.activeBowls.length;
    if (currentCount === 0) {
        showMessage("ℹ️ Active Inventory is already empty.", 'info');
        return;
    }

    appData.activeBowls = [];
    syncToFirebase();
    showMessage(`✅ Successfully cleared ${currentCount} Active Bowl records. Count is now 0.`, 'success', 5000);
}


// --- Core Scanning, Export, Report, and Maintenance Logic ---

function startScanning() {
    const isReadyToScan = appData.mode && appData.user && (appData.mode === 'return' || appData.dishLetter);
    if (!isReadyToScan) {
        showMessage("❌ ERROR: Cannot start scanning. Complete Steps 1 & 2 first.", 'error');
        return;
    }

    appData.scanning = true;
    const scanInput = document.getElementById('scanInput');
    if(scanInput) scanInput.focus();
    showMessage("✅ Scanner Activated. Ready to scan.", 'success');
    updateDisplay();
}

function stopScanning() {
    appData.scanning = false;
    const scanInput = document.getElementById('scanInput');
    if(scanInput) scanInput.blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

function processScan(vytUrl) {
    if (!appData.scanning || !appData.user) {
        showMessage("❌ ERROR: Scanner not active or user not selected.", 'error');
        showScanError("❌ ERROR: Scanner not active or user not selected.");
        return;
    }

    if (appData.isProcessingScan) {
        console.warn("Scan in progress. Ignoring current input.");
        return;
    }

    appData.isProcessingScan = true;

    const timestamp = new Date().toISOString();
    const exactVytUrl = vytUrl;

    if (appData.mode === 'kitchen') {
        const isAlreadyPrepared = appData.preparedBowls.some(b => b.vytUrl === exactVytUrl);
        const isAlreadyActive = appData.activeBowls.some(b => b.vytUrl === exactVytUrl);

        if (isAlreadyPrepared) {
            showMessage("⚠️ DUPLICATE SCAN: This bowl has already been prepared today.", 'error', 7000);
            showScanError("⚠️ DUPLICATE: Already prepared today.");
            appData.isProcessingScan = false;
            return;
        }

        if (isAlreadyActive) {
        }
    }

    if (appData.mode === 'return') {
        const isAlreadyReturned = appData.returnedBowls.some(b => b.vytUrl === exactVytUrl && formatDateStandard(b.returnDate) === formatDateStandard(timestamp));
        if (isAlreadyReturned) {
            showMessage("⚠️ DUPLICATE SCAN: This bowl has already been returned today.", 'error', 7000);
            showScanError("⚠️ DUPLICATE: Already returned today.");
            appData.isProcessingScan = false;
            return;
        }
    }
    
    const scanRecord = {
        vytUrl: exactVytUrl,
        timestamp: timestamp,
        type: appData.mode,
        user: appData.user,
        dishLetter: appData.mode === 'kitchen' ?
            appData.dishLetter : 'N/A' 
    };
    appData.myScans.push(scanRecord);

    let result;
    if (appData.mode === 'kitchen') {
        result = kitchenScan(exactVytUrl, timestamp);
    } else { 
        result = returnScan(exactVytUrl, timestamp);
    }

    if (result.success) {
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showMessage(result.message, 'error');
        showScanError(result.message);
    }

    appData.isProcessingScan = false;
    updateDisplay(); 
}

function kitchenScan(vytUrl, timestamp) {
    const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    const activeIndex = appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    let statusMessage = "started a new prep cycle.";

    if (activeIndex !== -1) {
        const returnedBowl = appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = formatDateStandard(new Date(timestamp));
        appData.returnedBowls.push(returnedBowl);
        statusMessage = "closed active cycle and started new prep (Recycled).";
    }

    if (preparedIndex !== -1) {
        appData.preparedBowls.splice(preparedIndex, 1);
        statusMessage = "cleared old prepared record for new prep.";
    }

    const newPreparedBowl = {
        vytUrl: vytUrl, 
        dishLetter: appData.dishLetter,
        company: 'Unknown',
        customer: 'Unknown',
        preparedDate: formatDateStandard(new Date(timestamp)), 
        preparedTime: timestamp, 
        user: appData.user,
        state: 'PREPARED_UNKNOWN'
    };
    appData.preparedBowls.push(newPreparedBowl);

    return { 
        success: true, 
        message: `✅ Kitchen Prep: ${vytUrl.slice(-10)} assigned to Dish ${appData.dishLetter}. Cycle: ${statusMessage}` 
    };
}

function returnScan(vytUrl, timestamp) {
    const returnDate = formatDateStandard(new Date(timestamp));

    const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    if (preparedIndex !== -1) {
        const returnedBowl = appData.preparedBowls.splice(preparedIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        appData.returnedBowls.push(returnedBowl);
        return { 
            success: true, 
            message: `📦 Returned: ${vytUrl.slice(-10)} (Was Prepared). Available for next prep.` 
        };
    }

    const activeIndex = appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    if (activeIndex !== -1) {
        const returnedBowl = appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        appData.returnedBowls.push(returnedBowl);
        return { 
            success: true, 
            message: `📦 Returned: ${vytUrl.slice(-10)} (Active Cycle Closed).` 
        };
    }

    return { 
        success: false, 
        message: `❌ NOT FOUND: ${vytUrl.slice(-10)} is not Active or Prepared.` 
    };
}

function flattenOrderData(order) {
    const flattenedBowls = [];

    if (!order || !order.id || !order.name || !order.boxes || !Array.isArray(order.boxes)) {
        console.warn("Invalid or incomplete top-level order data, skipping order.", order);
        return [];
    }

    const companyName = String(order.name).trim();
    const dishVytMap = new Map();
    for (const box of order.boxes) {
        if (!box.dishes || !Array.isArray(box.dishes)) continue;
        for (const dish of box.dishes) {

            const dishLabel = String(dish.label || 'N/A').trim().toUpperCase();
            if (dishLabel === 'ADDONS') {
                continue; 
            }

            const codes = dish.bowlCodes && Array.isArray(dish.bowlCodes) && dish.bowlCodes.length > 0
                ? dish.bowlCodes
                : [];
            
            if (!dish.users || !Array.isArray(dish.users)) continue;

            const usernames = dish.users.map(user => String(user.username || user.id).trim());
            const preparedDate = order.readyTime;

            if (usernames.length === 0) continue; 

            if (codes.length > 0) {
                for (const vytUrl of codes) {
                    const safeVytUrl = vytUrl.trim();

                    const existingRecord = dishVytMap.get(safeVytUrl);
                    if (existingRecord) {
                        existingRecord.customer = Array.from(existingRecord.customer).concat(usernames);
                    } else {
                        dishVytMap.set(safeVytUrl, {
                            vytUrl: safeVytUrl, 
                            dishLetter: dishLabel,
                            company: companyName,
                            customer: usernames,
                            preparedDate: preparedDate,
                        });
                    }
                }
            } 
        }
    }

    dishVytMap.forEach(record => {
        const customerString = record.customer.join(', ');

        flattenedBowls.push({
            vytUrl: record.vytUrl, 
            dishLetter: record.dishLetter,
            company: record.company,
            customer: customerString, 
            preparedDate: record.preparedDate,
        });
    });
    return flattenedBowls;
}

function processJSONData(jsonString) {
    if (!jsonString || jsonString.trim() === '' || jsonString.includes('Paste JSON data here')) {
        showMessage("❌ ERROR: JSON text area is empty. Please paste data.", 'error');
        return;
    }

    let rawData;
    try {
        rawData = JSON.parse(jsonString);
    } catch (e) {
        showMessage(`❌ ERROR: JSON Parsing Error: ${e.message}`, 'error');
        return;
    }

    const ordersToProcess = Array.isArray(rawData) ? rawData : [rawData];

    let allFlattenedBowls = [];
    let totalItemsExpected = 0; 

    ordersToProcess.forEach(order => {
        const flattened = flattenOrderData(order);
        allFlattenedBowls = allFlattenedBowls.concat(flattened);

        if (order.boxes) {
            order.boxes.forEach(box => {
                if (box.dishes) {
                    box.dishes.forEach(dish => {
                        const dishLabel = String(dish.label || 'N/A').trim().toUpperCase();

                        if (dishLabel !== 'ADDONS') {
                            totalItemsExpected += (dish.bowlCodes && dish.bowlCodes.length > 0) 
                                ? dish.bowlCodes.length 
                                : 0;
                        }
                    });
                }
            });
        }
    });
    const totalItemsPatched = allFlattenedBowls.length;

    console.log(`JSON Patch Summary: Total items expected: ${totalItemsExpected}. Total unique bowls patched: ${totalItemsPatched}`);
    if (allFlattenedBowls.length === 0) {
        showMessage("❌ ERROR: No assignable bowl records found in the pasted data.", 'error');
        return;
    }

    let updates = 0;
    let creations = 0;

    const timestamp = new Date().toISOString();
    for (const item of allFlattenedBowls) {

        if (!item.vytUrl || !item.company || !item.customer) {
            console.error("Internal Error: Flattened item missing core fields.", item);
            continue;
        }

        const exactVytUrl = item.vytUrl; 

        const preparedIndex = appData.preparedBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const activeIndex = appData.activeBowls.findIndex(b => b.vytUrl === exactVytUrl);

        const jsonAssignmentDate = formatDateStandard(item.preparedDate || item.date || timestamp);
        if (activeIndex !== -1) {
            const activeBowl = appData.activeBowls[activeIndex];
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();

            activeBowl.preparedDate = jsonAssignmentDate; 
            activeBowl.updateTime = timestamp;
            updates++;
            continue;
        }

        if (preparedIndex !== -1) {
            const preparedBowl = appData.preparedBowls.splice(preparedIndex, 1)[0];
            preparedBowl.company = item.company.trim();
            preparedBowl.customer = item.customer.trim();
            preparedBowl.preparedDate = jsonAssignmentDate; 
            preparedBowl.updateTime = timestamp; 
            preparedBowl.state = 'ACTIVE_KNOWN';

            appData.activeBowls.push(preparedBowl);
            creations++;
            continue;
        }

        if (preparedIndex === -1 && activeIndex === -1) {
            const newBowl = {
                vytUrl: exactVytUrl, 
                dishLetter: item.dishLetter, 
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: jsonAssignmentDate, 
                preparedTime: timestamp,
                user: appData.user ||
                    'SYSTEM',
                state: 'ACTIVE_KNOWN'
            };
            appData.activeBowls.push(newBowl);
            creations++;
        }
    }

    if (updates > 0 || creations > 0) {
        showMessage(`✅ JSON Import Complete: ${creations} new Active Bowls, ${updates} updated Active Bowls. Total Scannable Bowls: ${totalItemsPatched}`, 'success', 5000);
        syncToFirebase();
        const jsonDataEl = document.getElementById('jsonData');
        if(jsonDataEl) jsonDataEl.value = '';
    } else {
        showMessage("ℹ️ No bowls updated or created from JSON data.", 'info');
    }
}

function exportData(data, filename, source) {
    if (!data || data.length === 0) {
        showMessage(`ℹ️ Cannot export. ${source} is empty.`, 'warning');
        return;
    }

    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';
    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header] === null || typeof row[header] === 'undefined' ? '' : String(row[header]);
            value = value.replace(/"/g, '""');
            if (value.includes(',') || value.includes('\n') || value.includes(':')) {
                value = `"${value}"`;
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.json', '.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(`💾 Exported data to ${a.download} (CSV format for Excel)`, 'success');
}

function exportActiveBowls() {
    exportData(appData.activeBowls, `active_bowls_${formatDateStandard(new Date())}.csv`, 
        'Active Bowls');
}

function exportReturnData() {
    exportData(appData.returnedBowls, `returned_bowls_${formatDateStandard(new Date())}.csv`, 'Returned Bowls');
}

function exportAllData() {
    const fullData = [
        ...appData.activeBowls.map(b => ({ ...b, source: 'Active' })),
        ...appData.preparedBowls.map(b => ({ ...b, source: 'Prepared' })),
        ...appData.returnedBowls.map(b => ({ ...b, source: 'Returned' })),
    ];
    exportData(fullData, `all_combined_bowl_data_${formatDateStandard(new Date())}.csv`, 'Combined Data');
}

function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();

    const todaysKitchenScans = appData.myScans.filter(scan => 
        scan.type === 'kitchen' && 
        scan.timestamp >= start && 
        scan.timestamp < end
    );
    const groupedData = todaysKitchenScans.reduce((acc, scan) => {
        const letter = scan.dishLetter;
        if (!acc[letter]) {
            acc[letter] = {
                dishLetter: letter,
                users: new Map(), 
                count: 0
            };
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
    statsArray.sort((a, b) => {
        const indexA = CONSTANTS.DISH_LETTERS.indexOf(a.dishLetter);
        const indexB = CONSTANTS.DISH_LETTERS.indexOf(b.dishLetter);
        return indexA - indexB;
    });

    return statsArray;
}

function renderLivePrepReport(stats) {
    const container = document.getElementById('livePrepReportBody');
    if (!container) return;
    if (stats.length === 0) {
        container.innerHTML = `<tr><td colspan="3" class="px-3 py-2 text-center text-gray-400">No kitchen scans recorded during this cycle.</td></tr>`;
        return;
    }

    let html = '';
    stats.forEach(dish => {
        let firstRow = true;

        dish.users.forEach(user => {
            html += `
               <tr class="hover:bg-gray-700">
                   ${firstRow ? `<td rowspan="${dish.users.length}" class="px-3 py-2 font-bold text-center border-r border-gray-700 text-pink-400">${dish.dishLetter}</td>` : ''}
                   <td class="px-3 py-2 text-gray-300">${user.name}</td>
                  
                   <td class="px-3 py-2 text-center font-bold text-gray-200">${user.count}</td>
               </tr>
           `;
            firstRow = false;
        });
    });
    container.innerHTML = html;
}

function checkDailyDataReset() {
    const now = new Date();
    const cutoffHour = 22;
    const today = formatDateStandard(now);
    const lastResetDate = appData.lastDataReset ? formatDateStandard(new Date(appData.lastDataReset)) : null;

    if (now.getHours() >= cutoffHour && lastResetDate !== today) {
        const bowlsToKeep = appData.returnedBowls.filter(bowl => 
            formatDateStandard(bowl.returnDate) === today
        );
        const removedCount = appData.returnedBowls.length - bowlsToKeep.length;

        if (removedCount > 0) {
            appData.returnedBowls = bowlsToKeep;
            appData.lastDataReset = now.toISOString();
            syncToFirebase();
            console.log(`🧹 Daily Data Reset (10 PM): Removed ${removedCount} returned bowl records from previous days.`);
        }
    }
}

function resetTodaysPreparedBowls() {
    const { start, end } = getReportingDayTimestamp();

    const initialPreparedCount = appData.preparedBowls.length;
    appData.preparedBowls = [];

    const initialScanCount = appData.myScans.length;
    appData.myScans = appData.myScans.filter(scan => 
        !(scan.type === 'kitchen' && scan.timestamp >= start && scan.timestamp < end)
    );
    const removedScans = initialScanCount - appData.myScans.length;

    console.log(`🗑️ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans from the current reporting window`);
    if (initialPreparedCount > 0 || removedScans > 0) {
        appData.lastSync = new Date().toISOString();

        syncToFirebase();
        updateDisplay();
        showMessage(`✅ Reset Successful: ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans removed.`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls or scans found to remove.', 'info');
    }
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

                if (appData.scanTimer) {
                    clearTimeout(appData.scanTimer);
                }

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
                const scannedValue = scanInput.value.trim();
                if (scannedValue) {
                 processScan(scannedValue);
                }
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        const scanInput = document.getElementById('scanInput');
        if (appData.scanning && scanInput && document.activeElement !== scanInput && e.key.length === 1 && /[\w\d]/.test(e.key)) {
            scanInput.focus();
        }
    });
    // Expose functions globally for HTML access
    window.setMode = setMode;
    window.selectUser = selectUser;
    window.selectDishLetter = selectDishLetter;
    window.startScanning = startScanning;
    window.stopScanning = stopScanning;
    window.processJSONData = processJSONData;
    window.exportActiveBowls = exportActiveBowls;
    window.exportReturnData = exportReturnData;
    window.exportAllData = exportAllData;
    window.resetTodaysPreparedBowls = resetTodaysPreparedBowls;
    window.getLivePrepReport = getLivePrepReport;
    window.clearActiveInventory = clearActiveInventory;

    initializeFirebase();
});
