// --- GLOBAL STATE ---
window.appData = {
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
    // CRITICAL FIX: Breaking the data into separate references to avoid the 32MB limit
    appDataRef: null,
    refActive: null,
    refPrepared: null,
    refReturned: null,
    refScans: null,

    lastDataReset: null,
    lastSync: null,
    isDomReady: false,
    isInitialized: false,
    scanTimer: null, // Timer used for debouncing input
    isProcessingScan: false, // FLAG: Prevents the app from accepting new scans during the sync operation
};

const USERS = [
    { name: "Hamid", role: "Kitchen" }, { name: "Richa", role: "Kitchen" },
    { name: "Jash", role: "Kitchen" }, { name: "Joel", role: "Kitchen" },
    { name: "Mary", role: "Kitchen" }, { name: "Rushal", role: "Kitchen" },
    { name: "Sreekanth", role: "Kitchen" },
    { name: "Sultan", role: "Return" },
    { name: "Riyaz", role: "Return" }, { name: "Alan", role: "Return" },
    { name: "Adesh", role: "Return" }
];

const DISH_LETTERS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '1', '2', '3', '4'
];

// --- UTILITY FUNCTIONS ---
/**
 * Converts an ISO timestamp or Date object to the standard YYYY-MM-DD format.
 */
function formatDateStandard(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

/**
 * CALCULATES THE 24-HOUR REPORTING WINDOW (10 PM Yesterday to 10 PM Today).
 */
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

/**
 * Displays user feedback messages with colors.
 */
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

/**
 * Displays an error message inside the scanner input placeholder.
 */
function showScanError(message) {
    const scanInput = document.getElementById('scanInput');
    if (!scanInput) return; // Failsafe

    scanInput.placeholder = message;
    scanInput.classList.add('scanning-error');

    setTimeout(() => {
        scanInput.classList.remove('scanning-error');
        const isReadyToScan = window.appData.mode && window.appData.user && (window.appData.mode === 'return' || window.appData.dishLetter);
        if (!window.appData.scanning) {
            scanInput.placeholder = "Scanner stopped.";
        } else if (isReadyToScan) {
            scanInput.placeholder = `Ready to Scan in ${window.appData.mode.toUpperCase()} Mode...`;
        } else {
            scanInput.placeholder = 'Complete steps 1 & 2 to enable scanning...';
        }
    }, 4000); // 4-second duration for errors
}


// --- FIREBASE SETUP & SYNC ---
function initializeFirebase() {
    try {
        const HARDCODED_FIREBASE_CONFIG = {
            apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
            authDomain: "proglove-scanner.firebaseapp.com",
            databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "proglove-scanner",
            storageBucket: "proglove-scanner.firebasestorage.app",
            messagingSenderId: "177575768177",
            appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0",
        };
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : HARDCODED_FIREBASE_CONFIG;
        const appId = firebaseConfig.projectId;
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            showMessage("❌ ERROR: Firebase library not loaded.", 'error');
            return;
        }
        const app = firebase.initializeApp(firebaseConfig);
        window.appData.db = firebase.database();
        const basePath = `artifacts/${appId}/public/data/`;
        window.appData.refActive = firebase.database().ref(`${basePath}active_bowls`);
        window.appData.refPrepared = firebase.database().ref(`${basePath}prepared_bowls`);
        window.appData.refReturned = firebase.database().ref(`${basePath}returned_bowls`);
        window.appData.refScans = firebase.database().ref(`${basePath}scan_logs`);
        ensureDatabaseInitialized(window.appData.refActive);
        showMessage("✅ Application initialized. Please select an operation mode.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ ERROR: Firebase failed to initialize.", 'error');
    }
}

async function ensureDatabaseInitialized(ref) {
    try {
        const snapshot = await ref.once('value');
        if (!snapshot.exists() || snapshot.val() === null) {
            await window.appData.refActive.set([]);
            await window.appData.refPrepared.set([]);
            await window.appData.refReturned.set([]);
            await window.appData.refScans.set([]);
        }
        window.appData.isInitialized = true;
        loadFromFirebase();
    } catch (error) {
        console.error("CRITICAL ERROR: Failed during initial data check/write.", error);
        showMessage("❌ CRITICAL ERROR: Database access failed.", 'error', 10000);
    }
}

function loadFromFirebase() {
    window.appData.refActive.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.activeBowls = snapshot.val() || [];
            updateDisplay();
        }
    });
    window.appData.refPrepared.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.preparedBowls = snapshot.val() || [];
            updateDisplay();
        }
    });
    window.appData.refReturned.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.returnedBowls = snapshot.val() || [];
            updateDisplay();
        }
    });
    window.appData.refScans.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.myScans = snapshot.val() || [];
            updateDisplay();
            const lastSyncInfoEl = document.getElementById('lastSyncInfo');
            if (lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
        }
    });
}

function syncToFirebase() {
    if (!window.appData.isInitialized) return;
    const writes = [
        window.appData.refActive.set(window.appData.activeBowls),
        window.appData.refPrepared.set(window.appData.preparedBowls),
        window.appData.refReturned.set(window.appData.returnedBowls),
        window.appData.refScans.set(window.appData.myScans),
    ];
    Promise.all(writes).catch(error => {
        console.error("Firebase synchronization failed:", error);
        showMessage("❌ ERROR: Data sync failed.", 'error');
    });
}

function clearActiveInventory() {
    if (!window.appData.isInitialized) {
        showMessage("❌ Cannot clear data.", 'error');
        return;
    }
    const currentCount = window.appData.activeBowls.length;
    if (currentCount === 0) {
        showMessage("ℹ️ Active Inventory is already empty.", 'info');
        return;
    }
    window.appData.activeBowls = [];
    syncToFirebase();
    showMessage(`✅ Cleared ${currentCount} Active Bowl records.`, 'success', 5000);
}

// --- UI AND MODE MANAGEMENT ---
function populateUserDropdown(mode) {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;
    userSelect.innerHTML = '<option value="" disabled selected>-- Select User --</option>';
    if (!mode) return;
    USERS.filter(user => user.role.toLowerCase() === mode).forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
}

function updateDisplay() {
    if (!window.appData.isDomReady) return;
    const modeDisplay = document.getElementById('modeDisplay');
    const kitchenBtn = document.getElementById('kitchenBtn');
    const returnBtn = document.getElementById('returnBtn');
    const dishSection = document.getElementById('dishSection');
    const userSelect = document.getElementById('userSelect');
    const dishLetterSelect = document.getElementById('dishLetterSelect');
    const scanInput = document.getElementById('scanInput');
    const scanningCard = document.getElementById('scanningCard');
    const userSelectionCard = document.getElementById('userSelectionCard');
    if (window.appData.mode) {
        modeDisplay.textContent = window.appData.mode === 'kitchen' ? 'Status: Kitchen Prep Mode 🍳' : 'Status: Return Scan Mode 🔄';
        modeDisplay.className = `status-box mt-4 ${window.appData.mode === 'kitchen' ? 'accent-green' : 'accent-red'}`;
        userSelectionCard.style.opacity = 1;
        userSelect.disabled = false;
        kitchenBtn.className = `mode-button flex-1 ${window.appData.mode === 'kitchen' ? 'accent-green' : 'btn-neutral hover-green'}`;
        returnBtn.className = `mode-button flex-1 ${window.appData.mode === 'return' ? 'accent-red' : 'btn-neutral hover-red'}`;
    } else {
        modeDisplay.textContent = 'Status: Please Select Mode';
        modeDisplay.className = 'status-box status-neutral mt-4';
        userSelectionCard.style.opacity = 0.5;
        scanningCard.style.opacity = 0.5;
        userSelect.disabled = true;
        kitchenBtn.className = 'mode-button btn-neutral hover-green flex-1';
        returnBtn.className = 'mode-button btn-neutral hover-red flex-1';
    }
    dishSection.classList.toggle('hidden', window.appData.mode !== 'kitchen');
    const isReadyToScan = window.appData.mode && window.appData.user && (window.appData.mode === 'return' || window.appData.dishLetter);
    scanningCard.style.opacity = isReadyToScan ? 1 : 0.5;
    if (dishLetterSelect) dishLetterSelect.disabled = window.appData.mode !== 'kitchen' || !window.appData.user;
    if (scanInput && !scanInput.classList.contains('scanning-error')) {
        scanInput.placeholder = isReadyToScan ? `Ready to Scan in ${window.appData.mode.toUpperCase()} Mode...` : 'Complete Steps 1 & 2...';
    }
    window.appData.scanning = isReadyToScan && window.appData.scanning;
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;
    document.getElementById('preparedTodayCount').textContent = window.appData.preparedBowls.length;
    document.getElementById('exportReturnCount').textContent = window.appData.returnedBowls.length;
    const { start, end } = getReportingDayTimestamp();
    const myScansCount = window.appData.user && window.appData.dishLetter ? window.appData.myScans.filter(s => s.type === 'kitchen' && s.timestamp >= start && s.timestamp < end && s.user === window.appData.user && s.dishLetter === window.appData.dishLetter).length : 0;
    document.getElementById('myScansCount').textContent = myScansCount;
    document.getElementById('myDishLetterLabel').textContent = window.appData.dishLetter || '---';
    scanInput.disabled = !window.appData.scanning;
    scanInput.classList.toggle('scanning-active', window.appData.scanning);
    document.getElementById('startBtn').disabled = !isReadyToScan || window.appData.scanning;
    document.getElementById('stopBtn').disabled = !window.appData.scanning;
    renderLivePrepReport(getLivePrepReport());
}

function setMode(mode) {
    if (mode !== 'kitchen' && mode !== 'return') return;
    window.appData.mode = mode;
    window.appData.user = null;
    window.appData.dishLetter = null;
    stopScanning();
    populateUserDropdown(mode);
    document.getElementById('userSelect').value = '';
    const dishSelect = document.getElementById('dishLetterSelect');
    if (dishSelect) dishSelect.value = '';
    showMessage(`Mode: ${mode.toUpperCase()}. Select user.`, 'info');
    updateDisplay();
}

function selectUser(userName) {
    if (!USERS.find(u => u.name === userName)) {
        window.appData.user = null;
        updateDisplay();
        return;
    }
    if (!window.appData.mode) {
        showMessage("❌ Select Mode first.", 'error');
        document.getElementById('userSelect').value = '';
        return;
    }
    window.appData.user = userName;
    if (window.appData.mode === 'return') {
        window.appData.dishLetter = null;
        showMessage(`User: ${userName}. Ready to scan.`, 'success');
    } else {
        window.appData.dishLetter = null;
        showMessage(`User: ${userName}. Select Dish Letter.`, 'info');
        const dishSelect = document.getElementById('dishLetterSelect');
        if (dishSelect) dishSelect.value = '';
    }
    updateDisplay();
}

function selectDishLetter(value) {
    if (window.appData.mode !== 'kitchen' || !window.appData.user) {
        showMessage("❌ Set User/Mode.", 'error');
        document.getElementById('dishLetterSelect').value = '';
        return;
    }
    if (DISH_LETTERS.includes(value.trim().toUpperCase())) {
        window.appData.dishLetter = value.trim().toUpperCase();
        showMessage(`Dish: ${window.appData.dishLetter}. Ready to scan.`, 'success');
    } else {
        showMessage("❌ Invalid Dish.", 'error');
    }
    updateDisplay();
}

// --- Core Scanning, Export, Report, and Maintenance Logic ---
function startScanning() {
    const isReadyToScan = window.appData.mode && window.appData.user && (window.appData.mode === 'return' || window.appData.dishLetter);
    if (!isReadyToScan) {
        showMessage("❌ Complete Steps 1 & 2.", 'error');
        return;
    }
    window.appData.scanning = true;
    document.getElementById('scanInput').focus();
    showMessage("✅ Scanner Activated.", 'success');
    updateDisplay();
}

function stopScanning() {
    window.appData.scanning = false;
    document.getElementById('scanInput').blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

function processScan(vytUrl) {
    if (window.appData.isProcessingScan) return;
    if (!window.appData.scanning || !window.appData.user) {
        showScanError("❌ Scanner not active.");
        return;
    }
    window.appData.isProcessingScan = true;
    
    const timestamp = new Date().toISOString();
    
    if (window.appData.mode === 'kitchen' && window.appData.preparedBowls.some(b => b.vytUrl === vytUrl)) {
        showScanError("⚠️ DUPLICATE: Already prepared.");
        setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
        return;
    }
    if (window.appData.mode === 'return' && window.appData.returnedBowls.some(b => b.vytUrl === vytUrl && b.returnDate === formatDateStandard(timestamp))) {
        showScanError("⚠️ DUPLICATE: Already returned.");
        setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
        return;
    }

    window.appData.myScans.push({
        vytUrl, timestamp,
        type: window.appData.mode,
        user: window.appData.user,
        dishLetter: window.appData.mode === 'kitchen' ? window.appData.dishLetter : 'N/A'
    });

    const result = window.appData.mode === 'kitchen' ? kitchenScan(vytUrl, timestamp) : returnScan(vytUrl, timestamp);

    if (result.success) {
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showScanError(result.message);
    }
    
    setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
    updateDisplay();
}

function kitchenScan(vytUrl, timestamp) {
    let statusMessage = "new prep cycle.";
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    if (activeIndex !== -1) {
        const recycledBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        recycledBowl.returnDate = formatDateStandard(timestamp);
        window.appData.returnedBowls.push(recycledBowl);
        statusMessage = "recycled from active.";
    }
    window.appData.preparedBowls.push({
        vytUrl,
        dishLetter: window.appData.dishLetter,
        preparedDate: formatDateStandard(timestamp),
        preparedTime: timestamp,
        user: window.appData.user,
        state: 'PREPARED_UNKNOWN'
    });
    return { success: true, message: `✅ Prep: ${vytUrl.slice(-10)} (${statusMessage})` };
}

function returnScan(vytUrl, timestamp) {
    const returnDate = formatDateStandard(timestamp);
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    if (preparedIndex !== -1) {
        const returned = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
        returned.returnDate = returnDate;
        window.appData.returnedBowls.push(returned);
        return { success: true, message: `📦 Return: ${vytUrl.slice(-10)} (from Prepared)` };
    }
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    if (activeIndex !== -1) {
        const returned = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returned.returnDate = returnDate;
        window.appData.returnedBowls.push(returned);
        return { success: true, message: `📦 Return: ${vytUrl.slice(-10)} (from Active)` };
    }
    return { success: false, message: `❌ NOT FOUND: ${vytUrl.slice(-10)}` };
}

function flattenOrderData(order) {
    if (!order || !order.boxes) return [];
    const companyName = String(order.name || '').trim();
    const dishMap = new Map();
    for (const box of order.boxes) {
        for (const dish of (box.dishes || [])) {
            const dishLabel = String(dish.label || '').trim().toUpperCase();
            if (dishLabel === 'ADDONS' || !dish.bowlCodes || dish.bowlCodes.length === 0) continue;
            for (const vytUrl of dish.bowlCodes) {
                const safeUrl = vytUrl.trim();
                if (!dishMap.has(safeUrl)) {
                    dishMap.set(safeUrl, { vytUrl: safeUrl, dishLetter: dishLabel, company: companyName, customers: new Set() });
                }
                for (const user of (dish.users || [])) {
                    dishMap.get(safeUrl).customers.add(String(user.username || user.id).trim());
                }
            }
        }
    }
    return Array.from(dishMap.values()).map(d => ({ ...d, customer: Array.from(d.customers).join(', ') }));
}

function processJSONData(jsonString) {
    if (!jsonString || jsonString.trim() === '') {
        return showMessage("❌ JSON empty.", 'error');
    }
    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        return showMessage("❌ Invalid JSON.", 'error');
    }
    const orders = Array.isArray(data) ? data : [data];
    const bowls = orders.flatMap(flattenOrderData);
    if (bowls.length === 0) return showMessage("ℹ️ No scannable bowls in JSON.", 'info');

    let creations = 0, updates = 0;
    const now = new Date().toISOString();
    bowls.forEach(item => {
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === item.vytUrl);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === item.vytUrl);
        const assignmentDate = formatDateStandard(item.preparedDate || now);
        if (activeIndex !== -1) {
            Object.assign(window.appData.activeBowls[activeIndex], { company: item.company, customer: item.customer, preparedDate: assignmentDate, updateTime: now });
            updates++;
        } else if (preparedIndex !== -1) {
            const bowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
            Object.assign(bowl, { company: item.company, customer: item.customer, preparedDate: assignmentDate, updateTime: now, state: 'ACTIVE_KNOWN' });
            window.appData.activeBowls.push(bowl);
            creations++;
        } else {
            window.appData.activeBowls.push({ vytUrl: item.vytUrl, dishLetter: item.dishLetter, company: item.company, customer: item.customer, preparedDate: assignmentDate, preparedTime: now, user: 'SYSTEM', state: 'ACTIVE_KNOWN' });
            creations++;
        }
    });
    if (creations > 0 || updates > 0) {
        showMessage(`✅ JSON: ${creations} created, ${updates} updated.`, 'success');
        syncToFirebase();
        document.getElementById('jsonData').value = '';
    } else {
        showMessage("ℹ️ No changes from JSON.", 'info');
    }
}

function exportData(data, filename, source) {
    if (!data || data.length === 0) return showMessage(`ℹ️ ${source} is empty.`, 'warning');
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    showMessage(`💾 Exported ${source}.`, 'success');
}

function exportActiveBowls() { exportData(window.appData.activeBowls, `active_bowls_${formatDateStandard(new Date())}.csv`, 'Active Bowls'); }
function exportReturnData() { exportData(window.appData.returnedBowls, `returned_bowls_${formatDateStandard(new Date())}.csv`, 'Returned Bowls'); }
function exportAllData() {
    exportData([
        ...window.appData.activeBowls.map(b => ({ ...b, source: 'Active' })),
        ...window.appData.preparedBowls.map(b => ({ ...b, source: 'Prepared' })),
        ...window.appData.returnedBowls.map(b => ({ ...b, source: 'Returned' })),
    ], `all_data_${formatDateStandard(new Date())}.csv`, 'All Data');
}

function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();
    const scans = window.appData.myScans.filter(s => s.type === 'kitchen' && s.timestamp >= start && s.timestamp < end);
    const report = scans.reduce((acc, { dishLetter, user }) => {
        if (!acc[dishLetter]) acc[dishLetter] = { users: {} };
        acc[dishLetter].users[user] = (acc[dishLetter].users[user] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(report).map(([dishLetter, data]) => ({
        dishLetter, users: Object.entries(data.users).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => DISH_LETTERS.indexOf(a.dishLetter) - DISH_LETTERS.indexOf(b.dishLetter));
}

function renderLivePrepReport(stats) {
    const body = document.getElementById('livePrepReportBody');
    if (!body) return;
    if (stats.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="text-center text-gray-400 p-2">No kitchen scans in this cycle.</td></tr>';
        return;
    }
    body.innerHTML = stats.flatMap(({ dishLetter, users }) =>
        users.map((user, i) => `
            <tr class="hover:bg-gray-700">
                ${i === 0 ? `<td rowspan="${users.length}" class="font-bold text-center text-pink-400 p-2 border-r border-gray-700">${dishLetter}</td>` : ''}
                <td class="p-2">${user.name}</td>
                <td class="text-center font-bold p-2">${user.count}</td>
            </tr>
        `).join('')
    ).join('');
}

function resetTodaysPreparedBowls() {
    const { start } = getReportingDayTimestamp();
    const originalPreparedCount = window.appData.preparedBowls.length;
    const originalScansCount = window.appData.myScans.length;
    window.appData.preparedBowls = [];
    window.appData.myScans = window.appData.myScans.filter(s => !(s.type === 'kitchen' && s.timestamp >= start));
    const removedScans = originalScansCount - window.appData.myScans.length;
    if (originalPreparedCount > 0 || removedScans > 0) {
        showMessage(`✅ Reset: ${originalPreparedCount} prepared & ${removedScans} scans removed.`, 'success');
        syncToFirebase();
    } else {
        showMessage("ℹ️ Nothing to reset.", 'info');
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    window.appData.isDomReady = true;

    const dishLetterSelect = document.getElementById('dishLetterSelect');
    if (dishLetterSelect) {
        DISH_LETTERS.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            dishLetterSelect.appendChild(option);
        });
    }

    const scanInput = document.getElementById('scanInput');
    if (scanInput) {
        // 💥 FINAL, CORRECTED SCANNER LOGIC 💥
        scanInput.addEventListener('input', () => {
            if (window.appData.scanTimer) {
                clearTimeout(window.appData.scanTimer);
            }
            window.appData.scanTimer = setTimeout(() => {
                const scannedValue = scanInput.value.trim();
                scanInput.value = ''; // Clear input immediately
                if (scannedValue.length > 5) {
                    processScan(scannedValue);
                }
            }, 50); // 50ms debounce timer as requested
        });
    }

    document.addEventListener('keydown', (e) => {
        const scanInput = document.getElementById('scanInput');
        if (window.appData.scanning && scanInput && document.activeElement !== scanInput && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
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
    window.resetTodaysPreparedBowls = resetTodaysPreparedBowls;
    window.getLivePrepReport = getLivePrepReport;
    window.clearActiveInventory = clearActiveInventory;

    initializeFirebase();
});


