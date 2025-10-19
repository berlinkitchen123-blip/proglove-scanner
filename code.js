// ProGlove Scanner - Complete Bowl Tracking System
// This system relies solely on Firebase Realtime Database for state management.

// --- GLOBAL STATE ---
window.appData = {
    // Current UI/Scanner state
    mode: 'kitchen',          // 'kitchen' or 'return'
    user: null,               // Currently selected user
    dishLetter: 'A',          // Currently selected dish letter (A-Z)
    scanning: false,          // True if the scanner is active
    
    // Core data structures (Synced with Firebase)
    myScans: [],              // Full history of all scans (used for daily metrics)
    activeBowls: [],          // Bowls prepared today, fully assigned (Company/Customer Known)
    preparedBowls: [],        // Bowls prepared today, unassigned (Company/Customer Unknown)
    returnedBowls: [],        // Bowls that have completed a cycle and been returned today
    
    // Internal state
    db: null,
    appDataRef: null,
    user: null,
};

// CORRECTED USER LIST
const USERS = [
    {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
    {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"}, 
    {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"}, 
    {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"}, 
    {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"}, 
    {name: "Adesh", role: "Return"}
];

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

function showMessage(message, type = 'info', duration = 3000) {
    const messageContainer = document.getElementById('messageContainer');
    const msgElement = document.createElement('div');
    msgElement.className = `p-3 rounded-lg shadow-xl text-center text-sm mb-2 transition-all duration-300`;
    
    // Tailwinds classes for styling
    let backgroundClass = 'bg-blue-100 border-blue-400 text-blue-700';
    if (type === 'success') {
        backgroundClass = 'bg-green-100 border-green-400 text-green-700';
    } else if (type === 'error') {
        backgroundClass = 'bg-red-100 border-red-400 text-red-700';
    }

    msgElement.className += ' ' + backgroundClass;
    msgElement.innerHTML = message;
    
    messageContainer.prepend(msgElement);
    
    setTimeout(() => {
        msgElement.style.opacity = '0';
        msgElement.style.maxHeight = '0';
        msgElement.style.padding = '0';
        setTimeout(() => msgElement.remove(), 500);
    }, duration);
}

// --- FIREBASE SETUP & SYNC (SOLE SOURCE OF TRUTH) ---
// Imports are assumed to be handled by the HTML file using type="module"

/**
 * Initializes Firebase, sets up the Realtime Database reference,
 * and handles the initial authentication.
 */
async function initializeFirebase() {
    try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        if (!firebaseConfig) {
            console.error("Firebase config is missing.");
            showMessage("❌ Firebase configuration is missing.", 'error');
            return;
        }

        const app = firebase.initializeApp(firebaseConfig);
        window.appData.db = firebase.database();
        
        // Define the data path: /artifacts/{appId}/public/data/bowl_data
        window.appData.appDataRef = firebase.database().ref(`artifacts/${appId}/public/data/bowl_data`);
        
        // Start listening for live data updates
        loadFromFirebase();

        showMessage("✅ Application initialized. Waiting for user selection.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ Firebase failed to initialize. Check configuration.", 'error');
    }
}

/**
 * Fetches data from Firebase using the ON listener for real-time consistency.
 * This is the ONLY place appData is loaded from the cloud.
 */
function loadFromFirebase() {
    if (!window.appData.appDataRef) return;

    // Use .on('value') to keep the app synchronized automatically
    window.appData.appDataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Overwrite all local appData arrays with the live Firebase data
            window.appData.myScans = data.myScans || [];
            window.appData.activeBowls = data.activeBowls || [];
            window.appData.preparedBowls = data.preparedBowls || [];
            window.appData.returnedBowls = data.returnedBowls || [];
            window.appData.lastCleanup = data.lastCleanup || null;
            window.appData.lastSync = data.lastSync || null;
            
            // Re-run cleanup check immediately after loading data to ensure consistency
            checkDailyCleanup();
            
            updateDisplay();
            console.log("⬆️ Data synchronized from Firebase.");
        } else {
            console.log("🆕 Initializing new data structure in Firebase.");
            // If no data exists, sync the initial empty state
            syncToFirebase();
        }
    }, (error) => {
        console.error("Firebase ON listener failed:", error);
        showMessage("❌ Live data feed error.", 'error');
    });
}

/**
 * Pushes the current local state to Firebase Realtime Database.
 */
function syncToFirebase() {
    if (!window.appData.appDataRef) return;

    window.appData.lastSync = new Date().toISOString();

    const dataToSave = {
        myScans: window.appData.myScans,
        activeBowls: window.appData.activeBowls,
        preparedBowls: window.appData.preparedBowls,
        returnedBowls: window.appData.returnedBowls,
        lastCleanup: window.appData.lastCleanup,
        lastSync: window.appData.lastSync,
    };

    firebase.database().ref(`artifacts/${__app_id}/public/data/bowl_data`).set(dataToSave)
        .then(() => {
            console.log("⬇️ Data successfully written to Firebase.");
        })
        .catch(error => {
            console.error("Firebase synchronization failed:", error);
            showMessage("❌ Data sync failed. Check connection.", 'error');
        });
}

// --- UI AND MODE MANAGEMENT ---

function updateDisplay() {
    const today = formatDateStandard(new Date());

    // Update Mode Display
    const modeText = window.appData.mode === 'kitchen' ? 'Kitchen Prep Mode' : 'Return Scan Mode';
    document.getElementById('modeDisplay').textContent = modeText;
    document.getElementById('modeDisplay').className = 
        `text-xl font-bold p-2 rounded-lg text-center ${window.appData.mode === 'kitchen' ? 'bg-indigo-600 text-white' : 'bg-red-600 text-white'}`;
    
    // --- MAIN METRICS (Accurate Inventory/History Count) ---

    // 1. ACTIVE BOWL COUNT (Assigned to Customer)
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;

    // 2. PREPARED TODAY COUNT (Unassigned, Unknown Customer)
    document.getElementById('preparedTodayCount').textContent = window.appData.preparedBowls.length;
    
    // 3. RETURNED TODAY COUNT
    const returnedTodayCount = window.appData.returnedBowls.filter(bowl => 
        bowl.returnDate === today
    ).length;
    document.getElementById('returnedTodayCount').textContent = returnedTodayCount;

    // 4. MY SCANS COUNT (Dish Letter Specific Count - Key Requirement)
    let myScansCount = 0;
    
    if (window.appData.user && window.appData.dishLetter) {
        myScansCount = window.appData.myScans.filter(scan => 
            scan.type === 'kitchen' && 
            formatDateStandard(new Date(scan.timestamp)) === today &&
            scan.user === window.appData.user &&
            scan.dishLetter === window.appData.dishLetter
        ).length;
    }

    document.getElementById('myScansCount').textContent = myScansCount;

    // Update Scan Status
    document.getElementById('scanStatus').textContent = window.appData.scanning ? 'Scanner ON' : 'Scanner OFF';
    document.getElementById('scanStatus').className = 
        `text-xs font-semibold px-2 py-1 rounded-full ${window.appData.scanning ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`;
    
    // Update User/Dish Selectors
    document.getElementById('selectedUser').textContent = window.appData.user || 'Select User';
    document.getElementById('selectedDishLetter').textContent = window.appData.dishLetter || 'A';
}

function setMode(mode) {
    if (mode !== 'kitchen' && mode !== 'return') return;
    window.appData.mode = mode;
    showMessage(`Mode switched to: ${mode.toUpperCase()}`, 'info');
    updateDisplay();
}

function selectUser(userName) {
    const user = USERS.find(u => u.name === userName);
    if (!user) return;
    window.appData.user = userName;
    
    // Automatically set mode based on user role
    setMode(user.role.toLowerCase() === 'kitchen' ? 'kitchen' : 'return');
    showMessage(`User selected: ${userName}`, 'info');
    updateDisplay();
}

function selectDishLetter(letter) {
    if (window.appData.user) {
        window.appData.dishLetter = letter.toUpperCase();
        showMessage(`Dish Letter selected: ${letter.toUpperCase()}`, 'info');
        updateDisplay();
    } else {
        showMessage("❌ Please select a User first.", 'error');
    }
}

function startScanning() {
    if (!window.appData.user) {
        showMessage("❌ Cannot start scanning. Please select a User.", 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage("❌ Cannot start scanning. Please select a Dish Letter (A-Z).", 'error');
        return;
    }
    window.appData.scanning = true;
    document.getElementById('scanInput').focus();
    showMessage("✅ Scanner Activated. Ready to scan.", 'success');
    updateDisplay();
}

function stopScanning() {
    window.appData.scanning = false;
    document.getElementById('scanInput').blur();
    showMessage("🛑 Scanner Deactivated.", 'info');
    updateDisplay();
}

// --- CORE SCANNING LOGIC ---

function processScan(vytCode) {
    if (!window.appData.scanning || !window.appData.user) {
        showMessage("❌ Scanner not active or user not selected.", 'error');
        return;
    }
    
    const timestamp = new Date().toISOString();
    const exactVytCode = vytCode.trim().toUpperCase();

    // 1. Record raw scan history (for user stats)
    const scanRecord = {
        vytCode: exactVytCode,
        timestamp: timestamp,
        type: window.appData.mode,
        user: window.appData.user,
        dishLetter: window.appData.dishLetter // Only relevant for kitchen mode, but recorded anyway
    };
    window.appData.myScans.push(scanRecord);
    
    let result;
    if (window.appData.mode === 'kitchen') {
        result = kitchenScan(exactVytCode, timestamp);
    } else { // 'return' mode
        result = returnScan(exactVytCode, timestamp);
    }
    
    if (result.success) {
        // Only sync if a core data structure was modified
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showMessage(result.message, 'error');
    }
    
    updateDisplay();
    document.getElementById('scanInput').value = '';
}

/**
 * Handles a scan at the Kitchen Prep Station.
 * A kitchen scan's purpose is to start a new prepared cycle.
 * It removes the bowl from any previous state (Active/Prepared/Returned) and resets it to Prepared (Unknown).
 */
function kitchenScan(vytCode, timestamp) {
    // 1. Check if the bowl is currently Active or Prepared
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytCode === vytCode);
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytCode === vytCode);
    
    const isCurrentlyPrepared = preparedIndex !== -1;
    const isCurrentlyActive = activeIndex !== -1;

    // 2. Remove from previous prepared/active state (Close the old cycle)
    if (isCurrentlyPrepared) {
        window.appData.preparedBowls.splice(preparedIndex, 1);
        console.log(`Kitchen Scan: Closed old prepared bowl record for ${vytCode}`);
    }
    if (isCurrentlyActive) {
        window.appData.activeBowls.splice(activeIndex, 1);
        console.log(`Kitchen Scan: Closed old active bowl record for ${vytCode}`);
    }

    // 3. Create NEW Prepared Bowl record (resets customer/company to Unknown)
    const newPreparedBowl = {
        vytCode: vytCode,
        dishLetter: window.appData.dishLetter,
        company: 'Unknown',
        customer: 'Unknown',
        preparedDate: formatDateStandard(new Date(timestamp)),
        preparedTime: timestamp,
        user: window.appData.user,
        state: 'PREPARED_UNKNOWN' // Custom internal state for clarity
    };

    window.appData.preparedBowls.push(newPreparedBowl);
    
    return { 
        success: true, 
        message: `✅ Prepared: ${vytCode} assigned to Dish ${window.appData.dishLetter}. Old record closed.` 
    };
}

/**
 * Handles a scan at the Return Station.
 * A return scan's purpose is to close the Active/Prepared cycle and log the return.
 */
function returnScan(vytCode, timestamp) {
    const returnDate = formatDateStandard(new Date(timestamp));

    // 1. Try to find the bowl in Prepared state
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytCode === vytCode);
    if (preparedIndex !== -1) {
        const returnedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        window.appData.returnedBowls.push(returnedBowl);
        
        return { 
            success: true, 
            message: `📦 Returned: ${vytCode} (Was Prepared). Available for next prep.` 
        };
    }

    // 2. Try to find the bowl in Active state
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytCode === vytCode);
    if (activeIndex !== -1) {
        const returnedBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = returnDate;
        window.appData.returnedBowls.push(returnedBowl);

        return { 
            success: true, 
            message: `📦 Returned: ${vytCode} (Was Active for ${returnedBowl.customer}). Available for next prep.` 
        };
    }
    
    // 3. If the bowl is not found in either state
    return { 
        success: false, 
        message: `❌ Error: ${vytCode} not found in Prepared or Active inventory. Check history.` 
    };
}


// --- DATA IMPORT/EXPORT ---

/**
 * Processes JSON data to convert Prepared Bowls to Active Bowls, or update existing Active Bowls.
 * This is where Customer/Company names are assigned.
 */
function processJSONData(jsonString) {
    if (!window.appData.user) {
        showMessage("❌ Please select a User before uploading data.", 'error');
        return;
    }

    let parsedData;
    try {
        parsedData = JSON.parse(jsonString);
        if (!Array.isArray(parsedData)) {
            throw new Error("JSON must be a list of bowl objects.");
        }
    } catch (e) {
        showMessage(`❌ JSON Parsing Error: ${e.message}`, 'error');
        return;
    }

    let updates = 0;
    let creations = 0;
    
    const timestamp = new Date().toISOString();

    for (const item of parsedData) {
        if (!item.vytCode || !item.company || !item.customer) {
            console.warn("Skipping item due to missing VYT Code, Company, or Customer:", item);
            continue;
        }

        const exactVytCode = item.vytCode.trim().toUpperCase();
        
        // Find existing bowls in Prepared or Active state
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytCode === exactVytCode);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytCode === exactVytCode);

        // --- Logic: Update Active Bowl (If already assigned) ---
        if (activeIndex !== -1) {
            // Requirement: If already active, delete old customer/company and assign new
            const activeBowl = window.appData.activeBowls[activeIndex];
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();
            activeBowl.updateTime = timestamp;
            updates++;
            continue;
        }
        
        // --- Logic: Promote Prepared Bowl to Active Bowl ---
        if (preparedIndex !== -1) {
            // Remove from Prepared and move to Active
            const preparedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
            
            preparedBowl.company = item.company.trim();
            preparedBowl.customer = item.customer.trim();
            preparedBowl.updateTime = timestamp; // Time of assignment/activation
            preparedBowl.state = 'ACTIVE_KNOWN';
            
            window.appData.activeBowls.push(preparedBowl);
            creations++;
            continue;
        }

        // --- Logic: Create New Active Bowl if bowl was missed during prep scan but has JSON data
        // This is a safety net but assumes the bowl was prepared.
        if (preparedIndex === -1 && activeIndex === -1) {
            const newBowl = {
                vytCode: exactVytCode,
                dishLetter: item.dishLetter || 'N/A', // Use provided dishLetter or N/A
                company: item.company.trim(),
                customer: item.customer.trim(),
                preparedDate: formatDateStandard(new Date(timestamp)),
                preparedTime: timestamp,
                user: window.appData.user, // Assign current user for data upload
                state: 'ACTIVE_KNOWN'
            };
            window.appData.activeBowls.push(newBowl);
            creations++;
        }
    }

    if (updates > 0 || creations > 0) {
        showMessage(`✅ JSON Import Complete: ${creations} new Active Bowls, ${updates} updated Active Bowls.`, 'success', 5000);
        syncToFirebase();
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

// --- CLEANUP AND MAINTENANCE ---

/**
 * Checks if the daily cleanup for returnedBowls should run (e.g., once a day at 7:00 PM).
 */
function checkDailyCleanup() {
    const now = new Date();
    const today = formatDateStandard(now);
    const cleanupTimeHour = 19; // 7 PM
    const lastCleanupDate = window.appData.lastCleanup ? formatDateStandard(new Date(window.appData.lastCleanup)) : null;

    // Check if it's past cleanup time AND cleanup hasn't run today
    if (now.getHours() >= cleanupTimeHour && lastCleanupDate !== today) {
        // Run cleanup
        const bowlsToKeep = window.appData.returnedBowls.filter(bowl => 
            bowl.returnDate === today
        );
        const removedCount = window.appData.returnedBowls.length - bowlsToKeep.length;
        
        if (removedCount > 0) {
            window.appData.returnedBowls = bowlsToKeep;
            window.appData.lastCleanup = now.toISOString();
            syncToFirebase();
            console.log(`🧹 Daily Cleanup: Removed ${removedCount} returned bowl records from previous days.`);
        }
    }
}

/**
 * Manual reset to remove all Prepared Bowls and Kitchen Scans for today.
 */
function resetTodaysPreparedBowls() {
    const today = formatDateStandard(new Date());

    // 1. Remove all prepared bowls
    const initialPreparedCount = window.appData.preparedBowls.length;
    window.appData.preparedBowls = [];

    // 2. Remove all today's kitchen scans from myScans
    const initialScanCount = window.appData.myScans.length;
    window.appData.myScans = window.appData.myScans.filter(scan => 
        !(scan.type === 'kitchen' && formatDateStandard(new Date(scan.timestamp)) === today)
    );
    const removedScans = initialScanCount - window.appData.myScans.length;

    console.log(`🗑️ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans`);

    if (initialPreparedCount > 0 || removedScans > 0) {
        window.appData.lastSync = new Date().toISOString();

        syncToFirebase();
        updateDisplay();
        showMessage(`✅ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls found to remove', 'info');
    }
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Populate User and Dish Letter Selectors (assuming you have HTML elements for this)
    const userSelect = document.getElementById('userSelect');
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = `${user.name} (${user.role})`;
        userSelect.appendChild(option);
    });

    userSelect.addEventListener('change', (e) => selectUser(e.target.value));

    const dishLetterSelect = document.getElementById('dishLetterSelect');
    for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        const option = document.createElement('option');
        option.value = letter;
        option.textContent = letter;
        dishLetterSelect.appendChild(option);
    }

    dishLetterSelect.addEventListener('change', (e) => selectDishLetter(e.target.value));
    
    // Set initial values for selectors
    selectUser(USERS[0].name);
    selectDishLetter('A');

    // Setup scanning input listener
    const scanInput = document.getElementById('scanInput');
    scanInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && scanInput.value.trim()) {
            e.preventDefault();
            processScan(scanInput.value);
        }
    });

    // Make core functions globally accessible for HTML button clicks
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

    // Start the Firebase initialization process
    initializeFirebase();

    // Check for daily cleanup every hour (or set a better interval)
    setInterval(checkDailyCleanup, 3600000); // 1 hour
});

// Assuming firebase library is loaded via script tag in HTML:
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>

