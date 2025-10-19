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
    appDataRef: null,
    lastDataReset: null, 
    lastSync: null,
    isDomReady: false, 
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
        
        // Define the public data path.
        window.appData.appDataRef = firebase.database().ref(`artifacts/${appId}/public/data/bowl_data`);
        
        // Start the permanent listener immediately.
        loadFromFirebase(); 

        showMessage("✅ Application initialized. Please select an operation mode.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ ERROR: Firebase failed to initialize. Check configuration or Firebase project rules.", 'error');
    }
}

/**
 * Sets up the perpetual Firebase listener.
 */
function loadFromFirebase() {
    if (!window.appData.appDataRef) {
        console.warn("loadFromFirebase called before appDataRef was set.");
        return; 
    }

    // This listener runs perpetually (continuous read)
    window.appData.appDataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // Data received successfully. Update local state.
            window.appData.myScans = data.myScans || [];
            window.appData.activeBowls = data.activeBowls || [];
            window.appData.preparedBowls = data.preparedBowls || [];
            window.appData.returnedBowls = data.returnedBowls || [];
            window.appData.lastDataReset = data.lastDataReset || null;
            window.appData.lastSync = data.lastSync || null;
            
            checkDailyDataReset(); 
            updateDisplay(); 
            console.log("⬆️ Data synchronized from Firebase.");
        } else {
            // Data is null (first load on an empty database).
            console.log("🆕 Initializing new data structure in Firebase.");
            
            // Call syncToFirebase, which handles the timing issue internally.
            syncToFirebase();
        }
        
    }, (error) => {
        console.error("Firebase ON listener failed:", error);
        showMessage("❌ ERROR: Live data feed failed. Check Firebase Security Rules.", 'error');
    });
}

/**
 * Pushes the current local state to Firebase. Contains the critical retry logic.
 */
function syncToFirebase() {
    // CRITICAL FIX: Added logic to handle timing bug when .path is not yet ready.
    if (!window.appData.appDataRef || typeof window.appData.appDataRef.path === 'undefined') {
        console.warn("Attempted to sync but appDataRef is incomplete or undefined. Scheduling retry (100ms delay).");
        
        // Retry after a short delay for internal Firebase setup to complete.
        setTimeout(syncToFirebase, 100); 
        return; 
    }

    window.appData.lastSync = new Date().toISOString();

    const dataToSave = {
        myScans: window.appData.myScans,
        activeBowls: window.appData.activeBowls,
        preparedBowls: window.appData.preparedBowls,
        returnedBowls: window.appData.returnedBowls,
        lastDataReset: window.appData.lastDataReset,
        lastSync: window.appData.lastSync,
    };

    const path = window.appData.appDataRef.path.toString(); 
    firebase.database().ref(path).set(dataToSave)
        .then(() => {
            console.log("⬇️ Data successfully written to Firebase.");
            const lastSyncInfoEl = document.getElementById('lastSyncInfo');
            if(lastSyncInfoEl) lastSyncInfoEl.innerHTML = `💾 Last Sync: ${new Date().toLocaleTimeString()}`;
        })
        .catch(error => {
            console.error("Firebase synchronization failed:", error);
            showMessage("❌ ERROR: Data sync failed. Check connection.", 'error');
        });
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
            modeDisplay.classList.remove('bg-gray-500', 'bg-red-600', 'bg-emerald-600');
            modeDisplay.classList.add(window.appData.mode === 'kitchen' ? 'bg-emerald-600' : 'bg-red-600');
        }
        if(userSelectionCard) userSelectionCard.style.opacity = 1; 
        if(userSelect) userSelect.disabled = false;

        if(kitchenBtn) kitchenBtn.classList.remove('ring-2', 'ring-emerald-400', 'bg-gray-600', 'bg-emerald-600');
        if(returnBtn) returnBtn.classList.remove('ring-2', 'ring-red-400', 'bg-gray-600', 'bg-red-600');

        if (window.appData.mode === 'kitchen') {
            if(kitchenBtn) kitchenBtn.classList.add('ring-2', 'ring-emerald-400', 'bg-emerald-600');
            if(returnBtn) returnBtn.classList.add('bg-gray-600');
        } else {
            if(returnBtn) returnBtn.classList.add('ring-2', 'ring-red-400', 'bg-red-600');
            if(kitchenBtn) kitchenBtn.classList.add('bg-gray-600');
        }

    } else {
        if(modeDisplay) modeDisplay.textContent = 'Status: Please Select Mode';
        if(userSelectionCard) userSelectionCard.style.opacity = 0.5; 
        if(scanningCard) scanningCard.style.opacity = 0.5; 
        if(userSelect) userSelect.disabled = true;
        if(kitchenBtn) kitchenBtn.classList.remove('ring-2', 'ring-emerald-400');
        if(returnBtn) returnBtn.classList.remove('ring-2', 'ring-red-400');
    }

    // 2. Dish Section Visibility (Only for Kitchen mode)
    if (dishSection) {
        if (window.appData.mode === 'kitchen' && userSelectionCard) {
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


    // --- Core Metrics Update (Added Null Checks) ---
    const activeCountEl = document.getElementById('activeCount');
    if (activeCountEl) activeCountEl.textContent = window.appData.activeBowls.length;
    
    const preparedTodayCountEl = document.getElementById('preparedTodayCount');
    if (preparedTodayCountEl) preparedTodayCountEl.textContent = window.appData.preparedBowls.length;
    
    const returnedTodayCount = window.appData.returnedBowls.filter(bowl => 
        bowl.returnDate === today
    ).length;
    const exportReturnCountEl = document.getElementById('exportReturnCount');
    if (exportReturnCountEl) exportReturnCountEl.textContent = returnedTodayCount;
    
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
    if (myScansCountEl) myScansCountEl.textContent = myScansCount;
    
    const myDishLetterLabelEl = document.getElementById('myDishLetterLabel');
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
    
    updateDisplay(); 
    const scanInput = document.getElementById('scanInput');
    if(scanInput) scanInput.value = '';
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
 * Processes JSON customer data to convert Prepared Bowls to Active Bowls.
 */
function processJSONData(jsonString) {
    if (!window.appData.user) {
        showMessage("❌ ERROR: Please select a User before uploading data.", 'error');
        return;
    }
    
    if (!jsonString || jsonString.trim() === '' || jsonString.includes('Paste JSON data here')) {
        showMessage("❌ ERROR: JSON text area is empty. Please paste data.", 'error');
        return;
    }

    let parsedData;
    try {
        parsedData = JSON.parse(jsonString);
        if (!Array.isArray(parsedData)) {
            throw new Error("JSON must be a list of bowl objects.");
        }
    } catch (e) {
        showMessage(`❌ ERROR: JSON Parsing Error: ${e.message}`, 'error');
        return;
    }

    let updates = 0;
    let creations = 0;
    
    const timestamp = new Date().toISOString();

    for (const item of parsedData) {
        if (!item.vytUrl || !item.company || !item.customer) { 
            console.warn("Skipping item due to missing VYT URL, Company, or Customer:", item);
            continue;
        }

        const exactVytUrl = item.vytUrl; 
        
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === exactVytUrl);
        
        const jsonAssignmentDate = formatDateStandard(item.preparedDate || item.date || timestamp);

        if (activeIndex !== -1) {
            const activeBowl = window.appData.activeBowls[activeIndex];
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();
            activeBowl.preparedDate = jsonAssignmentDate; 
            activeBowl.updateTime = timestamp;
            updates++;
            continue;
        }
        
        if (preparedIndex !== -1) {
            const preparedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
            
            preparedBowl.company = item.company.trim();
            preparedBowl.customer = item.customer.trim();
            preparedBowl.preparedDate = jsonAssignmentDate; 
            preparedBowl.updateTime = timestamp; 
            preparedBowl.state = 'ACTIVE_KNOWN';
            
            window.appData.activeBowls.push(preparedBowl);
            creations++;
            continue;
        }

        if (preparedIndex === -1 && activeIndex === -1) {
            const newBowl = {
                vytUrl: exactVytUrl, 
                dishLetter: item.dishLetter || 'N/A', 
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: jsonAssignmentDate, 
                preparedTime: timestamp,
                user: window.appData.user, 
                state: 'ACTIVE_KNOWN'
            };
            window.appData.activeBowls.push(newBowl);
            creations++;
        }
    }

    if (updates > 0 || creations > 0) {
        showMessage(`✅ JSON Import Complete: ${creations} new Active Bowls, ${updates} updated Active Bowls.`, 'success', 5000);
        syncToFirebase();
        document.getElementById('jsonData').value = '';
    } else {
        showMessage("ℹ️ No bowls updated or created from JSON data.", 'info');
    }
}

/**
 * Exports data structures as JSON files.
 */
function exportData(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(`💾 Exported data to ${filename}`, 'info');
}

function exportActiveBowls() {
    exportData(window.appData.activeBowls, `active_bowls_${formatDateStandard(new Date())}.json`);
}

function exportReturnData() {
    exportData(window.appData.returnedBowls, `returned_bowls_${formatDateStandard(new Date())}.json`);
}

function exportAllData() {
    const fullData = {
        myScans: window.appData.myScans,
        activeBowls: window.appData.activeBowls,
        preparedBowls: window.appData.preparedBowls,
        returnedBowls: window.appData.returnedBowls,
    };
    exportData(fullData, `full_bowl_data_${formatDateStandard(new Date())}.json`);
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
        scanInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && scanInput.value.trim()) {
                e.preventDefault(); 
                const scannedValue = scanInput.value.trim();
                if (scannedValue) {
                    processScan(scannedValue);
                }
            }
        });
    }

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

    // Start the Firebase initialization process directly (synchronously)
    initializeFirebase();

    setInterval(checkDailyDataReset, 3600000); 
});
