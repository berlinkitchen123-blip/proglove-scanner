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
    lastSync: null
};

// CORRECTED USER LIST
const USERS = [
    {name: "Hamid", role: "Kitchen"},
    {name: "Richa", role: "Kitchen"},
    {name: "Jash", role: "Kitchen"},
    {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"},
    {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"},
    {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"},
    {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
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
        script.onload = function() {
            console.log('✅ XLSX library loaded');
            resolve();
        };
        script.onerror = function() {
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
        scriptApp.onload = function() {
            console.log('✅ Firebase App loaded');
            const scriptDatabase = document.createElement('script');
            scriptDatabase.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
            scriptDatabase.onload = function() {
                console.log('✅ Firebase Database loaded');
                resolve();
            };
            scriptDatabase.onerror = function() {
                reject(new Error('Failed to load Firebase Database'));
            };
            document.head.appendChild(scriptDatabase);
        };
        scriptApp.onerror = function() {
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
            
            loadFromFirebase();
        })
        .catch((error) => {
            console.error('❌ Failed to load Firebase SDK:', error);
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage (Firebase failed)', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
        });
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
                    
                    showMessage('✅ Cloud data loaded with smart merge', 'success');
                    document.getElementById('systemStatus').textContent = '✅ Cloud Connected';
                    
                    cleanupIncompleteBowls();
                    initializeUI();
                    
                } else {
                    console.log('❌ No data in Firebase, using local data');
                    showMessage('❌ No cloud data - using local data', 'warning');
                    document.getElementById('systemStatus').textContent = '✅ Cloud Connected (No Data)';
                    loadFromStorage();
                    initializeUI();
                }
            })
            .catch((error) => {
                console.error('Firebase load error:', error);
                showMessage('❌ Cloud load failed: ' + error.message, 'error');
                document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Load Error';
                loadFromStorage();
                initializeUI();
            });
    } catch (error) {
        console.error('Firebase error:', error);
        showMessage('❌ Firebase error: ' + error.message, 'error');
        document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Firebase Error';
        loadFromStorage();
        initializeUI();
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

// Initialize System
function initializeUI() {
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyCleanupTimer();

    // FIXED: Better event listener for ProGlove input
    const progloveInput = document.getElementById('progloveInput');
    if (progloveInput) {
        progloveInput.addEventListener('input', handleScanInput);
        progloveInput.addEventListener('keydown', handleKeyDown);
        progloveInput.addEventListener('change', handleScanChange);
    }
    
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Scanner System...');
    initializeFirebase();
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

// FIXED: Better input handling for ProGlove scanner
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const scanValue = e.target.value.trim();
        if (scanValue && window.appData.scanning) {
            processScan(scanValue);
            e.target.value = '';
        }
    }
}

function handleScanChange(e) {
    if (!window.appData.scanning) return;
    
    const scanValue = e.target.value.trim();
    if (scanValue.length >= 5) {
        processScan(scanValue);
        setTimeout(() => {
            e.target.value = '';
            e.target.focus();
        }, 50);
    }
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;

    const scanValue = e.target.value.trim();
    if (scanValue.length >= 3 && (scanValue.includes('VYT') || scanValue.includes('vyt'))) {
        processScan(scanValue);
        setTimeout(() => {
            e.target.value = '';
            e.target.focus();
        }, 100);
    }
    updateLastActivity();
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

        // PROCESS SINGLE COMPANY
        if (jsonData.name && jsonData.boxes) {
            console.log(`📦 Processing single company: ${jsonData.name}`);
            processCompanyDataWithDate(jsonData, extractedData, patchResults);
        }
        // PROCESS ARRAY OF COMPANIES
        else if (Array.isArray(jsonData)) {
            console.log(`🏢 Processing ${jsonData.length} companies in array`);
            jsonData.forEach((companyData, index) => {
                if (companyData.name && companyData.boxes) {
                    console.log(`📦 [${index + 1}/${jsonData.length}] Processing: ${companyData.name}`);
                    processCompanyDataWithDate(companyData, extractedData, patchResults);
                }
            });
        }
        // PROCESS NESTED COMPANIES
        else if (jsonData.companies && Array.isArray(jsonData.companies)) {
            console.log(`🏢 Processing ${jsonData.companies.length} companies from companies array`);
            jsonData.companies.forEach((companyData, index) => {
                if (companyData.name && companyData.boxes) {
                    console.log(`📦 [${index + 1}/${jsonData.companies.length}] Processing: ${companyData.name}`);
                    processCompanyDataWithDate(companyData, extractedData, patchResults);
                }
            });
        }
        else {
            throw new Error('Unsupported JSON format');
        }

        console.log('📊 Extracted data with dates:', extractedData);
        console.log(`🏢 Companies processed: ${Array.from(patchResults.companiesProcessed).join(', ')}`);
        console.log(`📅 Dates extracted: ${patchResults.datesExtracted}`);

        // Process each extracted VYT code with date tracking
        extractedData.forEach(customer => {
            const exactVytCode = customer.vyt_code.toString().trim();
            const creationDate = customer.creationDate || new Date().toISOString();
            
            console.log(`Looking for bowl: ${exactVytCode} (Created: ${creationDate})`);

            // Find ALL active bowls with this EXACT VYT code
            const matchingBowls = window.appData.activeBowls.filter(bowl => {
                return bowl.code === exactVytCode;
            });

            if (matchingBowls.length > 0) {
                console.log(`✅ Found ${matchingBowls.length} matches for ${exactVytCode}`);

                // Update ALL matching bowls with new customer data AND DATE
                matchingBowls.forEach(bowl => {
                    const oldCompany = bowl.company;
                    const oldCustomer = bowl.customer;

                    bowl.company = customer.company || "Unknown";
                    bowl.customer = customer.customer || "Unknown";
                    bowl.dish = customer.dish || bowl.dish;
                    bowl.multipleCustomers = customer.multipleCustomers;
                    
                    // UPDATE CREATION DATE if not already set
                    if (!bowl.creationDate && creationDate) {
                        bowl.creationDate = creationDate;
                        patchResults.datesExtracted++;
                    }

                    console.log(`🔄 Updated bowl ${bowl.code}: Company "${oldCompany}" → "${bowl.company}" | Date: ${bowl.creationDate}`);
                });

                patchResults.matched += matchingBowls.length;
            } else {
                // Create new bowl with date tracking
                console.log(`🆕 Creating new bowl with date tracking: ${exactVytCode}`);
                const newBowl = {
                    code: exactVytCode,
                    company: customer.company || "Unknown",
                    customer: customer.customer || "Unknown",
                    dish: customer.dish || "Unknown",
                    status: 'ACTIVE',
                    timestamp: new Date().toISOString(),
                    date: new Date().toLocaleDateString('en-GB'),
                    creationDate: creationDate, // Store creation date from JSON
                    multipleCustomers: customer.multipleCustomers,
                    daysActive: calculateDaysActive(creationDate) // Calculate days active
                };
                
                window.appData.activeBowls.push(newBowl);
                patchResults.created++;
                patchResults.datesExtracted++;
            }
        });

        // Update display and save
        updateDisplay();
        syncToFirebase();

        // Show comprehensive results with date info
        showMessage(`✅ JSON processing completed: ${extractedData.length} VYT codes from ${patchResults.companiesProcessed.size} companies (${patchResults.datesExtracted} dates extracted)`, 'success');

        // Show detailed results
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Companies: ${patchResults.companiesProcessed.size} | VYT Codes: ${extractedData.length} | Updated: ${patchResults.matched} | Created: ${patchResults.created} | Dates: ${patchResults.datesExtracted}`;

        const failedDiv = document.getElementById('failedMatches');
        if (patchResults.failed > 0) {
            failedDiv.innerHTML = `<strong>Failed:</strong> ${patchResults.failed} bowls could not be processed`;
        } else {
            failedDiv.innerHTML = '<em>All VYT codes processed successfully!</em>';
        }

        document.getElementById('jsonStatus').innerHTML = 
            `<strong>JSON Status:</strong> Processed ${extractedData.length} VYT codes from ${patchResults.companiesProcessed.size} companies with date tracking`;

        console.log('📊 Final results:', patchResults);

    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
        console.error('JSON processing error:', error);
    }
}

// Enhanced company data processing with date extraction
function processCompanyDataWithDate(companyData, extractedData, patchResults) {
    const companyName = companyData.name;
    patchResults.companiesProcessed.add(companyName);

    // Extract creation date from JSON (various possible fields)
    const creationDate = extractDateFromJSON(companyData);

    if (companyData.boxes && Array.isArray(companyData.boxes)) {
        companyData.boxes.forEach(box => {
            const boxCompany = extractCompanyFromUniqueIdentifier(box.uniqueIdentifier) || companyName;
            
            if (box.dishes && Array.isArray(box.dishes)) {
                box.dishes.forEach(dish => {
                    if (dish.bowlCodes && Array.isArray(dish.bowlCodes)) {
                        dish.bowlCodes.forEach(bowlCode => {
                            if (bowlCode && dish.users && dish.users.length > 0) {
                                // Get all customer names for this dish
                                const allCustomers = dish.users.map(user => user.username).filter(name => name);
                                const customerNames = allCustomers.join(', ');
                                
                                extractedData.push({
                                    vyt_code: bowlCode,
                                    company: boxCompany,
                                    customer: customerNames,
                                    dish: dish.label || '',
                                    multipleCustomers: allCustomers.length > 1,
                                    creationDate: creationDate // Include extracted date
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

// Extract date from JSON data (various possible fields)
function extractDateFromJSON(jsonData) {
    const dateFields = ['createdAt', 'creationDate', 'date', 'timestamp', 'created', 'orderDate'];
    
    for (const field of dateFields) {
        if (jsonData[field]) {
            console.log(`📅 Found date in field '${field}':`, jsonData[field]);
            return new Date(jsonData[field]).toISOString();
        }
    }
    
    // If no date found, use current date
    console.log('📅 No date found in JSON, using current date');
    return new Date().toISOString();
}

// Calculate days active from creation date
function calculateDaysActive(creationDate) {
    if (!creationDate) return 0;
    
    const created = new Date(creationDate);
    const today = new Date();
    const diffTime = Math.abs(today - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// ========== ENHANCED EXPORT FUNCTIONS WITH DATE TRACKING ==========

// Enhanced Active Bowls Export with Date Tracking
function exportActiveBowls() {
    if (window.appData.activeBowls.length === 0) {
        showMessage('❌ No active bowls to export', 'error');
        return;
    }

    // Calculate days active for all bowls before export
    const bowlsWithDaysActive = window.appData.activeBowls.map(bowl => {
        return {
            ...bowl,
            daysActive: bowl.creationDate ? calculateDaysActive(bowl.creationDate) : 0
        };
    });

    const csvData = convertToCSV(bowlsWithDaysActive, 
        ['code', 'dish', 'company', 'customer', 'creationDate', 'daysActive', 'user', 'date', 'time']
    );
    downloadCSV(csvData, 'active_bowls_with_dates.csv');
    showMessage('✅ Active bowls exported with date tracking', 'success');
}

// FIXED: Enhanced Excel Export with XLSX loading
function exportAllData() {
    loadXLSXLibrary()
        .then(() => {
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Sheet 1: Active Bowls with Date Tracking
            const activeData = window.appData.activeBowls.map(bowl => {
                const daysActive = bowl.creationDate ? calculateDaysActive(bowl.creationDate) : 0;
                return {
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'Company': bowl.company,
                    'Customer': bowl.customer,
                    'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No',
                    'Creation Date': bowl.creationDate ? new Date(bowl.creationDate).toLocaleDateString('en-GB') : 'Unknown',
                    'Days Active': daysActive,
                    'User': bowl.user,
                    'Date': bowl.date,
                    'Time': bowl.time,
                    'Status': bowl.status
                };
            });
            
            if (activeData.length > 0) {
                const wsActive = XLSX.utils.json_to_sheet(activeData);
                XLSX.utils.book_append_sheet(wb, wsActive, 'Active Bowls');
            }
            
            // Sheet 2: Prepared Bowls
            const preparedData = window.appData.preparedBowls.map(bowl => ({
                'Code': bowl.code,
                'Dish': bowl.dish,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No',
                'User': bowl.user,
                'Date': bowl.date,
                'Time': bowl.time,
                'Status': bowl.status
            }));
            
            if (preparedData.length > 0) {
                const wsPrepared = XLSX.utils.json_to_sheet(preparedData);
                XLSX.utils.book_append_sheet(wb, wsPrepared, 'Prepared Bowls');
            }
            
            // Sheet 3: Returned Bowls
            const returnedData = window.appData.returnedBowls.map(bowl => ({
                'Code': bowl.code,
                'Dish': bowl.dish,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'Returned By': bowl.returnedBy,
                'Return Date': bowl.returnDate,
                'Return Time': bowl.returnTime,
                'Status': bowl.status
            }));
            
            if (returnedData.length > 0) {
                const wsReturned = XLSX.utils.json_to_sheet(returnedData);
                XLSX.utils.book_append_sheet(wb, wsReturned, 'Returned Bowls');
            }
            
            // Check if workbook has any sheets
            if (wb.SheetNames.length === 0) {
                showMessage('❌ No data available to export', 'error');
                return;
            }
            
            // Export the workbook
            XLSX.writeFile(wb, 'complete_scanner_data_with_dates.xlsx');
            showMessage('✅ All data exported as Excel with date tracking', 'success');
        })
        .catch((error) => {
            console.error('XLSX load error:', error);
            showMessage('❌ Failed to load Excel export library: ' + error.message, 'error');
        });
}

// Enhanced Return Data Export
function exportReturnData() {
    const today = new Date().toLocaleDateString('en-GB');
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);

    if (todayReturns.length === 0) {
        showMessage('❌ No return data to export today', 'error');
        return;
    }

    const csvData = convertToCSV(todayReturns, ['code', 'dish', 'company', 'customer', 'returnedBy', 'returnDate', 'returnTime']);
    downloadCSV(csvData, 'return_data.csv');
    showMessage('✅ Return data exported as CSV', 'success');
}

function convertToCSV(data, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => {
        return fields.map(field => `"${item[field] || ''}"`).join(',');
    });
    return [headers, ...rows].join('\n');
}

function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ========== ENHANCED SYNC AND STORAGE FUNCTIONS ==========

// Enhanced sync function - ensures all data is saved
function syncToFirebase() {
    try {
        // Always save to local storage first
        saveToStorage();
        
        if (typeof firebase === 'undefined') {
            console.log('Firebase not available, saved to local storage only');
            return;
        }
        
        const db = firebase.database();
        const backupData = {
            activeBowls: window.appData.activeBowls || [],
            preparedBowls: window.appData.preparedBowls || [], // Ensure prepared bowls are included
            returnedBowls: window.appData.returnedBowls || [],
            myScans: window.appData.myScans || [],
            scanHistory: window.appData.scanHistory || [],
            customerData: window.appData.customerData || [],
            lastCleanup: window.appData.lastCleanup,
            lastSync: new Date().toISOString()
        };
        
        console.log('💾 Syncing to Firebase - Prepared bowls:', backupData.preparedBowls.length);
        
        db.ref('progloveData').set(backupData)
            .then(() => {
                window.appData.lastSync = new Date().toISOString();
                console.log('✅ Data synced to Firebase - Prepared:', backupData.preparedBowls.length);
                document.getElementById('systemStatus').textContent = '✅ Cloud Synced';
            })
            .catch((error) => {
                console.error('Firebase sync failed:', error);
                document.getElementById('systemStatus').textContent = '⚠️ Sync Failed - Using Local';
            });
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Enhanced storage functions
function saveToStorage() {
    try {
        const dataToSave = {
            activeBowls: window.appData.activeBowls,
            preparedBowls: window.appData.preparedBowls, // Include prepared bowls
            returnedBowls: window.appData.returnedBowls,
            myScans: window.appData.myScans,
            scanHistory: window.appData.scanHistory,
            customerData: window.appData.customerData,
            lastCleanup: window.appData.lastCleanup,
            lastSync: window.appData.lastSync,
            lastActivity: window.appData.lastActivity
        };
        
        localStorage.setItem('proglove_data', JSON.stringify(dataToSave));
        console.log('💾 Data saved to local storage - Prepared:', window.appData.preparedBowls.length);
    } catch (error) {
        console.log('Storage save error:', error.message);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            const data = JSON.parse(saved);
            // Merge with existing appData to preserve current state
            window.appData = { 
                ...window.appData, 
                ...data,
                // Preserve current scanning state
                mode: window.appData.mode,
                user: window.appData.user, 
                dishLetter: window.appData.dishLetter,
                scanning: window.appData.scanning
            };
            console.log('💾 Data loaded from storage - Prepared:', window.appData.preparedBowls.length);
            cleanupIncompleteBowls();
        }
    } catch (error) {
        console.log('No previous data found - starting fresh');
    }
}

// ========== SCANNING AND BOWL MANAGEMENT ==========

// FIXED: Enhanced scanning function with better error handling
function processScan(input) {
    if (!window.appData.scanning) {
        showMessage('❌ Scanning not active - click START SCANNING first', 'error');
        return;
    }

    let result;
    const startTime = Date.now();

    // Detect VYT code - More robust detection
    const vytInfo = detectVytCode(input);

    if (!vytInfo) {
        result = {
            message: "❌ Invalid VYT code/URL format: " + input,
            type: "error", 
            responseTime: Date.now() - startTime
        };
        showMessage(result.message, result.type);
        return;
    }

    console.log(`🎯 Processing scan: ${vytInfo.fullUrl} (${vytInfo.type})`);

    try {
        if (window.appData.mode === 'kitchen') {
            result = kitchenScan(vytInfo);
        } else if (window.appData.mode === 'return') {
            result = returnScan(vytInfo);
        } else {
            result = {
                message: "❌ Please select mode first",
                type: "error",
                responseTime: Date.now() - startTime
            };
        }
    } catch (error) {
        console.error('Scan processing error:', error);
        result = {
            message: "❌ Scan processing error: " + error.message,
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    document.getElementById('responseTimeValue').textContent = result.responseTime;
    showMessage(result.message, result.type);

    if (result.type === 'error') {
        document.getElementById('progloveInput').classList.add('error');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('error'), 2000);
    } else {
        document.getElementById('progloveInput').classList.add('success');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('success'), 500);
    }

    updateDisplay();
    updateOvernightStats();
    updateLastActivity();
}

// UPDATED Kitchen Scan - Allow multiple preparations per day by different users
function kitchenScan(vytInfo) {
    const startTime = Date.now();
    const today = new Date().toLocaleDateString('en-GB');

    // FIX: Only check if THIS USER prepared THIS bowl with THIS dish today
    const isPreparedByThisUser = window.appData.preparedBowls.some(bowl => 
        bowl.code === vytInfo.fullUrl && 
        bowl.date === today && 
        bowl.user === window.appData.user &&
        bowl.dish === window.appData.dishLetter
    );

    if (isPreparedByThisUser) {
        return { 
            message: "❌ You already prepared this bowl today: " + vytInfo.fullUrl, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    // STEP 1: Check if bowl exists in active bowls and REMOVE it
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    let hadCustomerData = false;
    
    if (activeBowlIndex !== -1) {
        window.appData.activeBowls.splice(activeBowlIndex, 1);
        hadCustomerData = true;
        console.log(`🗑️ Removed bowl from active with customer data: ${vytInfo.fullUrl}`);
    }

    const preparedBowl = {
        code: vytInfo.fullUrl,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown", 
        customer: "Unknown",
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'PREPARED',
        multipleCustomers: false,
        hadPreviousCustomer: hadCustomerData
    };

    // STEP 2: ADD to prepared bowls
    window.appData.preparedBowls.push(preparedBowl);

    window.appData.myScans.push({
        type: 'kitchen',
        code: vytInfo.fullUrl,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown",
        customer: "Unknown",
        timestamp: new Date().toISOString(),
        hadPreviousCustomer: hadCustomerData
    });

    const message = hadCustomerData ? 
        `✅ ${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl} (customer data reset)` :
        `✅ ${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl}`;

    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: message
    });

    // IMMEDIATELY SYNC TO SAVE THE PREPARED BOWL
    syncToFirebase();

    return { 
        message: message, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// CORRECTED Return Scan - NO wait time, immediate scanning
function returnScan(vytInfo) {
    const startTime = Date.now();
    const today = new Date().toLocaleDateString('en-GB');

    console.log(`🔍 Looking for bowl to return: ${vytInfo.fullUrl}`);

    // Find in prepared bowls (should be here after kitchen scan)
    const preparedIndex = window.appData.preparedBowls.findIndex(bowl => 
        bowl.code === vytInfo.fullUrl && bowl.date === today
    );

    if (preparedIndex === -1) {
        return { 
            message: "❌ Bowl not prepared today: " + vytInfo.fullUrl, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    const preparedBowl = window.appData.preparedBowls[preparedIndex];

    // STEP 1: Remove from prepared bowls
    window.appData.preparedBowls.splice(preparedIndex, 1);

    // STEP 2: Create returned bowl (already blank data from prepared)
    const returnedBowl = {
        code: vytInfo.fullUrl,
        dish: preparedBowl.dish,
        user: window.appData.user,
        company: "",
        customer: "",
        returnedBy: window.appData.user,
        returnDate: today,
        returnTime: new Date().toLocaleTimeString(),
        returnTimestamp: new Date().toISOString(),
        status: 'RETURNED'
    };

    // STEP 3: Add to returnedBowls
    window.appData.returnedBowls.push(returnedBowl);

    // STEP 4: Log the return scan
    window.appData.myScans.push({
        type: 'return',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        company: "",
        customer: "",
        timestamp: new Date().toISOString()
    });

    window.appData.scanHistory.unshift({
        type: 'return',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `✅ Returned: ${vytInfo.fullUrl}`
    });

    console.log(`✅ Bowl returned: ${vytInfo.fullUrl}`);

    syncToFirebase();

    return { 
        message: `✅ Returned: ${vytInfo.fullUrl}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// Scanning Functions
function startScanning() {
    if (!window.appData.user) {
        showMessage('❌ Please select user first', 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage('❌ Please select dish letter first', 'error');
        return;
    }

    window.appData.scanning = true;
    updateDisplay();
    
    const input = document.getElementById('progloveInput');
    if (input) {
        input.focus();
        input.value = '';
    }
    
    updateLastActivity();
    showMessage(`🎯 SCANNING ACTIVE - Ready to scan`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    updateLastActivity();
    showMessage(`⏹ Scanning stopped`, 'info');
}

// ========== USER AND MODE MANAGEMENT ==========

// User and Mode Management
function initializeUsers() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Select User --</option>';

    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name + (user.role ? ` (${user.role})` : '');
        dropdown.appendChild(option);
    });
}

function setMode(mode) {
    window.appData.mode = mode;
    window.appData.user = null;
    window.appData.dishLetter = null;
    window.appData.scanning = false;

    const kitchenBtn = document.getElementById('kitchenBtn');
    const returnBtn = document.getElementById('returnBtn');
    
    if (kitchenBtn) kitchenBtn.classList.toggle('active', mode === 'kitchen');
    if (returnBtn) returnBtn.classList.toggle('active', mode === 'return');

    const dishSection = document.getElementById('dishSection');
    if (dishSection) dishSection.classList.toggle('hidden', mode !== 'kitchen');
    
    const userDropdown = document.getElementById('userDropdown');
    const dishDropdown = document.getElementById('dishDropdown');
    const progloveInput = document.getElementById('progloveInput');
    
    if (userDropdown) userDropdown.value = '';
    if (dishDropdown) dishDropdown.value = '';
    if (progloveInput) progloveInput.value = '';

    loadUsers();
    updateStatsLabels();
    updateDisplay();
    updateLastActivity();
    showMessage(`📱 ${mode.toUpperCase()} mode selected`, 'info');
}

function updateStatsLabels() {
    const prepLabel = document.getElementById('prepLabel');
    if (prepLabel) {
        if (window.appData.mode === 'kitchen') {
            prepLabel.textContent = 'Prepared Today';
        } else {
            prepLabel.textContent = 'Returned Today';
        }
    }
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Select User --</option>';

    let usersToShow = [];
    if (window.appData.mode === 'kitchen') {
        usersToShow = USERS.filter(user => user.role === 'Kitchen');
    } else if (window.appData.mode === 'return') {
        usersToShow = USERS.filter(user => user.role === 'Return');
    }

    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    if (!dropdown) return;
    
    window.appData.user = dropdown.value;

    if (window.appData.user) {
        showMessage(`✅ ${window.appData.user} selected`, 'success');
        if (window.appData.mode === 'kitchen') {
            const dishSection = document.getElementById('dishSection');
            if (dishSection) dishSection.classList.remove('hidden');
            loadDishLetters();
        }
    }
    updateDisplay();
    updateLastActivity();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">-- Select Dish Letter --</option>';

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        const option = document.createElement('option');
        option.value = letter;
        option.textContent = letter;
        dropdown.appendChild(option);
    });

    '1234'.split('').forEach(number => {
        const option = document.createElement('option');
        option.value = number;
        option.textContent = number;
        dropdown.appendChild(option);
    });
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    if (!dropdown) return;
    
    window.appData.dishLetter = dropdown.value;

    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
    }
    updateDisplay();
    updateLastActivity();
}

// ========== DISPLAY AND UTILITY FUNCTIONS ==========

// Display Functions
function updateDisplay() {
    const userDropdown = document.getElementById('userDropdown');
    const dishDropdown = document.getElementById('dishDropdown');
    
    if (userDropdown) userDropdown.disabled = false;
    if (dishDropdown) dishDropdown.disabled = false;

    let canScan = window.appData.user && !window.appData.scanning;
    if (window.appData.mode === 'kitchen') canScan = canScan && window.appData.dishLetter;
    
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startBtn) startBtn.disabled = !canScan;
    if (stopBtn) stopBtn.disabled = !window.appData.scanning;

    const input = document.getElementById('progloveInput');
    const scanSection = document.getElementById('scanSection');
    
    if (scanSection) {
        if (window.appData.scanning) {
            scanSection.classList.add('scanning-active');
            if (input) {
                input.placeholder = "Scan VYT code...";
                input.disabled = false;
            }
        } else {
            scanSection.classList.remove('scanning-active');
            if (input) {
                input.placeholder = "Click START SCANNING...";
                input.disabled = !window.appData.scanning;
            }
        }
    }

    const today = new Date().toLocaleDateString('en-GB');
    
    // FIX: Count ALL prepared bowls from today, not just current user
    const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
    const userTodayScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && 
        new Date(scan.timestamp).toLocaleDateString('en-GB') === today
    ).length;

    const activeCount = document.getElementById('activeCount');
    const prepCount = document.getElementById('prepCount');
    const myScansCount = document.getElementById('myScansCount');
    const exportInfo = document.getElementById('exportInfo');

    if (activeCount) activeCount.textContent = window.appData.activeBowls.length;

    if (window.appData.mode === 'kitchen') {
        if (prepCount) prepCount.textContent = preparedToday;
        if (myScansCount) myScansCount.textContent = userTodayScans;
    } else {
        if (prepCount) prepCount.textContent = returnedToday;
        if (myScansCount) myScansCount.textContent = userTodayScans;
    }

    if (exportInfo) {
        exportInfo.innerHTML = `
           <strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} bowls • Prepared: ${preparedToday} today • Returns: ${returnedToday} today
       `;
    }
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    if (element) {
        element.textContent = text;
        element.className = 'feedback ' + type;
    }
}

// Overnight Statistics Table (10PM-10AM) - INCLUDES DISHES 1-4
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');
    
    if (!statsBody || !cycleInfo) return;

    const now = new Date();
    const today10AM = new Date(now);
    today10AM.setHours(10, 0, 0, 0);

    const yesterday10PM = new Date(now);
    yesterday10PM.setDate(yesterday10PM.getDate() - 1);
    yesterday10PM.setHours(22, 0, 0, 0);

    const isOvernightCycle = now >= yesterday10PM && now <= today10AM;
    cycleInfo.textContent = isOvernightCycle ? 
    `Yesterday 10PM - Today 10AM` : 
    `Today 10PM - Tomorrow 10AM`;

    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= yesterday10PM && scanTime <= today10AM;
    });

    const dishStats = {};
    overnightScans.forEach(scan => {
        const key = `${scan.dish}-${scan.user}`;
        if (!dishStats[key]) {
            dishStats[key] = {
                dish: scan.dish,
                user: scan.user,
                scans: [],
                count: 0,
                startTime: null,
                endTime: null
            };
        }

        dishStats[key].scans.push(scan);
        dishStats[key].count++;

        const scanTime = new Date(scan.timestamp);
        if (!dishStats[key].startTime || scanTime < new Date(dishStats[key].startTime)) {
            dishStats[key].startTime = scan.timestamp;
        }
        if (!dishStats[key].endTime || scanTime > new Date(dishStats[key].endTime)) {
            dishStats[key].endTime = scan.timestamp;
        }
    });

    const statsArray = Object.values(dishStats).sort((a, b) => {
        if (a.dish !== b.dish) {
            const aIsNumber = !isNaN(a.dish);
            const bIsNumber = !isNaN(b.dish);

            if (aIsNumber && !bIsNumber) return 1;
            if (!aIsNumber && bIsNumber) return -1;
            if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish);
            return a.dish.localeCompare(b.dish);
        }
        return new Date(a.startTime) - new Date(b.startTime);
    });

    if (statsArray.length === 0) {
        statsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No overnight scans in current cycle</td></tr>';
        return;
    }

    let html = '';
    statsArray.forEach(stat => {
        const startTime = stat.startTime ? new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
        const endTime = stat.endTime ? new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';

        html += `
           <tr>
               <td class="dish-header">${stat.dish}</td>
               <td>${stat.user}</td>
               <td>${stat.count}</td>
               <td>${startTime}</td>
               <td>${endTime}</td>
           </tr>
       `;
    });

    statsBody.innerHTML = html;
}

// ========== CLEANUP AND MAINTENANCE FUNCTIONS ==========

// Clean up VYT codes without company details
function cleanupIncompleteBowls() {
    const initialCount = window.appData.activeBowls.length;
    
    window.appData.activeBowls = window.appData.activeBowls.filter(bowl => {
        if (bowl.company && bowl.company !== "Unknown" && (!bowl.customer || bowl.customer === "Unknown")) {
            console.log(`🗑️ Removing incomplete bowl: ${bowl.code} - Company: ${bowl.company}, Customer: ${bowl.customer}`);
            return false;
        }
        return true;
    });
    
    const removedCount = initialCount - window.appData.activeBowls.length;
    if (removedCount > 0) {
        console.log(`✅ Cleaned up ${removedCount} incomplete bowls`);
    }
}

// Daily Cleanup Timer (7PM Return Data Clear)
function startDailyCleanupTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            clearReturnData();
        }
    }, 60000);
}

function clearReturnData() {
    const today = new Date().toLocaleDateString('en-GB');
    if (window.appData.lastCleanup === today) return;

    window.appData.returnedBowls = [];
    window.appData.lastCleanup = today;
    syncToFirebase();

    showMessage('✅ Return data cleared for new day', 'success');
    updateDisplay();
}

// Check Firebase data status
function checkFirebaseData() {
    try {
        if (typeof firebase === 'undefined') {
            showMessage('❌ Firebase not loaded', 'error');
            return;
        }
        
        const db = firebase.database();
        const appDataRef = db.ref('progloveData');
        
        showMessage('🔄 Checking Firebase data...', 'info');
        
        appDataRef.once('value').then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const activeCount = data.activeBowls ? data.activeBowls.length : 0;
                const preparedCount = data.preparedBowls ? data.preparedBowls.length : 0;
                const returnedCount = data.returnedBowls ? data.returnedBowls.length : 0;
                
                showMessage(`✅ Firebase has data: ${activeCount} active, ${preparedCount} prepared, ${returnedCount} returned bowls`, 'success');
                console.log('📊 Firebase data:', data);
            } else {
                showMessage('❌ No data found in Firebase', 'warning');
            }
        }).catch((error) => {
            showMessage('❌ Error checking Firebase: ' + error.message, 'error');
        });
    } catch (error) {
        showMessage('❌ Firebase check failed: ' + error.message, 'error');
    }
}

// Helper function to extract company from uniqueIdentifier
function extractCompanyFromUniqueIdentifier(uniqueIdentifier) {
    if (!uniqueIdentifier) return "Unknown";
    
    const parts = uniqueIdentifier.split('-');
    if (parts.length >= 3) {
        return parts.slice(2, -1).join(' ').trim();
    }
    
    return uniqueIdentifier;
}

// UPDATED: Combine customer names for same dish and set color flags
function combineCustomerNamesByDish() {
    const dishGroups = {};
    window.appData.activeBowls.forEach(bowl => {
        if (!dishGroups[bowl.dish]) {
            dishGroups[bowl.dish] = [];
        }
        dishGroups[bowl.dish].push(bowl);
    });

    Object.values(dishGroups).forEach(bowls => {
        if (bowls.length > 1) {
            const allCustomers = [...new Set(bowls.map(b => b.customer))].filter(name => name && name !== "Unknown");
            if (allCustomers.length > 0) {
                const combinedCustomers = allCustomers.join(', ');
                bowls.forEach(bowl => {
                    bowl.customer = combinedCustomers;
                    bowl.multipleCustomers = true;
                });
            }
        } else {
            if (bowls[0].customer && bowls[0].customer !== "Unknown") {
                bowls[0].multipleCustomers = false;
            }
        }
    });

    window.appData.preparedBowls.forEach(prepBowl => {
        const activeBowl = window.appData.activeBowls.find(bowl => bowl.code === prepBowl.code);
        if (activeBowl) {
            prepBowl.customer = activeBowl.customer;
            prepBowl.company = activeBowl.company;
            prepBowl.multipleCustomers = activeBowl.multipleCustomers;
        }
    });
}

// UPDATED color coding for customer names
function getCustomerNameColor(bowl) {
    if (bowl.multipleCustomers) {
        return 'red-text';
    } else if (bowl.customer && bowl.customer !== "Unknown") {
        return 'green-text';
    }
    return '';
}

// ========== GLOBAL FUNCTION EXPORTS ==========

// Make functions globally available
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
