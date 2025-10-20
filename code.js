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

// NEW FUNCTION: Update Firebase connection status
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

            updateFirebaseConnectionStatus('connected');
            loadFromFirebase();
        })
        .catch((error) => {
            console.error('❌ Failed to load Firebase SDK:', error);
            updateFirebaseConnectionStatus('error');
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage (Firebase failed)', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
        });
}

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

                    // Clean up prepared bowls - move bowls with customer data to active
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
    // Scanner input
    document.getElementById('progloveInput')?.addEventListener('change', (e) => processScan(e.target.value));
    document.getElementById('progloveInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            processScan(e.target.value);
            e.target.value = ''; // Clear input after scan
        }
    });

    // User and dish selection
    document.getElementById('userDropdown')?.addEventListener('change', selectUser);
    document.getElementById('dishDropdown')?.addEventListener('change', selectDishLetter);
    
    // Mode buttons
    document.getElementById('kitchenBtn')?.addEventListener('click', () => setMode('kitchen'));
    document.getElementById('returnBtn')?.addEventListener('click', () => setMode('return'));
    
    // Control buttons
    document.getElementById('startBtn')?.addEventListener('click', startScanning);
    document.getElementById('stopBtn')?.addEventListener('click', stopScanning);
    
    // Data management buttons
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

    // Log the scan for user stats and global history
    window.appData.myScans.push({ type: 'return', code: fullCode, user: window.appData.user, timestamp: new Date().toISOString() });
    const message = `✅ Returned: ${fullCode.slice(-8)}`;
    window.appData.scanHistory.unshift({ type: 'return', code: fullCode, user: window.appData.user, timestamp: new Date().toISOString(), message });
    
    syncToFirebase(); // Sync changes
    return { message, type: "success" };
}

function startScanning() {
    if (!window.appData.user) { showMessage('❌ Select user first', 'error'); return; }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) { showMessage('❌ Select dish letter first', 'error'); return; }
    window.appData.scanning = true;
    updateDisplay();
    document.getElementById('progloveInput').focus();
    showMessage(`🎯 SCANNING ACTIVE`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    showMessage(`⏹ Scanning stopped`, 'info');
}

// ========== USER AND MODE MANAGEMENT (FIXED FOR TABLETS) ==========
function initializeUsers() {
    // This is primarily for initial setup/placeholder. loadUsers is called after mode selection.
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Select Mode First --</option>'; 
}

function setMode(mode) {
    window.appData.mode = mode;
    // Reset user and stop scanning when changing mode
    Object.assign(window.appData, { user: null, dishLetter: null, scanning: false }); 
    
    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    
    const dishDropdown = document.getElementById('dishDropdown');
    if(dishDropdown) dishDropdown.value = '';

    // Correctly load users after setting the mode
    loadUsers(); 
    
    // IMPORTANT FIX FOR TABLETS: Manually reset the dropdown value after loading options
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        userDropdown.value = '';
    }
    
    updateStatsLabels();
    updateDisplay();
    showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
}

/**
 * FIX: This is the critical function to ensure users are filtered and loaded correctly
 * based on the active mode (Kitchen or Return) and is robust for dynamic updates.
 */
function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    // 1. CLEAR AND RESET THE DROPDOWN
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    dropdown.value = ''; 
    
    const currentMode = window.appData.mode;

    if (!currentMode) {
        return;
    }

    // Filter users based on mode.role (case-insensitive)
    const usersToShow = USERS.filter(user => 
        user.role.toLowerCase() === currentMode.toLowerCase()
    );

    // 2. POPULATE OPTIONS
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });

    // 3. Enable the dropdown
    dropdown.disabled = false;
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    const selectedValue = dropdown.value;
    
    // Only proceed if a user (not the placeholder) is selected AND it's a new selection
    if (selectedValue && selectedValue !== window.appData.user) {
        window.appData.user = selectedValue;
        
        showMessage(`✅ ${window.appData.user} selected`, 'success');
        
        if (window.appData.mode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            loadDishLetters();
        } else if (window.appData.mode === 'return') {
            // Automatically start scanning in return mode once user is selected
            startScanning();
        }
    } else if (!selectedValue) {
        // Handle case where user selects the placeholder or nothing
        window.appData.user = null;
        window.appData.scanning = false;
        stopScanning();
    }
    updateDisplay();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Dish Letter --</option>';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split('').forEach(l => {
        const option = document.createElement('option');
        option.value = l; option.textContent = l; dropdown.appendChild(option);
    });
    dropdown.disabled = false;
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    window.appData.dishLetter = dropdown.value;
    if(window.appData.dishLetter) showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
    updateDisplay();
}

// ========== DISPLAY AND UTILITY FUNCTIONS ==========
function updateDisplay() {
    const { user, scanning, mode, dishLetter, activeBowls, preparedBowls, returnedBowls, myScans } = window.appData;
    const today = new Date().toLocaleDateString('en-GB');
    const canScan = user && (mode !== 'kitchen' || dishLetter);
    document.getElementById('startBtn').disabled = !canScan || scanning;
    document.getElementById('stopBtn').disabled = !scanning;
    const input = document.getElementById('progloveInput');
    document.getElementById('scanSection').classList.toggle('scanning-active', scanning);
    if(input) input.disabled = !scanning;
    if(input && !scanning) input.placeholder = "Click START SCANNING...";
    if(input && scanning) input.placeholder = "Scan VYT code...";
    
    document.getElementById('activeCount').textContent = activeBowls.length;
    const preparedToday = preparedBowls.filter(b => b.date === today).length;
    const returnedToday = returnedBowls.filter(b => b.returnDate === today).length;
    const userScansToday = myScans.filter(s => s.user === user && new Date(s.timestamp).toLocaleDateString('en-GB') === today).length;
    
    // Ensure prepLabel is updated based on current mode
    document.getElementById('prepCount').textContent = mode === 'kitchen' ? preparedToday : returnedToday;
    document.getElementById('myScansCount').textContent = userScansToday;
    
    document.getElementById('exportInfo').innerHTML = `<strong>Data Status:</strong> Active: ${activeBowls.length} • Prepared: ${preparedToday} • Returns: ${returnedToday}`;
}

function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    if (!statsBody || !cycleInfo) return;
    const now = new Date();
    const today10AM = new Date(now); today10AM.setHours(10, 0, 0, 0);
    const yesterday10PM = new Date(now); yesterday10PM.setDate(yesterday10PM.getDate() - 1); yesterday10PM.setHours(22, 0, 0, 0);
    const isOvernight = now >= yesterday10PM && now <= today10AM;
    cycleInfo.textContent = `Cycle: ${isOvernight ? 'Yesterday 10PM - Today 10AM' : 'Today 10AM - Tomorrow 10AM'}`;
    
    // Determine the correct time window for scans
    let filterStart = today10AM;
    let filterEnd = new Date(now);

    if (isOvernight) {
        filterStart = yesterday10PM;
    } else {
        // If not overnight, check if it's past 10 AM today
        if (now.getHours() >= 10) {
            filterStart = today10AM;
        } else {
            // Before 10 AM, use yesterday's 10 AM
            filterStart = new Date(now);
            filterStart.setDate(filterStart.getDate() - 1);
            filterStart.setHours(10, 0, 0, 0);
        }
    }
    
    const scans = window.appData.myScans.filter(s => {
        const scanTime = new Date(s.timestamp);
        return scanTime >= filterStart && scanTime <= filterEnd;
    });

    const stats = Object.values(scans.reduce((acc, { dish, user, timestamp }) => {
        const key = `${dish}-${user}`;
        if (!acc[key]) acc[key] = { dish, user, count: 0, scans: [] };
        acc[key].count++;
        acc[key].scans.push(timestamp);
        return acc;
    }, {})).sort((a,b) => (a.dish > b.dish) ? 1 : -1);
    
    if (stats.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No current cycle scans</td></tr>';
        return;
    }
    statsBody.innerHTML = stats.map(s => `<tr><td class="dish-header">${s.dish || 'N/A'}</td><td>${s.user}</td><td>${s.count}</td><td>${new Date(s.scans[0]).toLocaleTimeString()}</td><td>${new Date(s.scans[s.scans.length - 1]).toLocaleTimeString()}</td></tr>`).join('');
}

// ========== CLEANUP AND MAINTENANCE FUNCTIONS ==========
function cleanupIncompleteBowls() {
    const initialCount = window.appData.activeBowls.length;
    window.appData.activeBowls = window.appData.activeBowls.filter(b => !(b.company && b.company !== "Unknown" && (!b.customer || b.customer === "Unknown")));
    if (initialCount - window.appData.activeBowls.length > 0) console.log(`✅ Cleaned up ${initialCount - window.appData.activeBowls.length} incomplete bowls`);
}

function startDailyCleanupTimer() { setInterval(() => { const now = new Date(); if (now.getHours() === 19 && now.getMinutes() === 0) clearReturnData(); }, 60000); }
function clearReturnData() {
    const today = new Date().toLocaleDateString('en-GB');
    if (window.appData.lastCleanup === today) return;
    window.appData.returnedBowls = [];
    window.appData.lastCleanup = today;
    syncToFirebase();
    showMessage('✅ Return data cleared', 'success');
    updateDisplay();
}

function checkFirebaseData() {
    if (typeof firebase === 'undefined') return showMessage('❌ Firebase not loaded', 'error');
    firebase.database().ref('progloveData').once('value').then(s => {
        if (s.exists()) {
            const d = s.val();
            showMessage(`✅ Firebase: ${d.activeBowls?.length || 0}a, ${d.preparedBowls?.length || 0}p, ${d.returnedBowls?.length || 0}r`, 'success');
        } else {
            showMessage('❌ No data in Firebase', 'warning');
        }
    }).catch(err => showMessage('❌ Error: ' + err.message, 'error'));
}

function extractCompanyFromUniqueIdentifier(id) {
    if (!id) return "Unknown";
    const parts = id.split('-');
    return parts.length >= 3 ? parts.slice(2, -1).join(' ').trim() : id;
}

function combineCustomerNamesByDish() {
    const groups = window.appData.activeBowls.reduce((acc, b) => { (acc[b.dish] = acc[b.dish] || []).push(b); return acc; }, {});
    Object.values(groups).forEach(bowls => {
        if (bowls.length > 1) {
            const customers = [...new Set(bowls.map(b => b.customer).filter(c => c && c !== "Unknown"))].join(', ');
            bowls.forEach(b => { b.customer = customers; b.multipleCustomers = true; });
        } else if (bowls[0].customer && bowls[0].customer !== "Unknown") {
            bowls[0].multipleCustomers = false;
        }
    });
}

function getCustomerNameColor(bowl) {
    return bowl.multipleCustomers ? 'red-text' : (bowl.customer && bowl.customer !== "Unknown" ? 'green-text' : '');
}

// Missing utility functions
function updateStatsLabels() {
    // Update labels based on mode
    const prepLabel = document.querySelector('.metric-item:nth-child(2) .metric-label');
    if (prepLabel && window.appData.mode) {
        prepLabel.textContent = window.appData.mode === 'kitchen' ? 'Prepared Today' : 'Returned Today';
    }
}

// ========== GLOBAL FUNCTION EXPORTS ==========
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.processJSONData = processJSONData;
window.exportActiveBowls = exportActiveBowls;
window.exportReturnData = exportReturnData;
window.exportAllData = exportAllData;
window.checkFirebaseData = checkFirebaseData;
window.syncToFirebase = syncToFirebase;
window.loadFromFirebase = loadFromFirebase;
window.showMessage = showMessage;
