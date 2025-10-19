// ProGlove Scanner - Complete Bowl Tracking System
// VYT codes are treated as full URLs. Logic updated for immediate statistics refresh.

// --- GLOBAL STATE ---
window.appData = {
    // Current UI/Scanner state
    mode: 'kitchen',          // 'kitchen' or 'return'
    user: null,               // Currently selected user
    dishLetter: 'A',          // Currently selected dish letter (A-Z, 1-4)
    scanning: false,          // True if the scanner is active
    
    // Core data structures (Synced with Firebase)
    myScans: [],              // Full history of all scans (used for daily metrics)
    activeBowls: [],          // Bowls prepared today, fully assigned (Company/Customer Known)
    preparedBowls: [],        // Bowls prepared today, unassigned (Company/Customer Unknown)
    returnedBowls: [],        // Bowls that have completed a cycle and been returned today
    
    // Internal state
    db: null,
    appDataRef: null,
    lastDataReset: null, 
    lastSync: null,
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

// EXTENDED LIST OF ALL VALID DISH LETTERS/NUMBERS (A-Z, then 1-4)
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
    const cutoffHour = 22; // 10 PM

    let startOfReportingDay = new Date(now);
    let endOfReportingDay = new Date(now);

    // If current time is BEFORE 10 PM (22:00) today, the reporting day started yesterday at 10 PM.
    if (now.getHours() < cutoffHour) {
        startOfReportingDay.setDate(now.getDate() - 1); // Start is yesterday
    }
    
    // Set the start time to 10:00 PM (22:00:00.000)
    startOfReportingDay.setHours(cutoffHour, 0, 0, 0);

    // Set the end time to 10:00 PM (22:00:00.000) today
    endOfReportingDay.setHours(cutoffHour, 0, 0, 0);

    // Ensure the end time is after the start time 
    if (startOfReportingDay >= endOfReportingDay) {
        endOfReportingDay.setDate(endOfReportingDay.getDate() + 1);
    }
    
    return {
        start: startOfReportingDay.toISOString(),
        end: endOfReportingDay.toISOString()
    };
}


function showMessage(message, type = 'info', duration = 3000) {
    const messageContainer = document.getElementById('messageContainer');
    const msgElement = document.createElement('div');
    msgElement.className = `p-3 rounded-lg shadow-xl text-center text-sm mb-2 transition-all duration-300`;
    
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

/**
 * Initializes Firebase, sets up the Realtime Database reference.
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

        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
             console.error("Firebase library not loaded.");
             showMessage("❌ Firebase library not loaded. Check HTML scripts.", 'error');
             return;
        }

        const app = firebase.initializeApp(firebaseConfig);
        window.appData.db = firebase.database();
        
        // Public data path: /artifacts/{appId}/public/data/bowl_data
        window.appData.appDataRef = firebase.database().ref(`artifacts/${appId}/public/data/bowl_data`);
        
        loadFromFirebase();

        showMessage("✅ Application initialized. Waiting for user selection.", 'success');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("❌ Firebase failed to initialize. Check configuration.", 'error');
    }
}

/**
 * Fetches data from Firebase using the ON listener for real-time consistency.
 */
function loadFromFirebase() {
    if (!window.appData.appDataRef) return;

    window.appData.appDataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
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
            console.log("🆕 Initializing new data structure in Firebase.");
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
        lastDataReset: window.appData.lastDataReset,
        lastSync: window.appData.lastSync,
    };

    const path = window.appData.appDataRef.path.toString();
    firebase.database().ref(path).set(dataToSave)
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

    // 4. MY SCANS COUNT (Dish Letter Specific Count)
    let myScansCount = 0;
    const { start, end } = getReportingDayTimestamp(); 

    if (window.appData.user && window.appData.dishLetter) {
        myScansCount = window.appData.myScans.filter(scan => 
            // 1. Must be a Kitchen Scan
            scan.type === 'kitchen' && 
            // 2. Must be within the 10 PM reporting window
            scan.timestamp >= start && scan.timestamp < end &&
            // 3. Must match current user
            scan.user === window.appData.user &&
            // 4. MUST MATCH THE SELECTED DISH LETTER/NUMBER
            scan.dishLetter === window.appData.dishLetter
        ).length;
    }

    document.getElementById('myScansCount').textContent = myScansCount;
    document.getElementById('myDishLetterLabel').textContent = window.appData.dishLetter || 'A';


    // Update Scan Status
    document.getElementById('scanStatus').textContent = window.appData.scanning ? 'Scanner ON' : 'Scanner OFF';
    document.getElementById('scanStatus').className = 
        `text-xs font-semibold px-2 py-1 rounded-full ${window.appData.scanning ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`;
    
    // Update User/Dish Selectors
    document.getElementById('selectedUser').textContent = window.appData.user || 'Select User';
    document.getElementById('selectedDishLetter').textContent = window.appData.dishLetter || 'A';
    
    // --- LIVE PREP REPORT (REAL-TIME UPDATE) ---
    const livePrepData = getLivePrepReport();
    renderLivePrepReport(livePrepData);
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

function selectDishLetter(value) {
    if (window.appData.user) {
        const upperValue = value.trim().toUpperCase();
        if (DISH_LETTERS.includes(upperValue)) {
            window.appData.dishLetter = upperValue;
            showMessage(`Dish Letter selected: ${upperValue}`, 'info');
            const selectedDishDisplay = document.getElementById('selectedDishLetter');
            if(selectedDishDisplay) selectedDishDisplay.textContent = upperValue;
            updateDisplay();
        } else {
            showMessage("❌ Invalid Dish Letter/Number selected.", 'error');
        }
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
        showMessage("❌ Cannot start scanning. Please select a Dish Letter (A-Z or 1-4).", 'error');
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

/**
 * Main handler for any scan input.
 * @param {string} vytUrl - The VYT identifier, which is a full URL.
 */
function processScan(vytUrl) {
    if (!window.appData.scanning || !window.appData.user) {
        showMessage("❌ Scanner not active or user not selected.", 'error');
        return;
    }
    
    const timestamp = new Date().toISOString();
    const exactVytUrl = vytUrl; 

    // 1. Record raw scan history (for user stats)
    const scanRecord = {
        vytUrl: exactVytUrl,
        timestamp: timestamp,
        type: window.appData.mode,
        user: window.appData.user,
        dishLetter: window.appData.dishLetter
    };
    window.appData.myScans.push(scanRecord);
    
    let result;
    if (window.appData.mode === 'kitchen') {
        result = kitchenScan(exactVytUrl, timestamp);
    } else { // 'return' mode
        result = returnScan(exactVytUrl, timestamp);
    }
    
    if (result.success) {
        syncToFirebase();
        showMessage(result.message, 'success');
    } else {
        showMessage(result.message, 'error');
    }
    
    // updateDisplay() is called here to ensure the Live Prep Report updates immediately.
    updateDisplay(); 
    document.getElementById('scanInput').value = '';
}

/**
 * Handles a scan at the Kitchen Prep Station.
 */
function kitchenScan(vytUrl, timestamp) {
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === vytUrl);
    const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === vytUrl);
    
    let statusMessage = "started a new prep cycle.";

    // 1. If the bowl is ACTIVE, close its cycle and move it to returned history.
    if (activeIndex !== -1) {
        const returnedBowl = window.appData.activeBowls.splice(activeIndex, 1)[0];
        returnedBowl.returnDate = formatDateStandard(new Date(timestamp));
        window.appData.returnedBowls.push(returnedBowl);
        statusMessage = "closed active cycle and started new prep.";
    }
    
    // 2. If the bowl was in Prepared, clear it out for a fresh record.
    if (preparedIndex !== -1) {
        window.appData.preparedBowls.splice(preparedIndex, 1);
        statusMessage = "closed old prepared record and started new prep.";
    }

    // 3. Create NEW Prepared Bowl record (starts a new prep cycle)
    const newPreparedBowl = {
        vytUrl: vytUrl, // Stored as a URL
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
        message: `✅ Kitchen Prep: ${vytUrl.slice(-10)} assigned to Dish ${window.appData.dishLetter}. Cycle ${statusMessage}` 
    };
}

/**
 * Handles a scan at the Return Station.
 */
function returnScan(vytUrl, timestamp) {
    const returnDate = formatDateStandard(new Date(timestamp));

    // 1. Try to find the bowl in Prepared state and move to Returned
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

    // 2. Try to find the bowl in Active state and move to Returned (CLOSES THE ACTIVE CYCLE)
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
    
    // 3. If the bowl is not found in either state
    return { 
        success: false, 
        message: `❌ Error: ${vytUrl.slice(-10)} not found in Prepared or Active inventory.` 
    };
}


// --- DATA IMPORT/EXPORT ---

/**
 * Processes JSON data to convert Prepared Bowls to Active Bowls, or update existing Active Bowls.
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
        // IMPORTANT: MUST HAVE VYT URL, Company, and Customer to activate.
        if (!item.vytUrl || !item.company || !item.customer) { 
            console.warn("Skipping item due to missing VYT URL, Company, or Customer:", item);
            continue;
        }

        const exactVytUrl = item.vytUrl; // Use URL AS IS.
        
        // Find existing bowls in Prepared or Active state
        const preparedIndex = window.appData.preparedBowls.findIndex(b => b.vytUrl === exactVytUrl);
        const activeIndex = window.appData.activeBowls.findIndex(b => b.vytUrl === exactVytUrl);
        
        // Sanitize the date from the JSON (prefers 'preparedDate' or 'date', otherwise uses today)
        const jsonAssignmentDate = formatDateStandard(item.preparedDate || item.date || timestamp);

        // --- Logic: 1. Update Existing Active Bowl (Temporal Overwrite) ---
        if (activeIndex !== -1) {
            // Overwrites old data with the latest JSON data.
            const activeBowl = window.appData.activeBowls[activeIndex];
            activeBowl.company = item.company.trim();
            activeBowl.customer = item.customer.trim();
            activeBowl.preparedDate = jsonAssignmentDate; 
            activeBowl.updateTime = timestamp;
            updates++;
            continue;
        }
        
        // --- Logic: 2. Promote Prepared Bowl to Active Bowl (MATCHING VYT URL) ---
        if (preparedIndex !== -1) {
            // Remove from Prepared and move to Active
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

        // --- Logic: 3. Create New Active Bowl (If missed prep scan, or if it's new) ---
        if (preparedIndex === -1 && activeIndex === -1) {
            const newBowl = {
                vytUrl: exactVytUrl, // Stored as a URL
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
    } else {
        showMessage("ℹ️ No bowls updated or created from JSON data.", 'info');
    }
}

/**
 * Exports data structures as JSON files.
 */
function exportData(data, filename) {
    // IMPORTANT: Customer details are only visible in exports, not on the UI.
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

// --- LIVE PREP REPORT (10 PM to 10 PM) ---

/**
 * Calculates LIVE statistics for prepared dishes (Kitchen Scans), sorted by Dish Letter then User.
 * This is the function that runs on every update.
 */
function getLivePrepReport() {
    const { start, end } = getReportingDayTimestamp();
    
    // 1. Filter today's kitchen scans within the 10 PM reporting window
    const todaysKitchenScans = window.appData.myScans.filter(scan => 
        scan.type === 'kitchen' && 
        scan.timestamp >= start && 
        scan.timestamp < end
    );
    
    // 2. Group by Dish Letter/Number and collect user data
    const groupedData = todaysKitchenScans.reduce((acc, scan) => {
        const letter = scan.dishLetter;
        if (!acc[letter]) {
            acc[letter] = {
                dishLetter: letter,
                users: new Map(), // Use Map to track user's individual count for that dish
                count: 0
            };
        }
        
        // Track individual user count
        const userCount = acc[letter].users.get(scan.user) || 0;
        acc[letter].users.set(scan.user, userCount + 1);
        
        // Track dish total count
        acc[letter].count++;
        return acc;
    }, {});
    
    // 3. Convert to array, sort users, and prepare for final sort
    const statsArray = Object.values(groupedData).map(item => ({
        ...item,
        // Convert Map of users/counts to an array of objects for easier rendering/sorting
        users: Array.from(item.users, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)) 
    }));
    
    // 4. Sort the final array based on the predefined DISH_LETTERS order (A-Z, then 1-4)
    statsArray.sort((a, b) => {
        const indexA = DISH_LETTERS.indexOf(a.dishLetter);
        const indexB = DISH_LETTERS.indexOf(b.dishLetter);
        return indexA - indexB;
    });

    return statsArray;
}

/**
 * Renders the live statistics table into the UI (Renamed from renderOvernightStatistics).
 */
function renderLivePrepReport(stats) {
    const container = document.getElementById('livePrepReportBody');
    if (!container) return;

    if (stats.length === 0) {
        container.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">No kitchen preparation scans recorded during the current reporting window.</td></tr>`;
        return;
    }

    let html = '';
    stats.forEach(dish => {
        let firstRow = true;
        
        // Loop through each user for this dish, creating a separate row for each
        dish.users.forEach(user => {
            html += `
                <tr class="text-sm border-t border-gray-100 hover:bg-indigo-50 transition duration-150">
                    ${firstRow ? `<td rowspan="${dish.users.length}" class="font-bold text-center align-top p-2 border-r border-gray-200 text-indigo-700">${dish.dishLetter}</td>` : ''}
                    <td class="p-2 text-left flex justify-between items-center">${user.name} <span class="font-bold text-gray-800">${user.count}</span></td>
                    ${firstRow ? `<td rowspan="${dish.users.length}" class="text-center font-semibold align-top p-2 text-xl text-indigo-900 bg-indigo-50">${dish.count}</td>` : ''}
                </tr>
            `;
            firstRow = false;
        });
    });

    container.innerHTML = html;
}

// --- DATA MAINTENANCE (10 PM DAILY RESET) ---

/**
 * Checks if the daily data reset for old returnedBowls should run (at 10:00 PM).
 */
function checkDailyDataReset() {
    const now = new Date();
    const cutoffHour = 22; // 10 PM
    const today = formatDateStandard(now);
    const lastResetDate = window.appData.lastDataReset ? formatDateStandard(new Date(window.appData.lastDataReset)) : null;

    if (now.getHours() >= cutoffHour && lastResetDate !== today) {
        // Run data cleanup
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
 * Manual reset to remove all Prepared Bowls and Kitchen Scans for the current reporting window.
 */
function resetTodaysPreparedBowls() {
    const { start, end } = getReportingDayTimestamp();

    // 1. Remove all prepared bowls
    const initialPreparedCount = window.appData.preparedBowls.length;
    window.appData.preparedBowls = [];

    // 2. Remove all current reporting window's kitchen scans from myScans
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
        showMessage(`✅ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls or scans found to remove', 'info');
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
    DISH_LETTERS.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dishLetterSelect.appendChild(option);
    });

    dishLetterSelect.addEventListener('change', (e) => selectDishLetter(e.target.value));
    
    selectUser(USERS[0].name);
    selectDishLetter(DISH_LETTERS[0]); 

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
    window.getLivePrepReport = getLivePrepReport; // Exposed for testing/debugging

    // Start the Firebase initialization process
    initializeFirebase();

    // Check for daily data reset every hour
    setInterval(checkDailyDataReset, 3600000); 
});

