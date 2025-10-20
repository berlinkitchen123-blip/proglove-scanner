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

    // 1. Set the placeholder to the error message
    scanInput.placeholder = message;

    // 2. Add an error class for styling (red placeholder text)
    scanInput.classList.add('scanning-error');

    // 3. Set a timer to clear the error and restore the default placeholder
    setTimeout(() => {
        scanInput.classList.remove('scanning-error');

        // Restore default placeholder based on state
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

/**
 * Initializes Firebase using hardcoded keys (for GitHub deployment).
 */
function initializeFirebase() {
    try {
        // Your Firebase Configuration (Pre-inserted for GitHub functionality)
        const HARDCODED_FIREBASE_CONFIG = {
            apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
            authDomain: "proglove-scanner.firebaseapp.com",
            databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "proglove-scanner",
            storageBucket: "proglove-scanner.firebasestorage.app",
            messagingSenderId: "177575768177",
            appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0",
        };

        const firebaseConfig = typeof __firebase_config !== 'undefined' ?
            JSON.parse(__firebase_config) :
            HARDCODED_FIREBASE_CONFIG;

        const appId = firebaseConfig.projectId;

        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            console.error("Firebase library not loaded.");
            showMessage("❌ ERROR: Firebase library not loaded. Check index.html script tags.", 'error');
            return;
        }

        const app = firebase.initializeApp(firebaseConfig);
        window.appData.db = firebase.database();

        // --- NEW: Define separate references to flatten the data structure ---
        const basePath = `artifacts/${appId}/public/data/`;
        window.appData.refActive = firebase.database().ref(`${basePath}active_bowls`);
        window.appData.refPrepared = firebase.database().ref(`${basePath}prepared_bowls`);
        window.appData.refReturned = firebase.database().ref(`${basePath}returned_bowls`);
        window.appData.refScans = firebase.database().ref(`${basePath}scan_logs`);

        // Asynchronously check if data exists and start listener.
        ensureDatabaseInitialized(window.appData.refActive); // Use one ref to check for initialization

        showMessage("✅ Application initialized. Please select an operation mode.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ ERROR: Firebase failed to initialize. Check configuration or Firebase project rules.", 'error');
    }
}

/**
 * Checks for initial data existence and initializes listener. (Asynchronous Fix)
 */
async function ensureDatabaseInitialized(ref) {
    try {
        // Use .once on the *Active Bowls* ref to check for initialization
        const snapshot = await ref.once('value');

        if (!snapshot.exists() || snapshot.val() === null) {
            console.log("🆕 Database structure is empty. Writing initial structure.");

            // Set empty arrays for all core paths to guarantee existence
            await window.appData.refActive.set([]);
            await window.appData.refPrepared.set([]);
            await window.appData.refReturned.set([]);
            await window.appData.refScans.set([]);

            console.log("⬇️ Initial data structure written successfully.");
        } else {
            console.log("⬆️ Database contains existing data.");
        }

        // ONLY after the initial data structure is guaranteed to exist (read or written),
        // we set the flag and start the continuous read listeners.
        window.appData.isInitialized = true;
        loadFromFirebase();

    } catch (error) {
        console.error("CRITICAL ERROR: Failed during initial data check/write. Check rules.", error);
        showMessage("❌ CRITICAL ERROR: Database access failed. Check rules or internet connection.", 'error', 10000);
    }
}


/**
 * Sets up the perpetual Firebase listeners (Continuous Read) for all separate paths.
 */
function loadFromFirebase() {
    // 1. Listen to Active Bowls
    window.appData.refActive.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.activeBowls = snapshot.val() || [];
            updateDisplay();
        }
    });

    // 2. Listen to Prepared Bowls
    window.appData.refPrepared.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.preparedBowls = snapshot.val() || [];
            updateDisplay();
        }
    });

    // 3. Listen to Returned Bowls (History)
    window.appData.refReturned.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.returnedBowls = snapshot.val() || [];
            updateDisplay();
        }
    });

    // 4. Listen to Scan Logs (History/Metrics Source)
    window.appData.refScans.on('value', (snapshot) => {
        if (window.appData.isInitialized) {
            window.appData.myScans = snapshot.val() || [];
            updateDisplay();
            console.log("⬆️ All data synchronized from Firebase.");

            const lastSyncInfoEl = document.getElementById('lastSyncInfo');
            if (lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
        }
    });
}

/**
 * Pushes the current local state to Firebase (Continuous Write) across all relevant paths.
 */
function syncToFirebase() {
    if (!window.appData.isInitialized) {
        console.warn("Sync attempted before full initialization. Skipping write.");
        return;
    }

    // Perform writes only on the arrays that changed.
    // Use Promises to ensure all updates are initiated correctly.
    const writes = [
        window.appData.refActive.set(window.appData.activeBowls),
        window.appData.refPrepared.set(window.appData.preparedBowls),
        window.appData.refReturned.set(window.appData.returnedBowls),
        window.appData.refScans.set(window.appData.myScans),
    ];

    Promise.all(writes)
        .then(() => {
            window.appData.lastSync = new Date().toISOString();
            console.log("⬇️ Data successfully written to Firebase.");
        })
        .catch(error => {
            console.error("Firebase synchronization failed:", error);
            showMessage("❌ ERROR: Data sync failed. Check connection.", 'error');
        });
}

/**
 * Function to manually clear all data in the active inventory (Active Bowls).
 */
function clearActiveInventory() {
    if (!window.appData.isInitialized) {
        showMessage("❌ Cannot clear data. Application not fully initialized.", 'error');
        return;
    }

    const currentCount = window.appData.activeBowls.length;
    if (currentCount === 0) {
        showMessage("ℹ️ Active Inventory is already empty.", 'info');
        return;
    }

    // 1. Clear the local array
    window.appData.activeBowls = [];

    // 2. Sync to Firebase (this clears the data remotely)
    syncToFirebase();

    showMessage(`✅ Successfully cleared ${currentCount} Active Bowl records. Count is now 0.`, 'success', 5000);
}


// --- UI AND MODE MANAGEMENT ---

/**
 * Filters the user dropdown based on the selected mode.
 */
function populateUserDropdown(mode) {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;

    userSelect.innerHTML = '<option value="" disabled selected>-- Select User --</option>';

    if (!mode) return;

    const filteredUsers = USERS.filter(user => user.role.toLowerCase() === mode);

    filteredUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
}

/**
 * Updates all displayed metrics and UI states.
 */
function updateDisplay() {
    // CRITICAL FIX: Do not proceed if DOM is not fully ready 
    if (!window.appData.isDomReady) return;

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

    // 1. Update Mode Display and Button States
    if (window.appData.mode) {
        const modeText = window.appData.mode === 'kitchen' ? 'Status: Kitchen Prep Mode 🍳' : 'Status: Return Scan Mode 🔄';
        if (modeDisplay) {
            modeDisplay.textContent = modeText;
            modeDisplay.classList.remove('bg-gray-500', 'accent-red', 'accent-green');
            modeDisplay.classList.add(window.appData.mode === 'kitchen' ? 'accent-green' : 'accent-red');
        }
        if (userSelectionCard) userSelectionCard.style.opacity = 1;
        if (userSelect) userSelect.disabled = false;

        if (kitchenBtn) kitchenBtn.classList.remove('accent-green', 'btn-neutral');
        if (returnBtn) returnBtn.classList.remove('accent-red', 'btn-neutral');

        if (window.appData.mode === 'kitchen') {
            if (kitchenBtn) kitchenBtn.classList.add('accent-green');
            if (returnBtn) returnBtn.classList.add('btn-neutral');
        } else {
            if (returnBtn) returnBtn.classList.add('accent-red');
            if (kitchenBtn) kitchenBtn.classList.add('btn-neutral');
        }

    } else {
        if (modeDisplay) modeDisplay.textContent = 'Status: Please Select Mode';
        if (userSelectionCard) userSelectionCard.style.opacity = 0.5;
        if (scanningCard) scanningCard.style.opacity = 0.5;
        if (userSelect) userSelect.disabled = true;
        if (kitchenBtn) kitchenBtn.classList.add('btn-neutral');
        if (returnBtn) returnBtn.classList.add('btn-neutral');
    }

    // 2. Dish Section Visibility (Only for Kitchen mode)
    if (dishSection) {
        // If mode is 'kitchen', show it. Otherwise, hide it using the class defined in CSS.
        if (window.appData.mode === 'kitchen') {
            dishSection.classList.remove('hidden');
        } else {
            dishSection.classList.add('hidden');
        }
    }

    // 3. Enable Scanning Controls (Step 3)
    const isReadyToScan = window.appData.mode && window.appData.user && (window.appData.mode === 'return' || window.appData.dishLetter);

    if (isReadyToScan) {
        if (scanningCard) scanningCard.style.opacity = 1;
        if (dishLetterSelect) dishLetterSelect.disabled = false;
        if (scanInput && !scanInput.classList.contains('scanning-error')) {
            scanInput.placeholder = `Ready to Scan in ${window.appData.mode.toUpperCase()} Mode...`;
        }
    } else {
        if (scanningCard) scanningCard.style.opacity = 0.5;
        if (window.appData.mode === 'kitchen' && dishLetterSelect) dishLetterSelect.disabled = !window.appData.user;

        window.appData.scanning = false;
    }


    // --- Core Metrics Update (Global Inventory) ---
    // These metrics are visible at all times and do not depend on the scanning state.

    const activeCountEl = document.getElementById('activeCount');
    if (activeCountEl) activeCountEl.textContent = window.appData.activeBowls.length;

    const preparedTodayCountEl = document.getElementById('preparedTodayCount');
    if (preparedTodayCountEl) preparedTodayCountEl.textContent = window.appData.preparedBowls.length;

    const returnedTodayCount = window.appData.returnedBowls.filter(bowl =>
        bowl.returnDate === today
    ).length;
    const exportReturnCountEl = document.getElementById('exportReturnCount');
    if (exportReturnCountEl) exportReturnCountEl.textContent = window.appData.returnedBowls.length; // Show total history count


    // --- User Scan Count (Kitchen Team Productivity) ---
    // This metric IS dependent on the user and dish selection, but NOT scanning state.
    let myScansCount = 0;
    const { start, end } = getReportingDayTimestamp();

    if (window.appData.user && window.appData.dishLetter) {
        myScansCount = window.appData.myScans.filter(scan =>
            scan.type === 'kitchen' &&
            scan.timestamp >= start && scan.timestamp < end &&
            scan.user === window.appData.user &&
            scan.dishLetter === window.appData.dishLetter
        ).length;
    }

    const myScansCountEl = document.getElementById('myScansCount');
    const myDishLetterLabelEl = document.getElementById('myDishLetterLabel');

    if (myScansCountEl) myScansCountEl.textContent = myScansCount;
    if (myDishLetterLabelEl) myDishLetterLabelEl.textContent = window.appData.dishLetter || '---';

    // Update Scan Status/Input state
    const scanStatusEl = document.getElementById('scanStatus');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (scanStatusEl) scanStatusEl.textContent = window.appData.scanning ? 'Active' : 'Stopped';

    if (scanInput) {
        scanInput.disabled = !window.appData.scanning;
        scanInput.classList.remove('scanning-active');

        if (window.appData.scanning && isReadyToScan) {
            scanInput.classList.add('scanning-active');
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
        } else {
            if (startBtn) startBtn.disabled = !isReadyToScan;
            if (stopBtn) stopBtn.disabled = true;
        }
    }

    const selectedUserEl = document.getElementById('selectedUser');
    if (selectedUserEl) selectedUserEl.textContent = window.appData.user || '---';

    const selectedDishLetterEl = document.getElementById('selectedDishLetter');
    if (selectedDishLetterEl) selectedDishLetterEl.textContent = window.appData.dishLetter || '---';

    const exportActiveCountEl = document.getElementById('exportActiveCount');
    if (exportActiveCountEl) exportActiveCountEl.textContent = window.appData.activeBowls.length;

    const exportPreparedCountEl = document.getElementById('exportPreparedCount');
    if (exportPreparedCountEl) exportPreparedCountEl.textContent = window.appData.preparedBowls.length;

    const livePrepData = getLivePrepReport();
    renderLivePrepReport(livePrepData);
}

/**
 * Handles mode selection (Kitchen or Return).
 */
function setMode(mode) {
    if (mode !== 'kitchen' && mode !== 'return') return;

    window.appData.user = null;
    window.appData.dishLetter = null;

    window.appData.mode = mode;
    stopScanning();

    populateUserDropdown(mode);

    const userSelect = document.getElementById('userSelect');
    if (userSelect) userSelect.value = '';
    const dishLetterSelect = document.getElementById('dishLetterSelect');
    if (dishLetterSelect) dishLetterSelect.value = '';

    showMessage(`Mode switched to: ${mode.toUpperCase()}. Please select a user.`, 'info');
    updateDisplay();
}

/**
 * Handles user selection.
 */
function selectUser(userName) {
    const user = USERS.find(u => u.name === userName);
    if (!user) {
        window.appData.user = null;
        updateDisplay();
        return;
    }

    if (!window.appData.mode) {
        showMessage("❌ ERROR: Please select an Operation Mode (Kitchen/Return) first.", 'error');
        const userSelect = document.getElementById('userSelect');
        if (userSelect) userSelect.value = '';
        return;
    }

    window.appData.user = userName;

    if (window.appData.mode === 'return') {
        window.appData.dishLetter = null;
        showMessage(`User selected: ${userName}. Ready to scan in RETURN mode.`, 'success');
    } else {
        window.appData.dishLetter = null;
        showMessage(`User selected: ${userName}. Please select a Dish Letter.`, 'info');
        const dishLetterSelect = document.getElementById('dishLetterSelect');
        if (dishLetterSelect) dishLetterSelect.value = '';
    }
    updateDisplay();
}

/**
 * Handles dish letter selection (Kitchen mode only).
 */
function selectDishLetter(value) {
    if (window.appData.mode !== 'kitchen' || !window.appData.user) {
        showMessage("❌ ERROR: User or Mode not properly set.", 'error');
        const dishLetterSelect = document.getElementById('dishLetterSelect');
        if (dishLetterSelect) dishLetterSelect.value = '';
        return;
    }

    const upperValue = value.trim().toUpperCase();
    if (DISH_LETTERS.includes(upperValue)) {
        window.appData.dishLetter = upperValue;
        showMessage(`Dish Letter selected: ${upperValue}. Ready to scan.`, 'success');
        updateDisplay();
    } else {
        showMessage("❌ ERROR: Invalid Dish Letter/Number selected.", 'error');
    }
}


// --- Core Scanning, Export, Report, and Maintenance Logic ---

/**
 * Activates the scanner input.
 */
function startScanning() {
    const isReadyToScan = window.appData.mode && window.appData.user && (window.appData.mode === 'return' || window.appData.dishLetter);

    if (!isReadyToScan) {
        showMessage("❌ ERROR: Cannot start scanning. Complete Steps 1 & 2 first.", 'error');
        return;
    }

    window.appData.scanning = true;
    const scanInput = document.getElementById('scanInput');
    // Ensure focus is explicitly set and held for scanner
    if (scanInput) scanInput.focus();
    showMessage("✅ Scanner Activated. Ready to scan.", 'success');
    updateDisplay();
}

/**
 * Deactivates the scanner input.
 */
function stopScanning() {
    window.appData.scanning = false;
    const scanInput = document.getElementById('scanInput');
    if (scanInput) scanInput.blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

/**
 * Main handler for VYT scan input.
 */
function processScan(vytUrl) {
    if (!window.appData.scanning || !window.appData.user) {
        showScanError("❌ ERROR: Scanner not active or user not selected.");
        // ** ADDED FOR COOLDOWN **
        setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
        return;
    }

    // Prevent re-processing while current scan is being handled
    if (window.appData.isProcessingScan) {
        console.warn("Scan in progress. Ignoring current input.");
        return;
    }

    window.appData.isProcessingScan = true; // Set flag to lock processing

    const timestamp = new Date().toISOString();
    const exactVytUrl = vytUrl;

    // --- CRITICAL DUPLICATE CHECK (KITCHEN MODE) ---
    if (window.appData.mode === 'kitchen') {
        const isAlreadyPrepared = window.appData.preparedBowls.some(b => b.vytUrl === exactVytUrl);
        if (isAlreadyPrepared) {
            showScanError("⚠️ DUPLICATE: Already prepared today.");
            setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
            return;
        }
    }

    // --- CRITICAL DUPLICATE CHECK (Return Mode) ---
    if (window.appData.mode === 'return') {
        const isAlreadyReturned = window.appData.returnedBowls.some(b => b.vytUrl === exactVytUrl && formatDateStandard(b.returnDate) === formatDateStandard(timestamp));
        if (isAlreadyReturned) {
            showScanError("⚠️ DUPLICATE: Already returned today.");
            setTimeout(() => { window.appData.isProcessingScan = false; }, 100);
            return;
        }
    }

    const scanRecord = {
        vytUrl: exactVytUrl,
        timestamp: timestamp,
        type: window.appData.mode,
        user: window.appData.user,
        dishLetter: window.appData.mode === 'kitchen' ? window.appData.dishLetter : 'N/A'
    };
    window.appData.myScans.push(scanRecord);

    let result;
    if (window.appData.mode === 'kitchen') {
        result = kitchenScan(exactVytUrl, timestamp);
    } else {
        result = returnScan(exactVytUrl, timestamp);
    }

    if (result.success) {
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showScanError(result.message);
    }
    
    // ** THIS IS THE SECOND MAJOR CHANGE FOR THE 100ms COOLDOWN **
    // Release the processing flag after a 100ms cooldown to prevent rapid re-scans.
    setTimeout(() => {
        window.appData.isProcessingScan = false;
    }, 100);
    
    updateDisplay();
}

/**
 * Handles bowl prep (Kitchen Scan).
 */
function kitchenScan(vytUrl, timestamp) {
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    let statusMessage = "started a new prep cycle.";

    if (activeIndex !== -1) {
        const returnedBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = formatDateStandard(new Date(timestamp));
        window.appData.returnedBowls.push(returnedBowl);
        statusMessage = "closed active cycle and started new prep (Recycled).";
    }

    const newPreparedBowl = {
        vytUrl: vytUrl,
        dishLetter: window.appData.dishLetter,
        company: 'Unknown',
        customer: 'Unknown',
        preparedDate: formatDateStandard(new Date(timestamp)),
        preparedTime: timestamp,
        user: window.appData.user,
        state: 'PREPARED_UNKNOWN'
    };
    window.appData.preparedBowls.push(newPreparedBowl);

    return {
        success: true,
        message: `✅ Kitchen Prep: ${vytUrl.slice(-10)} assigned to Dish ${window.appData.dishLetter}. Cycle: ${statusMessage}`
    };
}

/**
 * Handles bowl return (Return Scan).
 */
function returnScan(vytUrl, timestamp) {
    const returnDate = formatDateStandard(new Date(timestamp));

    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    if (preparedIndex !== -1) {
        const returnedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        window.appData.returnedBowls.push(returnedBowl);
        return {
            success: true,
            message: `📦 Returned: ${vytUrl.slice(-10)} (Was Prepared). Available for next prep.`
        };
    }

    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    if (activeIndex !== -1) {
        const returnedBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        window.appData.returnedBowls.push(returnedBowl);
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

/**
 * Flattens the complex JSON delivery order into an array of simple bowl records, 
 * grouping users with the same dish into a single record.
 * @param {object} order The single, nested order object.
 * @returns {Array} An array of flattened bowl records.
 */
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
            if (dishLabel === 'ADDONS') continue;
            
            const codes = dish.bowlCodes && Array.isArray(dish.bowlCodes) && dish.bowlCodes.length > 0 ? dish.bowlCodes : [];
            if (!dish.users || !Array.isArray(dish.users) || dish.users.length === 0) continue;

            const usernames = dish.users.map(user => String(user.username || user.id).trim());
            const preparedDate = order.readyTime;

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
        flattenedBowls.push({
            ...record,
            customer: record.customer.join(', ')
        });
    });
    return flattenedBowls;
}

/**
 * Processes JSON customer data to convert Prepared Bowls to Active Bowls.
 */
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
    ordersToProcess.forEach(order => {
        allFlattenedBowls = allFlattenedBowls.concat(flattenOrderData(order));
    });
    
    if (allFlattenedBowls.length === 0) {
        showMessage("❌ ERROR: No assignable bowl records found.", 'error');
        return;
    }

    let updates = 0;
    let creations = 0;
    const timestamp = new Date().toISOString();

    for (const item of allFlattenedBowls) {
        const exactVytUrl = item.vytUrl;
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const jsonAssignmentDate = formatDateStandard(item.preparedDate || timestamp);

        if (activeIndex !== -1) {
            const activeBowl = window.appData.activeBowls[activeIndex];
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();
            activeBowl.preparedDate = jsonAssignmentDate;
            activeBowl.updateTime = timestamp;
            updates++;
        } else if (preparedIndex !== -1) {
            const preparedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
            const activeBowl = {
                ...preparedBowl,
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: jsonAssignmentDate,
                updateTime: timestamp,
                state: 'ACTIVE_KNOWN'
            };
            window.appData.activeBowls.push(activeBowl);
            creations++;
        } else {
            const newBowl = {
                vytUrl: exactVytUrl,
                dishLetter: item.dishLetter,
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: jsonAssignmentDate,
                preparedTime: timestamp,
                user: 'SYSTEM',
                state: 'ACTIVE_KNOWN'
            };
            window.appData.activeBowls.push(newBowl);
            creations++;
        }
    }

    if (updates > 0 || creations > 0) {
        showMessage(`✅ JSON Import Complete: ${creations} new active, ${updates} updated.`, 'success', 5000);
        syncToFirebase();
        document.getElementById('jsonData').value = '';
    } else {
        showMessage("ℹ️ No bowls updated or created.", 'info');
    }
}

/**
 * Exports data structures as CSV files (for Excel/Spreadsheets).
 */
function exportData(data, filename, source) {
    if (!data || data.length === 0) {
        showMessage(`ℹ️ Cannot export. ${source} is empty.`, 'warning');
        return;
    }

    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';

    data.forEach(row => {
        const values = headers.map(header => {
            let value = String(row[header] || '').replace(/"/g, '""');
            if (value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    showMessage(`💾 Exported to ${filename}`, 'success');
}

function exportActiveBowls() {
    exportData(window.appData.activeBowls, `active_bowls_${formatDateStandard(new Date())}.csv`, 'Active Bowls');
}

function exportReturnData() {
    exportData(window.appData.returnedBowls, `returned_bowls_${formatDateStandard(new Date())}.csv`, 'Returned Bowls');
}

function exportAllData() {
    const fullData = [
        ...window.appData.activeBowls.map(b => ({ ...b, source: 'Active' })),
        ...window.appData.preparedBowls.map(b => ({ ...b, source: 'Prepared' })),
        ...window.appData.returnedBowls.map(b => ({ ...b, source: 'Returned' })),
    ];
    exportData(fullData, `all_combined_bowl_data_${formatDateStandard(new Date())}.csv`, 'Combined Data');
}

/**
 * Calculates LIVE statistics for prepared dishes (Kitchen Scans), sorted by Dish Letter then User.
 */
function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();
    const todaysKitchenScans = window.appData.myScans.filter(scan => scan.type === 'kitchen' && scan.timestamp >= start && scan.timestamp < end);
    const groupedData = todaysKitchenScans.reduce((acc, scan) => {
        if (!acc[scan.dishLetter]) {
            acc[scan.dishLetter] = { users: new Map(), count: 0 };
        }
        acc[scan.dishLetter].users.set(scan.user, (acc[scan.dishLetter].users.get(scan.user) || 0) + 1);
        acc[scan.dishLetter].count++;
        return acc;
    }, {});
    return Object.entries(groupedData)
        .map(([dishLetter, data]) => ({
            dishLetter,
            ...data,
            users: Array.from(data.users.entries(), ([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => DISH_LETTERS.indexOf(a.dishLetter) - DISH_LETTERS.indexOf(b.dishLetter));
}

/**
 * Renders the live statistics table.
 */
function renderLivePrepReport(stats) {
    const container = document.getElementById('livePrepReportBody');
    if (!container) return;

    if (stats.length === 0) {
        container.innerHTML = `<tr><td colspan="3" class="px-3 py-2 text-center text-gray-400">No kitchen scans recorded today.</td></tr>`;
        return;
    }

    container.innerHTML = stats.flatMap(dish => 
        dish.users.map((user, index) => `
            <tr class="hover:bg-gray-700">
                ${index === 0 ? `<td rowspan="${dish.users.length}" class="px-3 py-2 font-bold text-center border-r border-gray-700 text-pink-400">${dish.dishLetter}</td>` : ''}
                <td class="px-3 py-2 text-gray-300">${user.name}</td>
                <td class="px-3 py-2 text-center font-bold text-gray-200">${user.count}</td>
            </tr>
        `)
    ).join('');
}


/**
 * Manually resets prepared bowls and scan history for the current reporting cycle.
 */
function resetTodaysPreparedBowls() {
    const { start } = getReportingDayTimestamp();
    const preparedCount = window.appData.preparedBowls.length;
    const scansToRemove = window.appData.myScans.filter(s => s.type === 'kitchen' && s.timestamp >= start).length;
    
    window.appData.preparedBowls = [];
    window.appData.myScans = window.appData.myScans.filter(s => !(s.type === 'kitchen' && s.timestamp >= start));

    if (preparedCount > 0 || scansToRemove > 0) {
        syncToFirebase();
        showMessage(`✅ Reset Successful: ${preparedCount} prepared bowls & ${scansToRemove} kitchen scans removed.`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls or scans found to remove.', 'info');
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
        // ** THIS IS THE ONLY CHANGE FROM YOUR ORIGINAL FILE **
        // This replaces both old listeners with one that works for ProGlove.
        scanInput.addEventListener('input', () => {
            if (window.appData.scanTimer) {
                clearTimeout(window.appData.scanTimer);
            }
            window.appData.scanTimer = setTimeout(() => {
                const scannedValue = scanInput.value.trim();
                scanInput.value = ''; // Clear input immediately
                if (scannedValue.length > 5 && window.appData.scanning && !window.appData.isProcessingScan) {
                    processScan(scannedValue);
                }
            }, 50); // 50ms debounce timer
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


