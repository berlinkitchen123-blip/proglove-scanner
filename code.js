[file name]: code.js
[file content begin]
// ProGlove Scanner - Complete Bowl Tracking System
window.appData = {
    mode: null,
    user: null,
    dishLetter: null,
    scanning: false,
    myScans: [],
    activeBowls: [],
    preparedBowls: [],
    returnedBowls: [],
    scanHistory: [],
    customerData: [],
    lastActivity: Date.now(),
    lastCleanup: null,
    lastSync: null,
    isProcessingScan: false, // FLAG TO PREVENT CONCURRENT SCANS
    lastScannedCode: null    // { code: '...', timestamp: ... } to prevent duplicates
};

// CORRECTED USER LIST
const USERS = [
    { name: "Hamid", role: "Kitchen" },
    { name: "Richa", role: "Kitchen" },
    { name: "Jash", role: "Kitchen" },
    { name: "Joes", role: "Kitchen" },
    { name: "Mary", role: "Kitchen" },
    { name: "Rushal", role: "Kitchen" },
    { name: "Sreekanth", role: "Kitchen" },
    { name: "Sultan", role: "Return" },
    { name: "Riyaz", role: "Return" },
    { name: "Alan", role: "Return" },
    { name: "Adesh", role: "Return" }
];

// FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
    authDomain: "proglove-scanner.firebaseapp.com",
    databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "proglove-scanner",
    storageBucket: "proglove-scanner.firebasestorage.app",
    messagingSenderId: "177575768177",
    appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0"
};

// ========== ENHANCED FIREBASE FUNCTIONS WITH SMART MERGE ==========

// Load XLSX library dynamically
function loadXLSXLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            console.log('✅ XLSX already loaded');
            resolve();
            return;
        }

        console.log('🔄 Loading XLSX library...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = function () {
            console.log('✅ XLSX library loaded');
            resolve();
        };
        script.onerror = function () {
            reject(new Error('Failed to load XLSX library'));
        };
        document.head.appendChild(script);
    });
}

// Load Firebase SDK dynamically
function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            console.log('✅ Firebase already loaded');
            resolve();
            return;
        }

        console.log('🔄 Loading Firebase SDK...');

        const scriptApp = document.createElement('script');
        scriptApp.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        scriptApp.onload = function () {
            console.log('✅ Firebase App loaded');
            const scriptDatabase = document.createElement('script');
            scriptDatabase.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
            scriptDatabase.onload = function () {
                console.log('✅ Firebase Database loaded');
                resolve();
            };
            scriptDatabase.onerror = function () {
                reject(new Error('Failed to load Firebase Database'));
            };
            document.head.appendChild(scriptDatabase);
        };
        scriptApp.onerror = function () {
            reject(new Error('Failed to load Firebase App'));
        };
        document.head.appendChild(scriptApp);
    });
}

// Initialize Firebase
function initializeFirebase() {
    console.log('🚀 Initializing Scanner System...');

    loadFirebaseSDK()
        .then(() => {
            console.log('✅ Firebase SDK loaded successfully');

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase app initialized');
            }

            // Update Firebase connection status
            updateFirebaseConnectionStatus('connected');
            loadFromFirebase();
        })
        .catch((error) => {
            console.error('❌ Failed to load Firebase SDK:', error);
            updateFirebaseConnectionStatus('disconnected');
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage (Firebase failed)', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
        });
}

// NEW FUNCTION: Update Firebase connection status display
function updateFirebaseConnectionStatus(status) {
    const statusElement = document.getElementById('firebaseStatus');
    if (!statusElement) return;
    
    switch(status) {
        case 'connected':
            statusElement.innerHTML = '🟢 Firebase Connected';
            statusElement.className = 'firebase-status connected';
            break;
        case 'connecting':
            statusElement.innerHTML = '🟡 Firebase Connecting...';
            statusElement.className = 'firebase-status connecting';
            break;
        case 'disconnected':
            statusElement.innerHTML = '🔴 Firebase Disconnected';
            statusElement.className = 'firebase-status disconnected';
            break;
        case 'error':
            statusElement.innerHTML = '🔴 Firebase Error';
            statusElement.className = 'firebase-status error';
            break;
        default:
            statusElement.innerHTML = '⚪ Firebase Unknown';
            statusElement.className = 'firebase-status unknown';
    }
}

// ========== SMART DATA MERGING SYSTEM ==========

// Enhanced load with smart merge
function loadFromFirebase() {
    try {
        console.log('🔄 Loading data from Firebase...');
        const db = firebase.database();
        const appDataRef = db.ref('progloveData');

        showMessage('🔄 Loading from cloud...', 'info');
        document.getElementById('systemStatus').textContent = '🔄 Connecting to Cloud...';
        updateFirebaseConnectionStatus('connecting');

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase connection timeout')), 10000);
        });

        Promise.race([appDataRef.once('value'), timeoutPromise])
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    console.log('✅ Firebase data loaded, starting smart merge...');

                    // SMART MERGE: Combine Firebase data with local data
                    const mergedData = smartMergeData(firebaseData);

                    // Update appData with merged results
                    window.appData.activeBowls = mergedData.activeBowls;
                    window.appData.preparedBowls = mergedData.preparedBowls;
                    window.appData.returnedBowls = mergedData.returnedBowls;
                    window.appData.myScans = mergedData.myScans;
                    window.appData.scanHistory = mergedData.scanHistory;
                    window.appData.customerData = mergedData.customerData;
                    window.appData.lastCleanup = mergedData.lastCleanup;
                    window.appData.lastSync = firebaseData.lastSync;

                    console.log('📊 Smart merge completed:', {
                        active: window.appData.activeBowls.length,
                        prepared: window.appData.preparedBowls.length,
                        returned: window.appData.returnedBowls.length,
                        mergedFromLocal: mergedData.mergeStats
                    });

                    // NEW: Clean up prepared bowls - move bowls with customer data to active
                    cleanupPreparedBowls();

                    showMessage('✅ Cloud data loaded with smart merge', 'success');
                    document.getElementById('systemStatus').textContent = '✅ Cloud Connected';
                    updateFirebaseConnectionStatus('connected');

                    cleanupIncompleteBowls();
                    initializeUI();

                } else {
                    console.log('❌ No data in Firebase, using local data');
                    showMessage('❌ No cloud data - using local data', 'warning');
                    document.getElementById('systemStatus').textContent = '✅ Cloud Connected (No Data)';
                    updateFirebaseConnectionStatus('connected');
                    loadFromStorage();
                    initializeUI();
                }
            })
            .catch((error) => {
                console.error('Firebase load error:', error);
                showMessage('❌ Cloud load failed: ' + error.message, 'error');
                document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Load Error';
                updateFirebaseConnectionStatus('error');
                loadFromStorage();
                initializeUI();
            });
    } catch (error) {
        console.error('Firebase error:', error);
        showMessage('❌ Firebase error: ' + error.message, 'error');
        document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Firebase Error';
        updateFirebaseConnectionStatus('error');
        loadFromStorage();
        initializeUI();
    }
}

// NEW FUNCTION: Clean up prepared bowls - move bowls with customer data to active
function cleanupPreparedBowls() {
    const bowlsToMove = [];

    // Find all prepared bowls that have customer data (not "Unknown")
    window.appData.preparedBowls = window.appData.preparedBowls.filter(bowl => {
        const hasCustomerData = bowl.customer && bowl.customer !== "Unknown" && bowl.customer !== "";
        const hasCompanyData = bowl.company && bowl.company !== "Unknown" && bowl.company !== "";

        if (hasCustomerData || hasCompanyData) {
            console.log(`🔄 Moving bowl from prepared to active: ${bowl.code} (Customer: ${bowl.customer}, Company: ${bowl.company})`);
            bowlsToMove.push(bowl);
            return false; // Remove from prepared
        }
        return true; // Keep in prepared (Unknown customer)
    });

    // Add the moved bowls to active bowls
    if (bowlsToMove.length > 0) {
        window.appData.activeBowls.push(...bowlsToMove);
        console.log(`✅ Moved ${bowlsToMove.length} bowls from prepared to active (had customer data)`);

        // Sync the changes
        syncToFirebase();
    }
}

// Enhanced smart merge function - properly handles prepared bowls
function smartMergeData(firebaseData) {
    const localData = getLocalData();
    const mergeStats = {
        activeAdded: 0,
        preparedAdded: 0,
        returnedAdded: 0,
        scansAdded: 0,
        historyAdded: 0
    };

    console.log('🔄 Starting smart merge...');
    console.log('Firebase data - Prepared:', (firebaseData.preparedBowls || []).length);
    console.log('Local data - Prepared:', (localData.preparedBowls || []).length);

    // Merge active bowls
    const firebaseActiveCodes = new Set((firebaseData.activeBowls || []).map(b => b.code));
    const uniqueLocalActive = (localData.activeBowls || []).filter(localBowl =>
        !firebaseActiveCodes.has(localBowl.code)
    );
    const mergedActive = [...(firebaseData.activeBowls || []), ...uniqueLocalActive];
    mergeStats.activeAdded = uniqueLocalActive.length;

    // FIX: Merge prepared bowls - include ALL prepared bowls from both sources
    const firebasePreparedMap = new Map();
    (firebaseData.preparedBowls || []).forEach(bowl => {
        firebasePreparedMap.set(bowl.code + '-' + bowl.date + '-' + bowl.user, bowl);
    });

    const localPreparedMap = new Map();
    (localData.preparedBowls || []).forEach(bowl => {
        localPreparedMap.set(bowl.code + '-' + bowl.date + '-' + bowl.user, bowl);
    });

    // Combine both prepared bowls, preferring the most recent timestamp
    const allPrepared = new Map([...firebasePreparedMap, ...localPreparedMap]);
    const mergedPrepared = Array.from(allPrepared.values());

    mergeStats.preparedAdded = mergedPrepared.length - (firebaseData.preparedBowls?.length || 0);

    // Merge returned bowls
    const firebaseReturnedCodes = new Set((firebaseData.returnedBowls || []).map(b => b.code));
    const uniqueLocalReturned = (localData.returnedBowls || []).filter(localBowl =>
        !firebaseReturnedCodes.has(localBowl.code)
    );
    const mergedReturned = [...(firebaseData.returnedBowls || []), ...uniqueLocalReturned];
    mergeStats.returnedAdded = uniqueLocalReturned.length;

    // Merge scan history and myScans
    const mergedScans = mergeArraysByTimestamp(firebaseData.myScans, localData.myScans);
    const mergedHistory = mergeArraysByTimestamp(firebaseData.scanHistory, localData.scanHistory);

    mergeStats.scansAdded = mergedScans.added;
    mergeStats.historyAdded = mergedHistory.added;

    const result = {
        activeBowls: mergedActive,
        preparedBowls: mergedPrepared, // This now includes ALL prepared bowls
        returnedBowls: mergedReturned,
        myScans: mergedScans.array,
        scanHistory: mergedHistory.array,
        customerData: firebaseData.customerData || localData.customerData || [],
        lastCleanup: firebaseData.lastCleanup || localData.lastCleanup,
        mergeStats: mergeStats
    };

    console.log('✅ Merge completed - Prepared bowls:', mergedPrepared.length);
    return result;
}

// Helper function to merge arrays by timestamp (keep most recent)
function mergeArraysByTimestamp(firebaseArray = [], localArray = []) {
    const combined = [...firebaseArray, ...localArray];
    const uniqueMap = new Map();

    combined.forEach(item => {
        const key = item.code + '-' + item.timestamp; // Use code + timestamp as unique key
        const existing = uniqueMap.get(key);

        if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
            uniqueMap.set(key, item);
        }
    });

    const uniqueArray = Array.from(uniqueMap.values());
    const added = uniqueArray.length - (firebaseArray.length || 0);

    // Sort by timestamp descending (most recent first)
    uniqueArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        array: uniqueArray,
        added: Math.max(0, added)
    };
}

// Get local data without affecting appData
function getLocalData() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.log('No local data found');
    }
    return {};
}

// ========== ENHANCED SCANNER FUNCTIONS ==========

// IMPROVED VYTAL URL DETECTION - Full URL preservation with partial scan detection
function detectVytCode(input) {
    if (!input || typeof input !== 'string') {
        console.log('❌ Invalid input for VYT detection');
        return null;
    }

    const cleanInput = input.trim();
    console.log('🔍 Scanning input:', cleanInput);

    // Check for partial scans (common ProGlove issues)
    if (cleanInput.length < 8) {
        console.log('⚠️ Possible partial scan - too short:', cleanInput.length, 'chars');
        showMessage('⚠️ Partial scan detected - please rescan', 'warning');
        return null;
    }

    // Enhanced VYT code detection - preserve FULL URL
    const vytPatterns = [
        /(VYT\.TO\/[^\s]+)/i,      // VYT.TO/ codes
        /(VYTAL[^\s]+)/i,          // VYTAL codes
        /(vyt\.to\/[^\s]+)/i,      // lowercase vyt.to/
        /(vytal[^\s]+)/i           // lowercase vytal
    ];

    for (const pattern of vytPatterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            const fullUrl = match[1];
            console.log('✅ VYT code detected:', fullUrl);
            return {
                fullUrl: fullUrl,
                type: fullUrl.includes('VYT.TO/') || fullUrl.includes('vyt.to/') ? 'VYT.TO' : 'VYTAL',
                originalInput: cleanInput
            };
        }
    }

    // Check if it might be a malformed VYT code
    if (cleanInput.includes('VYT') || cleanInput.includes('vyt')) {
        console.log('⚠️ Possible malformed VYT code:', cleanInput);
        showMessage('⚠️ Malformed VYT code - please rescan', 'warning');
    }

    console.log('❌ No VYT code found in input');
    return null;
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initializing Scanner System...');
    initializeFirebase();
    // initializeUI is called from within loadFromFirebase/loadFromStorage
});

function initializeUI() {
    initializeUsers(); // Initial load for all users (if no mode set) or just to set up dropdown
    setupEventListeners(); // Assuming this function exists in your HTML/other JS
    updateDisplay();
    startDailyCleanupTimer();
    updateOvernightStats();
}

function setupEventListeners() {
    // Placeholder for your actual event listeners
    document.getElementById('progloveInput')?.addEventListener('change', (e) => processScan(e.target.value));
    document.getElementById('progloveInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            processScan(e.target.value);
            e.target.value = ''; // Clear input after scan
        }
    });

    // NOTE: selectUser is called on 'change' event
    document.getElementById('userDropdown')?.addEventListener('change', selectUser);
    document.getElementById('dishDropdown')?.addEventListener('change', selectDishLetter);
    document.getElementById('kitchenBtn')?.addEventListener('click', () => setMode('kitchen'));
    document.getElementById('returnBtn')?.addEventListener('click', () => setMode('return'));
    document.getElementById('startBtn')?.addEventListener('click', startScanning);
    document.getElementById('stopBtn')?.addEventListener('click', stopScanning);
    document.getElementById('processJsonBtn')?.addEventListener('click', processJSONData);
    document.getElementById('exportActiveBtn')?.addEventListener('click', exportActiveBowls);
    document.getElementById('exportReturnBtn')?.addEventListener('click', exportReturnData);
    document.getElementById('exportAllBtn')?.addEventListener('click', exportAllData);
    document.getElementById('checkFirebaseBtn')?.addEventListener('click', checkFirebaseData);
    document.getElementById('syncFirebaseBtn')?.addEventListener('click', syncToFirebase);
    document.getElementById('loadFirebaseBtn')?.addEventListener('click', loadFromFirebase);
}

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

// utility function placeholder - needs to be defined for initializeUI to work
function showMessage(message, type) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Assume you have an HTML element to display messages (e.g., #messageBox)
    const msgBox = document.getElementById('messageBox');
    if (msgBox) {
        msgBox.textContent = message;
        msgBox.className = `message ${type}`;
        msgBox.style.display = 'block';
        setTimeout(() => msgBox.style.display = 'none', 5000);
    }
}


// ========== ENHANCED JSON PROCESSING WITH DATE EXTRACTION ==========

// UPDATED JSON Processing with Date Extraction
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();

    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }

    try {
        console.log('🔍 Starting JSON processing with date extraction...');
        showMessage('🔄 Processing JSON data with date tracking...', 'info');

        const jsonData = JSON.parse(jsonText);
        const extractedData = [];
        const patchResults = {
            matched: 0,
            created: 0,
            failed: 0,
            companiesProcessed: new Set(),
            datesExtracted: 0
        };

        if (jsonData.name && jsonData.boxes) {
            processCompanyDataWithDate(jsonData, extractedData, patchResults);
        } else if (Array.isArray(jsonData)) {
            jsonData.forEach(companyData => {
                if (companyData.name && companyData.boxes) {
                    processCompanyDataWithDate(companyData, extractedData, patchResults);
                }
            });
        } else if (jsonData.companies && Array.isArray(jsonData.companies)) {
            jsonData.companies.forEach(companyData => {
                if (companyData.name && companyData.boxes) {
                    processCompanyDataWithDate(companyData, extractedData, patchResults);
                }
            });
        } else {
            throw new Error('Unsupported JSON format');
        }

        extractedData.forEach(customer => {
            const exactVytCode = customer.vyt_code.toString().trim();
            const creationDate = customer.creationDate || new Date().toISOString();
            const matchingBowls = window.appData.activeBowls.filter(bowl => bowl.code === exactVytCode);

            if (matchingBowls.length > 0) {
                matchingBowls.forEach(bowl => {
                    bowl.company = customer.company || "Unknown";
                    bowl.customer = customer.customer || "Unknown";
                    bowl.dish = customer.dish || bowl.dish;
                    bowl.multipleCustomers = customer.multipleCustomers;
                    if (!bowl.creationDate && creationDate) {
                        bowl.creationDate = creationDate;
                        patchResults.datesExtracted++;
                    }
                });
                patchResults.matched += matchingBowls.length;
            } else {
                const newBowl = {
                    code: exactVytCode,
                    company: customer.company || "Unknown",
                    customer: customer.customer || "Unknown",
                    dish: customer.dish || "Unknown",
                    status: 'ACTIVE',
                    timestamp: new Date().toISOString(),
                    date: new Date().toLocaleDateString('en-GB'),
                    creationDate: creationDate,
                    multipleCustomers: customer.multipleCustomers,
                    daysActive: calculateDaysActive(creationDate)
                };
                window.appData.activeBowls.push(newBowl);
                patchResults.created++;
                patchResults.datesExtracted++;
            }
        });

        cleanupPreparedBowls();
        updateDisplay();
        syncToFirebase();
        showMessage(`✅ JSON processing completed: ${extractedData.length} VYT codes from ${patchResults.companiesProcessed.size} companies`, 'success');
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent =
            `Companies: ${patchResults.companiesProcessed.size} | VYT Codes: ${extractedData.length} | Updated: ${patchResults.matched} | Created: ${patchResults.created}`;
    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
        console.error('JSON processing error:', error);
    }
}

function processCompanyDataWithDate(companyData, extractedData, patchResults) {
    const companyName = companyData.name;
    patchResults.companiesProcessed.add(companyName);
    const creationDate = extractDateFromJSON(companyData);
    if (companyData.boxes && Array.isArray(companyData.boxes)) {
        companyData.boxes.forEach(box => {
            const boxCompany = extractCompanyFromUniqueIdentifier(box.uniqueIdentifier) || companyName;
            if (box.dishes && Array.isArray(box.dishes)) {
                box.dishes.forEach(dish => {
                    if (dish.bowlCodes && Array.isArray(dish.bowlCodes)) {
                        dish.bowlCodes.forEach(bowlCode => {
                            if (bowlCode && dish.users && dish.users.length > 0) {
                                const allCustomers = dish.users.map(user => user.username).filter(name => name);
                                const customerNames = allCustomers.join(', ');
                                extractedData.push({
                                    vyt_code: bowlCode,
                                    company: boxCompany,
                                    customer: customerNames,
                                    dish: dish.label || '',
                                    multipleCustomers: allCustomers.length > 1,
                                    creationDate: creationDate
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

function extractDateFromJSON(jsonData) {
    const dateFields = ['createdAt', 'creationDate', 'date', 'timestamp', 'created', 'orderDate'];
    for (const field of dateFields) {
        if (jsonData[field]) return new Date(jsonData[field]).toISOString();
    }
    return new Date().toISOString();
}

function calculateDaysActive(creationDate) {
    if (!creationDate) return 0;
    const created = new Date(creationDate);
    const today = new Date();
    return Math.ceil(Math.abs(today - created) / (1000 * 60 * 60 * 24));
}

// ========== ENHANCED EXPORT FUNCTIONS WITH DATE TRACKING ==========
function exportActiveBowls() {
    if (window.appData.activeBowls.length === 0) {
        showMessage('❌ No active bowls to export', 'error');
        return;
    }
    const bowlsWithDaysActive = window.appData.activeBowls.map(bowl => ({
        ...bowl,
        daysActive: bowl.creationDate ? calculateDaysActive(bowl.creationDate) : 0
    }));
    const csvData = convertToCSV(bowlsWithDaysActive, ['code', 'dish', 'company', 'customer', 'creationDate', 'daysActive', 'user', 'date', 'time']);
    downloadCSV(csvData, 'active_bowls_with_dates.csv');
}

function exportAllData() {
    loadXLSXLibrary().then(() => {
        const wb = XLSX.utils.book_new();
        const activeData = window.appData.activeBowls.map(b => ({ 'VYT Code': b.code, 'Dish': b.dish, 'Company': b.company, 'Customer': b.customer, 'Creation Date': b.creationDate ? new Date(b.creationDate).toLocaleDateString('en-GB') : 'Unknown', 'Days Active': b.creationDate ? calculateDaysActive(b.creationDate) : 0 }));
        if (activeData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeData), 'Active Bowls');
        const preparedData = window.appData.preparedBowls.map(b => ({ 'Code': b.code, 'Dish': b.dish, 'User': b.user, 'Date': b.date, 'Time': b.time }));
        if (preparedData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(preparedData), 'Prepared Bowls');
        const returnedData = window.appData.returnedBowls.map(b => ({ 'Code': b.code, 'Dish': b.dish, 'Returned By': b.returnedBy, 'Return Date': b.returnDate, 'Return Time': b.returnTime }));
        if (returnedData.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(returnedData), 'Returned Bowls');
        if (wb.SheetNames.length === 0) return showMessage('❌ No data to export', 'error');
        XLSX.writeFile(wb, 'complete_scanner_data.xlsx');
        showMessage('✅ All data exported as Excel.', 'success');
    }).catch(err => showMessage('❌ Excel export failed.', 'error'));
}

function exportReturnData() {
    const today = new Date().toLocaleDateString('en-GB');
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    if (todayReturns.length === 0) return showMessage('❌ No returns to export today', 'error');
    downloadCSV(convertToCSV(todayReturns, ['code', 'dish', 'returnedBy', 'returnDate', 'returnTime']), 'return_data.csv');
}

function convertToCSV(data, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => fields.map(field => `"${item[field] || ''}"`).join(','));
    return [headers, ...rows].join('\n');
}

function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
}

// ========== ENHANCED SYNC AND STORAGE FUNCTIONS ==========
function syncToFirebase() {
    try {
        saveToStorage();
        if (typeof firebase === 'undefined') {
            updateFirebaseConnectionStatus('disconnected');
            return;
        }
        const db = firebase.database();
        const backupData = {
            activeBowls: window.appData.activeBowls || [], preparedBowls: window.appData.preparedBowls || [],
            returnedBowls: window.appData.returnedBowls || [], myScans: window.appData.myScans || [],
            scanHistory: window.appData.scanHistory || [], customerData: window.appData.customerData || [],
            lastCleanup: window.appData.lastCleanup, lastSync: new Date().toISOString()
        };
        db.ref('progloveData').set(backupData).then(() => {
            window.appData.lastSync = new Date().toISOString();
            document.getElementById('systemStatus').textContent = '✅ Cloud Synced';
            updateFirebaseConnectionStatus('connected');
        }).catch(err => {
            document.getElementById('systemStatus').textContent = '⚠️ Sync Failed';
            updateFirebaseConnectionStatus('error');
        });
    } catch (e) { 
        console.error('Sync error:', e);
        updateFirebaseConnectionStatus('error');
    }
}

function saveToStorage() {
    try {
        const dataToSave = { ...window.appData };
        localStorage.setItem('proglove_data', JSON.stringify(dataToSave));
    } catch (e) { console.error('Storage save error:', e); }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            Object.assign(window.appData, JSON.parse(saved), {
                mode: window.appData.mode, user: window.appData.user,
                dishLetter: window.appData.dishLetter, scanning: window.appData.scanning
            });
            cleanupPreparedBowls();
            cleanupIncompleteBowls();
        }
    } catch (e) { console.error('Storage load error:', e); }
}

// ========== SCANNING AND BOWL MANAGEMENT ==========

// More robust scan processing to prevent both concurrent and duplicate scans
function processScan(input) {
    // Prevent concurrent executions of this function
    if (window.appData.isProcessingScan) {
        console.warn('⚠️ Scan ignored: processing already in progress.');
        return;
    }

    if (!window.appData.scanning) {
        showMessage('❌ Scanning not active', 'error');
        return;
    }

    window.appData.isProcessingScan = true; // Set processing lock
    const startTime = Date.now();

    try {
        const vytInfo = detectVytCode(input);
        if (!vytInfo) {
            showMessage("❌ Invalid or partial VYT code", "error");
            return; // Exit if the code is not valid
        }
        
        const now = Date.now();
        const lastScan = window.appData.lastScannedCode;
        const DUPLICATE_SCAN_WINDOW_MS = 2000; // 2-second window to ignore duplicates

        // Prevent accidental double-scans of the SAME bowl within the window
        if (lastScan && lastScan.code === vytInfo.fullUrl && (now - lastScan.timestamp) < DUPLICATE_SCAN_WINDOW_MS) {
            console.warn(`Duplicate scan ignored: ${vytInfo.fullUrl}`);
            showMessage('⚠️ Duplicate scan ignored', 'warning');
            return; // Exit if it's a duplicate
        }

        // If it's a new, valid scan, update the last scanned code immediately
        window.appData.lastScannedCode = { code: vytInfo.fullUrl, timestamp: now };

        // Process the scan based on the current mode
        const result = window.appData.mode === 'kitchen' ? kitchenScan(vytInfo) : returnScan(vytInfo);
        
        // Only show a message if the processing was successful
        if (result) {
            showMessage(result.message, result.type);
        }

        // Update UI and stats
        document.getElementById('responseTimeValue').textContent = `${Date.now() - startTime}ms`;
        updateDisplay();
        updateOvernightStats();
        updateLastActivity();

    } catch (e) {
        console.error('Scan processing error:', e);
        showMessage("❌ Scan processing error", "error");
    } finally {
        // IMPORTANT: Always release the lock
        // Use a short timeout to prevent the lock from re-engaging too quickly
        setTimeout(() => {
            window.appData.isProcessingScan = false;
        }, 100); 
    }
}


function kitchenScan(vytInfo) {
    const today = new Date().toLocaleDateString('en-GB');
    const fullCode = vytInfo.fullUrl;

    // Check if this exact bowl was already prepared by this user today with the same dish letter
    if (window.appData.preparedBowls.some(b => b.code === fullCode && b.date === today && b.user === window.appData.user && b.dish === window.appData.dishLetter)) {
        return { message: `❌ You already prepared this bowl today`, type: "error" };
    }

    let hadCustomerData = false;
    // Find and remove the bowl from the active list if it exists
    const activeIndex = window.appData.activeBowls.findIndex(b => b.code === fullCode);
    if (activeIndex !== -1) {
        window.appData.activeBowls.splice(activeIndex, 1);
        hadCustomerData = true; // Mark that this bowl was previously active
    }

    // Create the new prepared bowl record
    const preparedBowl = {
        code: fullCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown",
        customer: "Unknown",
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'PREPARED'
    };
    window.appData.preparedBowls.push(preparedBowl);

    // Log the scan for the user's stats
    window.appData.myScans.push({ type: 'kitchen', code: fullCode, dish: window.appData.dishLetter, user: window.appData.user, timestamp: new Date().toISOString(), hadPreviousCustomer: hadCustomerData });
    
    // Create the message and add to global history
    const message = `✅ ${window.appData.dishLetter} Prepared: ${fullCode.slice(-8)} ${hadCustomerData ? '(reset)' : ''}`;
    window.appData.scanHistory.unshift({ type: 'kitchen', code: fullCode, user: window.appData.user, timestamp: new Date().toISOString(), message });
    
    syncToFirebase(); // Sync changes
    return { message, type: "success" };
}

function returnScan(vytInfo) {
    const today = new Date().toLocaleDateString('en-GB');
    const fullCode = vytInfo.fullUrl;

    // Check if the bowl was prepared today. It must be in the prepared list to be returned.
    const preparedIndex = window.appData.preparedBowls.findIndex(b => b.code === fullCode && b.date === today);
    if (preparedIndex === -1) {
        return { message: "❌ Bowl not prepared today", type: "error" };
    }

    // Remove from prepared list and add to returned list
    const preparedBowl = window.appData.preparedBowls.splice(preparedIndex, 1)[0];
    const returnedBowl = {
        code: fullCode,
        dish: preparedBowl.dish,
        returnedBy: window.appData.user,
        returnDate: today,
        returnTime: new Date().toLocaleTimeString(),
        status: 'RETURNED'
    };
    window.appData.returnedBowls.push(returnedBowl);

    // Log the scan for the user's stats
    window.appData.myScans.push({ type: 'return', code: fullCode, dish: preparedBowl.dish, user: window.appData.user, timestamp: new Date().toISOString() });
    
    // Create the message and add to global history
    const message = `✅ ${preparedBowl.dish} Returned: ${fullCode.slice(-8)}`;
    window.appData.scanHistory.unshift({ type: 'return', code: fullCode, user: window.appData.user, timestamp: new Date().toISOString(), message });
    
    syncToFirebase(); // Sync changes
    return { message, type: "success" };
}

function cleanupIncompleteBowls() {
    const today = new Date().toLocaleDateString('en-GB');
    window.appData.preparedBowls = window.appData.preparedBowls.filter(bowl => bowl.date === today);
    window.appData.returnedBowls = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
}

function startDailyCleanupTimer() {
    const now = new Date();
    const nextCleanup = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const timeUntilCleanup = nextCleanup - now;
    setTimeout(() => {
        cleanupIncompleteBowls();
        window.appData.lastCleanup = new Date().toISOString();
        syncToFirebase();
        setInterval(cleanupIncompleteBowls, 24 * 60 * 60 * 1000);
    }, timeUntilCleanup);
}

function updateOvernightStats() {
    const today = new Date().toLocaleDateString('en-GB');
    const overnightActive = window.appData.activeBowls.filter(bowl => bowl.date !== today).length;
    if (overnightActive > 0) {
        document.getElementById('overnightActiveValue').textContent = overnightActive;
        document.getElementById('overnightStats').style.display = 'block';
    } else {
        document.getElementById('overnightStats').style.display = 'none';
    }
}

// ========== USER INTERFACE FUNCTIONS ==========

// FIXED: Initialize users properly
function initializeUsers() {
    const userDropdown = document.getElementById('userDropdown');
    if (!userDropdown) return;

    // Clear existing options except the first one
    while (userDropdown.options.length > 1) {
        userDropdown.remove(1);
    }

    // Add all users from the USERS array
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = `${user.name} (${user.role})`;
        userDropdown.appendChild(option);
    });

    // If no user is selected, select the first one
    if (!window.appData.user && userDropdown.options.length > 0) {
        userDropdown.selectedIndex = 0;
        selectUser(); // This will set the user and update the mode
    }
}

function selectUser() {
    const userDropdown = document.getElementById('userDropdown');
    if (!userDropdown) return;

    const selectedUserName = userDropdown.value;
    const selectedUser = USERS.find(user => user.name === selectedUserName);
    
    if (selectedUser) {
        window.appData.user = selectedUser.name;
        console.log(`👤 User selected: ${selectedUser.name} (${selectedUser.role})`);
        
        // Automatically set mode based on user role
        if (selectedUser.role === 'Kitchen') {
            setMode('kitchen');
        } else if (selectedUser.role === 'Return') {
            setMode('return');
        }
        
        updateDisplay();
    }
}

function selectDishLetter() {
    const dishDropdown = document.getElementById('dishDropdown');
    if (!dishDropdown) return;

    window.appData.dishLetter = dishDropdown.value;
    console.log(`🍽️ Dish letter selected: ${window.appData.dishLetter}`);
    updateDisplay();
}

function setMode(mode) {
    window.appData.mode = mode;
    console.log(`🎯 Mode set to: ${mode}`);
    
    // Update UI to reflect mode
    const kitchenBtn = document.getElementById('kitchenBtn');
    const returnBtn = document.getElementById('returnBtn');
    
    if (kitchenBtn && returnBtn) {
        if (mode === 'kitchen') {
            kitchenBtn.classList.add('active');
            returnBtn.classList.remove('active');
        } else if (mode === 'return') {
            returnBtn.classList.add('active');
            kitchenBtn.classList.remove('active');
        }
    }
    
    updateDisplay();
}

function startScanning() {
    if (!window.appData.user) {
        showMessage('❌ Please select a user first', 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage('❌ Please select a dish letter first', 'error');
        return;
    }
    
    window.appData.scanning = true;
    console.log('🔴 Scanning started');
    showMessage('✅ Scanning started', 'success');
    updateDisplay();
}

function stopScanning() {
    window.appData.scanning = false;
    console.log('⭕ Scanning stopped');
    showMessage('⭕ Scanning stopped', 'info');
    updateDisplay();
}

function updateDisplay() {
    const activeCount = window.appData.activeBowls.length;
    const preparedCount = window.appData.preparedBowls.length;
    const returnedCount = window.appData.returnedBowls.length;
    const scanCount = window.appData.myScans.length;

    document.getElementById('activeCount').textContent = activeCount;
    document.getElementById('preparedCount').textContent = preparedCount;
    document.getElementById('returnedCount').textContent = returnedCount;
    document.getElementById('scanCount').textContent = scanCount;

    const userDisplay = document.getElementById('currentUser');
    const modeDisplay = document.getElementById('currentMode');
    const dishDisplay = document.getElementById('currentDish');
    const scanningDisplay = document.getElementById('scanningStatus');

    if (userDisplay) userDisplay.textContent = window.appData.user || 'Not selected';
    if (modeDisplay) modeDisplay.textContent = window.appData.mode || 'Not set';
    if (dishDisplay) dishDisplay.textContent = window.appData.dishLetter || 'Not set';
    if (scanningDisplay) scanningDisplay.textContent = window.appData.scanning ? '🟢 ACTIVE' : '⭕ INACTIVE';

    updateScanHistory();
}

function updateScanHistory() {
    const historyContainer = document.getElementById('scanHistory');
    if (!historyContainer) return;

    const recentHistory = window.appData.scanHistory.slice(0, 10);
    historyContainer.innerHTML = '';

    recentHistory.forEach(entry => {
        const div = document.createElement('div');
        div.className = `history-item ${entry.type}`;
        div.textContent = `${entry.timestamp.split('T')[1].split('.')[0]} - ${entry.message || `${entry.type}: ${entry.code.slice(-8)}`}`;
        historyContainer.appendChild(div);
    });
}

function checkFirebaseData() {
    if (typeof firebase === 'undefined') {
        showMessage('❌ Firebase not loaded', 'error');
        return;
    }
    const db = firebase.database();
    const appDataRef = db.ref('progloveData');
    appDataRef.once('value').then(snapshot => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const stats = {
                active: data.activeBowls?.length || 0,
                prepared: data.preparedBowls?.length || 0,
                returned: data.returnedBowls?.length || 0,
                scans: data.myScans?.length || 0,
                lastSync: data.lastSync || 'Never'
            };
            showMessage(`📊 Firebase: ${stats.active}A ${stats.prepared}P ${stats.returned}R ${stats.scans}S | Last: ${stats.lastSync}`, 'info');
        } else {
            showMessage('❌ No data in Firebase', 'warning');
        }
    }).catch(err => {
        showMessage('❌ Firebase check failed: ' + err.message, 'error');
    });
}

function extractCompanyFromUniqueIdentifier(uniqueIdentifier) {
    if (!uniqueIdentifier) return null;
    const parts = uniqueIdentifier.split('-');
    return parts.length > 0 ? parts[0] : null;
}

// ========== INITIALIZATION ==========
console.log('🚀 Scanner System loaded successfully');
[file content end]
