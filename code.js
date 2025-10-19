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

        const firebaseConfig = typeof __firebase_config !== 'undefined' 
            ? JSON.parse(__firebase_config) 
            : HARDCODED_FIREBASE_CONFIG;
        
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
            if(lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
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
        if(modeDisplay) {
            modeDisplay.textContent = modeText;
            modeDisplay.classList.remove('bg-gray-500', 'accent-red', 'accent-green');
            modeDisplay.classList.add(window.appData.mode === 'kitchen' ? 'accent-green' : 'accent-red');
        }
        if(userSelectionCard) userSelectionCard.style.opacity = 1; 
        if(userSelect) userSelect.disabled = false;

        if(kitchenBtn) kitchenBtn.classList.remove('accent-green', 'btn-neutral');
        if(returnBtn) returnBtn.classList.remove('accent-red', 'btn-neutral');

        if (window.appData.mode === 'kitchen') {
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
        if(scanningCard) scanningCard.style.opacity = 1;
        if(dishLetterSelect) dishLetterSelect.disabled = false;
        if (scanInput) scanInput.placeholder = `Ready to Scan in ${window.appData.mode.toUpperCase()} Mode...`;
    } else {
        if(scanningCard) scanningCard.style.opacity = 0.5;
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

    if(scanStatusEl) scanStatusEl.textContent = window.appData.scanning ? 'Active' : 'Stopped';

    if(scanInput) {
        scanInput.disabled = !window.appData.scanning;
        scanInput.classList.remove('scanning-active');
        
        if (window.appData.scanning && isReadyToScan) {
            scanInput.classList.add('scanning-active');
            if(startBtn) startBtn.disabled = true;
            if(stopBtn) stopBtn.disabled = false;
        } else {
            if(startBtn) startBtn.disabled = !isReadyToScan;
            if(stopBtn) stopBtn.disabled = true;
        }
    }
    
    const selectedUserEl = document.getElementById('selectedUser');
    if(selectedUserEl) selectedUserEl.textContent = window.appData.user || '---';
    
    const selectedDishLetterEl = document.getElementById('selectedDishLetter');
    if(selectedDishLetterEl) selectedDishLetterEl.textContent = window.appData.dishLetter || '---';
    
    const exportActiveCountEl = document.getElementById('exportActiveCount');
    if(exportActiveCountEl) exportActiveCountEl.textContent = window.appData.activeBowls.length;
    
    const exportPreparedCountEl = document.getElementById('exportPreparedCount');
    if(exportPreparedCountEl) exportPreparedCountEl.textContent = window.appData.preparedBowls.length;
    
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
        if(userSelect) userSelect.value = ''; 
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
        if(dishLetterSelect) dishLetterSelect.value = ''; 
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
         if(dishLetterSelect) dishLetterSelect.value = ''; 
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
    if(scanInput) scanInput.focus();
    showMessage("✅ Scanner Activated. Ready to scan.", 'success');
    updateDisplay();
}

/**
 * Deactivates the scanner input.
 */
function stopScanning() {
    window.appData.scanning = false;
    const scanInput = document.getElementById('scanInput');
    if(scanInput) scanInput.blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

/**
 * Main handler for VYT scan input.
 */
function processScan(vytUrl) {
    if (!window.appData.scanning || !window.appData.user) {
        showMessage("❌ ERROR: Scanner not active or user not selected.", 'error');
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
        showMessage(result.message, 'error');
    }
    
    window.appData.isProcessingScan = false; // Release flag after sync starts
    updateDisplay(); 
}

/**
 * Handles bowl prep (Kitchen Scan).
 */
function kitchenScan(vytUrl, timestamp) {
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    
    let statusMessage = "started a new prep cycle.";

    if (activeIndex !== -1) {
        const returnedBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = formatDateStandard(new Date(timestamp));
        window.appData.returnedBowls.push(returnedBowl);
        statusMessage = "closed active cycle and started new prep.";
    }
    
    if (preparedIndex !== -1) {
        window.appData.preparedBowls.splice(preparedIndex, 1);
        statusMessage = "closed old prepared record and started new prep.";
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
        message: `❌ ERROR: ${vytUrl.slice(-10)} not found in Prepared or Active inventory.` 
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
    
    // Safety checks for crucial top-level fields
    if (!order || !order.id || !order.name || !order.boxes || !Array.isArray(order.boxes)) {
        console.warn("Invalid or incomplete top-level order data, skipping order.", order);
        return [];
    }

    const companyName = String(order.name).trim();
    const orderId = order.id;

    // Use a Map to group dishes by their unique physical VYT URL
    const dishVytMap = new Map();

    for (const box of order.boxes) {
        if (!box.dishes || !Array.isArray(box.dishes)) continue;

        for (const dish of box.dishes) {
            
            // 🛑 EXPLICITLY SKIP ADDONS 🛑
            const dishLabel = String(dish.label || 'N/A').trim().toUpperCase();
            if (dishLabel === 'ADDONS') {
                continue; 
            }
            
            // CRITICAL: Determine the VYT URL source. 
            const codes = dish.bowlCodes && Array.isArray(dish.bowlCodes) && dish.bowlCodes.length > 0
                ? dish.bowlCodes
                : [];
            
            // Get standard dish fields
            const dishIdentifier = String(dish.label || dish.name || dish.id || 'N/A').trim().toUpperCase();
            // FIX: Ensure safeDishId is always a guaranteed unique string fallback
            const safeDishId = String(dish.id || dishIdentifier).substring(0, 10).toUpperCase();
            
            if (!dish.users || !Array.isArray(dish.users)) continue;
            
            // Map users to get an array of just usernames/IDs
            const usernames = dish.users.map(user => String(user.username || user.id).trim());
            const preparedDate = order.readyTime;
            
            // 💥 FIX: Skip if there are no usernames associated with the dish. 💥
            if (usernames.length === 0) continue; 

            // --- 1. HANDLE VYT CODES (Preferred - One record per VYT Code) ---
            if (codes.length > 0) {
                for (const vytUrl of codes) {
                    const safeVytUrl = vytUrl.trim(); // Preserve original URL format for scanning/export

                    const existingRecord = dishVytMap.get(safeVytUrl);

                    if (existingRecord) {
                        // FIX: Ensure customer is an array before concat; merge customer list
                        existingRecord.customer = Array.from(existingRecord.customer).concat(usernames);
                    } else {
                        // Create a new unique record for this specific VYT URL
                        dishVytMap.set(safeVytUrl, {
                            vytUrl: safeVytUrl, 
                            dishLetter: dishLabel,
                            company: companyName,
                            customer: usernames, // Store array of users temporarily
                            preparedDate: preparedDate,
                        });
                    }
                }
            } 
            // --- 2. 🛑 IGNORE VIRTUAL VYT CODES (Per User Request) ---
            // If bowlCodes is empty, we skip the item to ensure the final patched count is 990.
            // All logic related to creating VIRTUAL IDs is removed here.
        }
    }
    
    // Convert the map entries into final bowl records
    dishVytMap.forEach(record => {
        // Concatenate all customer names into a single string for the 'customer' field
        const customerString = record.customer.join(', ');

        // Push the final record (one record per unique VYT URL)
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

/**
 * Processes JSON customer data to convert Prepared Bowls to Active Bowls.
 */
function processJSONData(jsonString) {
    // NOTE: User selection is NO LONGER required for this management function.
    
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
    
    // Normalize input to an array of order objects
    const ordersToProcess = Array.isArray(rawData) ? rawData : [rawData];
    
    let allFlattenedBowls = [];
    let totalItemsExpected = 0; // This metric now accurately reflects the total scannable items (VYT codes)

    // Flatten all nested orders into a single list of assignable bowls
    ordersToProcess.forEach(order => {
        const flattened = flattenOrderData(order);
        allFlattenedBowls = allFlattenedBowls.concat(flattened);
        
        // Accurate count of items expected (for debugging)
        order.boxes.forEach(box => {
            box.dishes.forEach(dish => {
                const dishLabel = String(dish.label || 'N/A').trim().toUpperCase();
                
                // Only count non-addons
                if (dishLabel !== 'ADDONS') {
                    // Count items based ONLY on bowlCodes (the source of the 990)
                    totalItemsExpected += (dish.bowlCodes && dish.bowlCodes.length > 0) 
                        ? dish.bowlCodes.length 
                        : 0; // If codes are missing, we expect 0 items to be patched here.
                }
            });
        });
    });
    
    const totalItemsPatched = allFlattenedBowls.length;
    
    // Log the count difference for debugging
    console.log(`JSON Patch Summary: Total items expected: ${totalItemsExpected}. Total unique bowls patched: ${totalItemsPatched}`);


    if (allFlattenedBowls.length === 0) {
        showMessage("❌ ERROR: No assignable bowl records found in the pasted data.", 'error');
        return;
    }

    let updates = 0;
    let creations = 0;
    
    const timestamp = new Date().toISOString();

    for (const item of allFlattenedBowls) {
        // Now, item contains: { vytUrl, dishLetter, company, customer, preparedDate }
        
        // Final sanity check on flattened data
        if (!item.vytUrl || !item.company || !item.customer) {
            console.error("Internal Error: Flattened item missing core fields.", item);
            continue;
        }

        const exactVytUrl = item.vytUrl; 
        
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === exactVytUrl);
        
        const jsonAssignmentDate = formatDateStandard(item.preparedDate || item.date || timestamp);

        // Logic 1: Update Existing Active Bowl (Temporal Overwrite)
        if (activeIndex !== -1) {
            const activeBowl = window.appData.activeBowls[activeIndex];
            
            // Overwrite Company/Customer with NEW details from the patch
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();
            
            activeBowl.preparedDate = jsonAssignmentDate; 
            activeBowl.updateTime = timestamp;
            updates++;
            continue;
        }
        
        // Logic 2: Promote Prepared Bowl to Active Bowl (MATCHING VYT URL)
        if (preparedIndex !== -1) {
            // Remove from Prepared and move to Active
            const preparedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
            
            preparedBowl.company = item.company.trim();
            preparedBowl.customer = item.customer.trim();
            preparedBowl.preparedDate = jsonAssignmentDate; 
            preparedBowl.updateTime = timestamp; 
            preparedBowl.state = 'ACTIVE_KNOWN'; // Status changed: Assigned and Out.
            
            window.appData.activeBowls.push(preparedBowl);
            creations++;
            continue;
        }

        // Logic 3: Create New Active Bowl (If missed prep scan, or if it's new)
        if (preparedIndex === -1 && activeIndex === -1) {
            const newBowl = {
                vytUrl: exactVytUrl, 
                dishLetter: item.dishLetter, 
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: jsonAssignmentDate, 
                preparedTime: timestamp,
                user: window.appData.user || 'SYSTEM', // Assign SYSTEM user if no operator selected
                state: 'ACTIVE_KNOWN' // Status: Assigned and Out.
            };
            window.appData.activeBowls.push(newBowl);
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

/**
 * Exports data structures as CSV files (for Excel/Spreadsheets).
 */
function exportData(data, filename, source) {
    if (!data || data.length === 0) {
        showMessage(`ℹ️ Cannot export. ${source} is empty.`, 'warning');
        return;
    }

    // Use keys from the first object as headers
    const headers = Object.keys(data[0]);
    
    // Create the header row
    let csvContent = headers.join(',') + '\n';

    // Create data rows
    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header] === null || typeof row[header] === 'undefined' ? '' : String(row[header]);
            
            // Escape values that contain commas or quotes (CRITICAL for CSV integrity)
            value = value.replace(/"/g, '""');
            // Ensure VYT URLs that contain non-standard characters are wrapped in quotes
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
    a.download = filename.replace('.json', '.csv'); // Change extension to CSV
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(`💾 Exported data to ${a.download} (CSV format for Excel)`, 'success');
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
    // NOTE: This aggregates the three main lists. myScans is huge and often skipped.
    exportData(fullData, `all_combined_bowl_data_${formatDateStandard(new Date())}.csv`, 'Combined Data');
}

/**
 * Calculates LIVE statistics for prepared dishes (Kitchen Scans), sorted by Dish Letter then User.
 */
function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();
    
    const todaysKitchenScans = window.appData.myScans.filter(scan => 
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
        const indexA = DISH_LETTERS.indexOf(a.dishLetter);
        const indexB = DISH_LETTERS.indexOf(b.dishLetter);
        return indexA - indexB;
    });

    return statsArray;
}

/**
 * Renders the live statistics table.
 */
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

/**
 * Runs cleanup for old returned bowl records after 10 PM.
 */
// NOTE: This function is NO LONGER called in loadFromFirebase, preserving history as requested.
function checkDailyDataReset() {
    const now = new Date();
    const cutoffHour = 22; // 10 PM
    const today = formatDateStandard(now);
    const lastResetDate = window.appData.lastDataReset ? formatDateStandard(new Date(window.appData.lastDataReset)) : null;

    if (now.getHours() >= cutoffHour && lastResetDate !== today) {
        const bowlsToKeep = window.appData.returnedBowls.filter(bowl => 
            bowl.returnDate === today
        );
        const removedCount = window.appData.returnedBowls.length - bowlsToKeep.length;
        
        if (removedCount > 0) {
            window.appData.returnedBowls = bowlsToKeep;
            window.appData.lastDataReset = now.toISOString();
            syncToFirebase();
            console.log(`🧹 Daily Data Reset (10 PM): Removed ${removedCount} returned bowl records from previous days.`);
        }
    }
}

/**
 * Manually resets prepared bowls and scan history for the current reporting cycle.
 */
function resetTodaysPreparedBowls() {
    const { start, end } = getReportingDayTimestamp();

    const initialPreparedCount = window.appData.preparedBowls.length;
    window.appData.preparedBowls = [];

    const initialScanCount = window.appData.myScans.length;
    window.appData.myScans = window.appData.myScans.filter(scan => 
        !(scan.type === 'kitchen' && scan.timestamp >= start && scan.timestamp < end)
    );
    const removedScans = initialScanCount - window.appData.myScans.length;

    console.log(`🗑️ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans from the current reporting window`);

    if (initialPreparedCount > 0 || removedScans > 0) {
        window.appData.lastSync = new Date().toISOString();

        syncToFirebase();
        updateDisplay();
        showMessage(`✅ Reset Successful: ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans removed.`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls or scans found to remove.', 'info');
    }
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mark DOM as ready immediately
    window.appData.isDomReady = true;

    const dishLetterSelect = document.getElementById('dishLetterSelect');
    
    if(dishLetterSelect) {
        DISH_LETTERS.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            dishLetterSelect.appendChild(option);
        });
    }
    
    const scanInput = document.getElementById('scanInput');
    if(scanInput) {
        // 💥 FINAL SCANNER FIX: Robust Debounce Input Capture
        scanInput.addEventListener('input', (e) => {
            const scannedValue = e.target.value.trim();
            // Length check is crucial for performance and avoiding single keypresses
            if (scannedValue.length > 5) { 
                
                if (window.appData.scanTimer) {
                    clearTimeout(window.appData.scanTimer);
                }

                // Set a short delay (50ms) to ensure the entire VYT string has been written
                window.appData.scanTimer = setTimeout(() => {
                    // Check if input value is stable and scanning is active
                    if (scanInput.value.trim() === scannedValue && window.appData.scanning && !window.appData.isProcessingScan) {
                        processScan(scannedValue);
                        // CRITICAL: Clear input field AFTER successful processing
                        scanInput.value = ''; 
                    }
                }, 50); 
            }
        });
        
        // Retain the keydown listener for explicit Enter presses (as a manual fallback)
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
    
    // 💥 Aggressive Focus Fix: Force focus back to scanner input whenever typing starts
    document.addEventListener('keydown', (e) => {
        const scanInput = document.getElementById('scanInput');
        // Only run if scanning is active, the input isn't focused, and the key is a character (not Shift/Alt/Ctrl)
        if (window.appData.scanning && scanInput && document.activeElement !== scanInput && e.key.length === 1 && /[\w\d]/.test(e.key)) {
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
    window.clearActiveInventory = clearActiveInventory; // Expose new function

    // Start the Firebase initialization process directly (synchronously)
    initializeFirebase();

    // The daily data reset interval is NO LONGER needed as cleanup is removed
    // setInterval(checkDailyDataReset, 3600000); 
});
