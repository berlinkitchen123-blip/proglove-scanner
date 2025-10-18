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

// ========== XLSX LIBRARY LOADING ==========

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
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = function() {
            console.log('✅ XLSX library loaded');
            resolve();
        };
        script.onerror = function() {
            console.error('❌ Failed to load XLSX library');
            reject(new Error('Failed to load XLSX library'));
        };
        document.head.appendChild(script);
    });
}

// ========== DATE FORMATTING FUNCTIONS ==========

// Convert to standard date format YYYY-MM-DD
function formatDateStandard(date) {
    if (!date) return getTodayStandard();
    
    // If already in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    
    // If it's a Date object or other format, convert
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Get today's date in standard format
function getTodayStandard() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Convert ISO string to standard date format for display/export
function convertToStandardDate(isoString) {
    if (!isoString) return getTodayStandard();
    return formatDateStandard(isoString);
}

// ========== FIREBASE FUNCTIONS ==========

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
    console.log('🔄 Starting Firebase initialization...');
    
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
            // Only use local storage as emergency backup when Firebase completely fails to load
            try {
                const saved = localStorage.getItem('proglove_data');
                if (saved) {
                    const localData = JSON.parse(saved);
                    console.log('⚠️ Using local backup due to Firebase load failure');
                    showMessage('⚠️ Using local backup data (cloud unavailable)', 'warning');
                    
                    window.appData.activeBowls = localData.activeBowls || [];
                    window.appData.preparedBowls = localData.preparedBowls || [];
                    window.appData.returnedBowls = localData.returnedBowls || [];
                    window.appData.myScans = localData.myScans || [];
                    window.appData.scanHistory = localData.scanHistory || [];
                    window.appData.customerData = localData.customerData || [];
                    window.appData.lastCleanup = localData.lastCleanup;
                    window.appData.lastSync = localData.lastSync;
                    
                    updateDisplay();
                    initializeUI();
                } else {
                    throw new Error('No local backup available');
                }
            } catch (localError) {
                console.error('Local backup also failed:', localError);
                showMessage('❌ No data available - please check connection', 'error');
                initializeUI(); // Initialize with empty data
            }
        });
}

// FIXED: Always use Firebase as primary, local storage only for emergency backup
function loadFromFirebase() {
    try {
        console.log('🔄 Loading data from Firebase (primary source)...');
        const db = firebase.database();
        const appDataRef = db.ref('progloveData');
        
        showMessage('🔄 Connecting to cloud...', 'info');
        document.getElementById('systemStatus').textContent = '🔄 Connecting to Cloud...';

        // Monitor connection status
        const connectedRef = db.ref(".info/connected");
        connectedRef.on("value", (snap) => {
            if (snap.val() === true) {
                console.log('✅ Firebase connection established');
                document.getElementById('systemStatus').textContent = '✅ Cloud Connected';
                showMessage('✅ Connected to cloud - using live data', 'success');
            } else {
                console.log('❌ Firebase connection lost');
                document.getElementById('systemStatus').textContent = '⚠️ Offline Mode';
                showMessage('❌ OFFLINE: No connection to cloud server', 'error');
            }
        });

        // Load data from Firebase (primary source)
        appDataRef.once('value')
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    console.log('✅ Firebase data loaded (primary source)');
                    
                    // USE FIREBASE DATA AS PRIMARY SOURCE
                    window.appData.activeBowls = firebaseData.activeBowls || [];
                    window.appData.preparedBowls = firebaseData.preparedBowls || [];
                    window.appData.returnedBowls = firebaseData.returnedBowls || [];
                    window.appData.myScans = firebaseData.myScans || [];
                    window.appData.scanHistory = firebaseData.scanHistory || [];
                    window.appData.customerData = firebaseData.customerData || [];
                    window.appData.lastCleanup = firebaseData.lastCleanup;
                    window.appData.lastSync = firebaseData.lastSync;
                    
                    console.log('📊 Firebase data loaded:', {
                        active: window.appData.activeBowls.length,
                        prepared: window.appData.preparedBowls.length,
                        returned: window.appData.returnedBowls.length
                    });
                    
                    // Update display with Firebase data
                    updateDisplay();
                    
                    showMessage('✅ Cloud data loaded successfully', 'success');
                    document.getElementById('systemStatus').textContent = '✅ Cloud Connected';
                    
                    cleanupIncompleteBowls();
                    initializeUI();
                    
                } else {
                    console.log('❌ No data in Firebase');
                    showMessage('❌ No data found in cloud server', 'error');
                    document.getElementById('systemStatus').textContent = '⚠️ No Cloud Data';
                    // Initialize with empty data
                    initializeUI();
                }
            })
            .catch((error) => {
                console.error('Firebase load error:', error);
                showMessage('❌ Failed to load from cloud: ' + error.message, 'error');
                document.getElementById('systemStatus').textContent = '⚠️ Cloud Load Error';
                
                // ONLY AS LAST RESORT: Try local storage
                try {
                    const saved = localStorage.getItem('proglove_data');
                    if (saved) {
                        const localData = JSON.parse(saved);
                        console.log('⚠️ Using local backup due to Firebase error');
                        showMessage('⚠️ Using local backup data (cloud unavailable)', 'warning');
                        
                        window.appData.activeBowls = localData.activeBowls || [];
                        window.appData.preparedBowls = localData.preparedBowls || [];
                        window.appData.returnedBowls = localData.returnedBowls || [];
                        window.appData.myScans = localData.myScans || [];
                        window.appData.scanHistory = localData.scanHistory || [];
                        window.appData.customerData = localData.customerData || [];
                        window.appData.lastCleanup = localData.lastCleanup;
                        window.appData.lastSync = localData.lastSync;
                        
                        updateDisplay();
                        initializeUI();
                    } else {
                        throw new Error('No local backup available');
                    }
                } catch (localError) {
                    console.error('Local backup also failed:', localError);
                    showMessage('❌ No data available - please check connection', 'error');
                    initializeUI(); // Initialize with empty data
                }
            });

    } catch (error) {
        console.error('Firebase setup error:', error);
        showMessage('❌ System error: ' + error.message, 'error');
        document.getElementById('systemStatus').textContent = '⚠️ System Error';
        initializeUI();
    }
}

// FIXED: Sync to Firebase only, local storage is emergency backup
function syncToFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.log('❌ Firebase not available');
            showMessage('❌ Cannot sync: Firebase not available', 'error');
            return;
        }

        const db = firebase.database();
        
        // Check connection status
        const connectedRef = db.ref(".info/connected");
        connectedRef.once("value").then((snap) => {
            if (snap.val() === true) {
                // Online - sync to Firebase (primary)
                const firebaseData = {
                    activeBowls: window.appData.activeBowls || [],
                    preparedBowls: window.appData.preparedBowls || [],
                    returnedBowls: window.appData.returnedBowls || [],
                    myScans: window.appData.myScans || [],
                    scanHistory: window.appData.scanHistory || [],
                    customerData: window.appData.customerData || [],
                    lastCleanup: window.appData.lastCleanup || "",
                    lastSync: new Date().toISOString()
                };

                console.log('🔄 Syncing to Firebase...');
                showMessage('🔄 Syncing to cloud...', 'info');

                db.ref('progloveData').set(firebaseData)
                    .then(() => {
                        window.appData.lastSync = new Date().toISOString();
                        console.log('✅ Data synced to Firebase');
                        
                        // ONLY AFTER SUCCESSFUL FIREBASE SYNC: Save to local as backup
                        try {
                            localStorage.setItem('proglove_data', JSON.stringify({
                                activeBowls: window.appData.activeBowls,
                                preparedBowls: window.appData.preparedBowls,
                                returnedBowls: window.appData.returnedBowls,
                                myScans: window.appData.myScans,
                                scanHistory: window.appData.scanHistory,
                                customerData: window.appData.customerData,
                                lastCleanup: window.appData.lastCleanup,
                                lastSync: window.appData.lastSync
                            }));
                            console.log('💾 Backup saved to local storage');
                        } catch (storageError) {
                            console.warn('Local storage backup failed:', storageError);
                        }
                        
                        document.getElementById('systemStatus').textContent = '✅ Cloud Synced';
                        showMessage('✅ Data synced to cloud successfully', 'success');
                    })
                    .catch((error) => {
                        console.error('Firebase sync failed:', error);
                        showMessage('❌ Cloud sync failed: ' + error.message, 'error');
                        document.getElementById('systemStatus').textContent = '⚠️ Sync Failed';
                    });
            } else {
                // Offline - cannot sync
                console.log('❌ Offline - cannot sync to Firebase');
                showMessage('❌ OFFLINE: Cannot sync to cloud server', 'error');
                document.getElementById('systemStatus').textContent = '⚠️ Offline - Cannot Sync';
            }
        }).catch((error) => {
            console.error('Connection check failed:', error);
            showMessage('❌ Connection check failed', 'error');
        });

    } catch (error) {
        console.error('Sync error:', error);
        showMessage('❌ Sync error: ' + error.message, 'error');
    }
}

// Function to clear local storage (manual cleanup)
function clearLocalBackup() {
    try {
        localStorage.removeItem('proglove_data');
        console.log('🗑️ Local backup cleared');
        showMessage('✅ Local backup data cleared', 'success');
    } catch (error) {
        console.error('Failed to clear local storage:', error);
        showMessage('❌ Failed to clear local backup', 'error');
    }
}

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

// ========== SCANNER SYSTEM FUNCTIONS ==========

// SIMPLIFIED VYTAL URL DETECTION - FIXED VERSION
function detectVytCode(input) {
    if (!input || typeof input !== 'string') return null;

    const cleanInput = input.trim();
    console.log('🔍 Scanning input:', cleanInput);

    // Check for VYT.TO/ pattern
    if (cleanInput.includes('VYT.TO/')) {
        const match = cleanInput.match(/VYT\.TO\/[A-Za-z0-9]+/);
        if (match) {
            console.log('✅ VYT.TO code detected:', match[0]);
            return {
                fullUrl: match[0],
                type: 'VYT.TO'
            };
        }
    }

    // Check for VYTAL pattern
    if (cleanInput.includes('VYTAL')) {
        const match = cleanInput.match(/VYTAL[A-Za-z0-9]+/);
        if (match) {
            console.log('✅ VYTAL code detected:', match[0]);
            return {
                fullUrl: match[0],
                type: 'VYTAL'
            };
        }
    }

    // Check for partial scans that might be VYT codes
    if ((cleanInput.includes('VYT') || cleanInput.includes('vyt')) && cleanInput.length > 5) {
        console.log('⚠️ Possible VYT code (partial):', cleanInput);
        showMessage('⚠️ Partial VYT code detected - please rescan', 'warning');
    }

    console.log('❌ No valid VYT code found');
    return null;
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

// Initialize System
function initializeUI() {
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyCleanupTimer();

    // SIMPLIFIED EVENT LISTENER - FIXED VERSION
    const progloveInput = document.getElementById('progloveInput');
    if (progloveInput) {
        progloveInput.addEventListener('input', handleScanInput);
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

// SIMPLIFIED SCAN INPUT HANDLER - FIXED VERSION
function handleScanInput(e) {
    if (!window.appData.scanning) return;

    const scanValue = e.target.value.trim();
    
    // Process scan when we have a reasonable length and VYT indicator
    if (scanValue.length >= 8 && (scanValue.includes('VYT') || scanValue.includes('vyt'))) {
        console.log('🎯 Processing scan input:', scanValue);
        processScan(scanValue);
        
        // Clear input after processing
        setTimeout(() => {
            e.target.value = '';
            if (window.appData.scanning) {
                e.target.focus();
            }
        }, 100);
    }
    
    updateLastActivity();
}

// ========== UPDATED JSON PROCESSING SECTION WITH STANDARD DATE FORMAT ==========

// ENHANCED JSON Processing - Handles large data and multiple companies
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();

    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }

    try {
        console.log('🔍 Starting JSON processing...');
        showMessage('🔄 Processing JSON data...', 'info');

        const jsonData = JSON.parse(jsonText);
        const extractedData = [];
        const patchResults = {
            matched: 0,
            created: 0,
            failed: 0,
            companiesProcessed: new Set()
        };

        // PROCESS SINGLE COMPANY (your current structure)
        if (jsonData.name && jsonData.boxes) {
            console.log(`📦 Processing single company: ${jsonData.name}`);
            processCompanyData(jsonData, extractedData, patchResults);
        }
        // PROCESS ARRAY OF COMPANIES (multiple companies in one JSON)
        else if (Array.isArray(jsonData)) {
            console.log(`🏢 Processing ${jsonData.length} companies in array`);
            jsonData.forEach((companyData, index) => {
                if (companyData.name && companyData.boxes) {
                    console.log(`📦 [${index + 1}/${jsonData.length}] Processing: ${companyData.name}`);
                    processCompanyData(companyData, extractedData, patchResults);
                }
            });
        }
        // PROCESS NESTED COMPANIES (companies array inside JSON)
        else if (jsonData.companies && Array.isArray(jsonData.companies)) {
            console.log(`🏢 Processing ${jsonData.companies.length} companies from companies array`);
            jsonData.companies.forEach((companyData, index) => {
                if (companyData.name && companyData.boxes) {
                    console.log(`📦 [${index + 1}/${jsonData.companies.length}] Processing: ${companyData.name}`);
                    processCompanyData(companyData, extractedData, patchResults);
                }
            });
        }
        else {
            throw new Error('Unsupported JSON format. Expected: single company, array of companies, or {companies: [...]}');
        }

        console.log('📊 Extracted data:', extractedData);
        console.log(`🏢 Companies processed: ${Array.from(patchResults.companiesProcessed).join(', ')}`);

        // STEP 2: Process each extracted VYT code
        extractedData.forEach(customer => {
            const exactVytCode = customer.vyt_code.toString().trim();
            console.log(`Looking for bowl matching: ${exactVytCode}`);

            // Find ALL active bowls with this EXACT VYT code
            const matchingBowls = window.appData.activeBowls.filter(bowl => {
                return bowl.code === exactVytCode;
            });

            if (matchingBowls.length > 0) {
                console.log(`✅ Found ${matchingBowls.length} matches for ${exactVytCode}`);

                // Update ALL matching bowls with new customer data
                matchingBowls.forEach(bowl => {
                    const oldCompany = bowl.company;
                    const oldCustomer = bowl.customer;

                    bowl.company = customer.company || "Unknown";
                    bowl.customer = customer.customer || "Unknown";
                    bowl.dish = customer.dish || bowl.dish;
                    bowl.multipleCustomers = customer.multipleCustomers;

                    console.log(`🔄 Updated bowl ${bowl.code}: Company "${oldCompany}" → "${bowl.company}" | Customer "${oldCustomer}" → "${bowl.customer}"`);
                });

                patchResults.matched += matchingBowls.length;
            } else {
                // Create new bowl if not found
                console.log(`🆕 Creating new bowl for: ${exactVytCode}`);
                const newBowl = {
                    code: exactVytCode,
                    company: customer.company || "Unknown",
                    customer: customer.customer || "Unknown",
                    dish: customer.dish || "Unknown",
                    status: 'ACTIVE',
                    timestamp: new Date().toISOString(),
                    date: getTodayStandard(), // Use standard date format
                    multipleCustomers: customer.multipleCustomers
                };
                
                window.appData.activeBowls.push(newBowl);
                patchResults.created++;
            }
        });

        // Update display and save
        updateDisplay();
        syncToFirebase(); // SYNC TO FIREBASE ONLY

        // Show comprehensive results
        showMessage(`✅ JSON processing completed: ${extractedData.length} VYT codes from ${patchResults.companiesProcessed.size} companies`, 'success');

        // Show detailed results
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Companies: ${patchResults.companiesProcessed.size} | VYT Codes: ${extractedData.length} | Updated: ${patchResults.matched} | Created: ${patchResults.created}`;

        const failedDiv = document.getElementById('failedMatches');
        if (patchResults.failed > 0) {
            failedDiv.innerHTML = `<strong>Failed:</strong> ${patchResults.failed} bowls could not be processed`;
        } else {
            failedDiv.innerHTML = '<em>All VYT codes processed successfully!</em>';
        }

        document.getElementById('jsonStatus').innerHTML = 
            `<strong>JSON Status:</strong> Processed ${extractedData.length} VYT codes from ${patchResults.companiesProcessed.size} companies`;

        console.log('📊 Final results:', patchResults);

    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
        console.error('JSON processing error:', error);
    }
}

// Helper function to process company data
function processCompanyData(companyData, extractedData, patchResults) {
    const companyName = companyData.name;
    patchResults.companiesProcessed.add(companyName);

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
                                    multipleCustomers: allCustomers.length > 1
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

// ========== END OF UPDATED JSON PROCESSING SECTION ==========

// UPDATED: Combine customer names for same dish and set color flags (MULTIPLE = RED, SINGLE = GREEN)
function combineCustomerNamesByDish() {
    // Group active bowls by dish
    const dishGroups = {};
    window.appData.activeBowls.forEach(bowl => {
        if (!dishGroups[bowl.dish]) {
            dishGroups[bowl.dish] = [];
        }
        dishGroups[bowl.dish].push(bowl);
    });

    // Process each dish group
    Object.values(dishGroups).forEach(bowls => {
        if (bowls.length > 1) {
            // Multiple bowls for same dish - combine customer names + RED FONT
            const allCustomers = [...new Set(bowls.map(b => b.customer))].filter(name => name && name !== "Unknown");

            if (allCustomers.length > 0) {
                const combinedCustomers = allCustomers.join(', ');

                // Update all bowls in this dish with combined names + RED FLAG
                bowls.forEach(bowl => {
                    bowl.customer = combinedCustomers;
                    bowl.multipleCustomers = true; // Flag for RED color
                });
            }
        } else {
            // Single bowl for this dish - GREEN FONT
            if (bowls[0].customer && bowls[0].customer !== "Unknown") {
                bowls[0].multipleCustomers = false; // Flag for GREEN color
            }
        }
    });

    // Also update prepared bowls to match
    window.appData.preparedBowls.forEach(prepBowl => {
        const activeBowl = window.appData.activeBowls.find(bowl => bowl.code === prepBowl.code);
        if (activeBowl) {
            prepBowl.customer = activeBowl.customer;
            prepBowl.company = activeBowl.company;
            prepBowl.multipleCustomers = activeBowl.multipleCustomers;
        }
    });
}

// UPDATED color coding for customer names (GREEN = single, RED = multiple)
function getCustomerNameColor(bowl) {
    if (bowl.multipleCustomers) {
        return 'red-text';    // RED for multiple customers
    } else if (bowl.customer && bowl.customer !== "Unknown") {
        return 'green-text';  // GREEN for single customer
    }
    return ''; // Default color for unknown customers
}

// SIMPLIFIED SCANNING FUNCTION - FIXED VERSION
function processScan(input) {
    let result;

    // Detect VYT code - SIMPLIFIED
    const vytInfo = detectVytCode(input);

    if (!vytInfo) {
        showMessage("❌ Invalid VYT code/URL format: " + input, 'error');
        return;
    }

    console.log(`🎯 Processing scan: ${vytInfo.fullUrl} (${vytInfo.type})`);

    if (window.appData.mode === 'kitchen') {
        result = kitchenScan(vytInfo);
    } else {
        result = returnScan(vytInfo);
    }

    document.getElementById('responseTimeValue').textContent = result.responseTime;
    showMessage(result.message, result.type);

    if (result.type === 'error') {
        document.getElementById('progloveInput').classList.add('error');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('error'), 2000);
    }

    updateDisplay();
    updateOvernightStats();
    updateLastActivity();
}

// FIXED: Kitchen Scan - Handle active bowls and re-scanning
function kitchenScan(vytInfo) {
    const startTime = Date.now();
    const today = getTodayStandard();

    console.log(`🔍 Checking bowl ${vytInfo.fullUrl} status...`);

    // CHECK 1: Is bowl currently prepared and waiting for return?
    const isCurrentlyPrepared = window.appData.preparedBowls.some(bowl => 
        bowl.code === vytInfo.fullUrl && bowl.date === today
    );

    if (isCurrentlyPrepared) {
        console.log(`❌ Bowl ${vytInfo.fullUrl} is already prepared and waiting for return`);
        return { 
            message: "❌ Already prepared and waiting: " + vytInfo.fullUrl, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    // CHECK 2: Is bowl in active bowls? (has customer data)
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    let hadCustomerData = false;
    let removedActiveBowl = null;
    
    if (activeBowlIndex !== -1) {
        // Remove from active bowls (delete Customer A data)
        removedActiveBowl = window.appData.activeBowls[activeBowlIndex];
        window.appData.activeBowls.splice(activeBowlIndex, 1);
        hadCustomerData = true;
        console.log(`🗑️ Removed bowl from active with customer data: ${vytInfo.fullUrl} (Customer: ${removedActiveBowl.customer}, Company: ${removedActiveBowl.company})`);
    }

    // Create prepared bowl with ALWAYS "Unknown" customer (fresh preparation)
    const preparedBowl = {
        code: vytInfo.fullUrl,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown", // ALWAYS reset to Unknown
        customer: "Unknown", // ALWAYS reset to Unknown
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'PREPARED',
        multipleCustomers: false,
        hadPreviousCustomer: hadCustomerData,
        previousCustomer: hadCustomerData ? removedActiveBowl.customer : null,
        previousCompany: hadCustomerData ? removedActiveBowl.company : null
    };

    // ADD to prepared bowls
    window.appData.preparedBowls.push(preparedBowl);

    // Log the scan
    window.appData.myScans.push({
        type: 'kitchen',
        code: vytInfo.fullUrl,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "Unknown",
        customer: "Unknown",
        timestamp: new Date().toISOString(),
        hadPreviousCustomer: hadCustomerData,
        previousCustomer: hadCustomerData ? removedActiveBowl.customer : null,
        previousCompany: hadCustomerData ? removedActiveBowl.company : null
    });

    let message = `✅ ${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl}`;
    
    if (hadCustomerData) {
        message = `✅ ${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl} (removed customer data)`;
    }

    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: message
    });

    console.log(`✅ Successfully prepared bowl: ${vytInfo.fullUrl}`);
    console.log(`📊 Current prepared bowls count: ${window.appData.preparedBowls.length}`);

    syncToFirebase();

    return { 
        message: message, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// FIXED: Return Scan - Return from both prepared and active bowls
function returnScan(vytInfo) {
    const startTime = Date.now();
    const today = getTodayStandard();

    console.log(`🔍 Looking for bowl to return: ${vytInfo.fullUrl}`);

    let returnSource = null;
    let returnedBowl = null;

    // CHECK 1: Is bowl in prepared bowls?
    const preparedIndex = window.appData.preparedBowls.findIndex(bowl => 
        bowl.code === vytInfo.fullUrl
    );

    if (preparedIndex !== -1) {
        // Return from prepared bowls
        const preparedBowl = window.appData.preparedBowls[preparedIndex];
        window.appData.preparedBowls.splice(preparedIndex, 1);
        returnSource = 'prepared';
        
        returnedBowl = {
            code: vytInfo.fullUrl,
            dish: preparedBowl.dish,
            user: preparedBowl.user,
            company: "", // Reset to empty for return
            customer: "", // Reset to empty for return
            returnedBy: window.appData.user,
            returnDate: today,
            returnTime: new Date().toLocaleTimeString(),
            returnTimestamp: new Date().toISOString(),
            status: 'RETURNED',
            source: 'prepared'
        };
        
        console.log(`✅ Returning bowl from prepared: ${vytInfo.fullUrl}`);
    }
    // CHECK 2: Is bowl in active bowls?
    else {
        const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => 
            bowl.code === vytInfo.fullUrl
        );

        if (activeBowlIndex !== -1) {
            // Return from active bowls
            const activeBowl = window.appData.activeBowls[activeBowlIndex];
            window.appData.activeBowls.splice(activeBowlIndex, 1);
            returnSource = 'active';
            
            returnedBowl = {
                code: vytInfo.fullUrl,
                dish: activeBowl.dish,
                user: activeBowl.user,
                company: "", // Reset to empty for return
                customer: "", // Reset to empty for return
                returnedBy: window.appData.user,
                returnDate: today,
                returnTime: new Date().toLocaleTimeString(),
                returnTimestamp: new Date().toISOString(),
                status: 'RETURNED',
                source: 'active'
            };
            
            console.log(`✅ Returning bowl from active: ${vytInfo.fullUrl}`);
        }
        else {
            // Bowl not found in either prepared or active
            console.log(`❌ Bowl ${vytInfo.fullUrl} not found in prepared or active bowls`);
            return { 
                message: "❌ Bowl not found: " + vytInfo.fullUrl, 
                type: "error",
                responseTime: Date.now() - startTime
            };
        }
    }

    // Add to returnedBowls
    window.appData.returnedBowls.push(returnedBowl);

    // Log the return scan
    window.appData.myScans.push({
        type: 'return',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        company: "",
        customer: "",
        timestamp: new Date().toISOString(),
        source: returnSource
    });

    window.appData.scanHistory.unshift({
        type: 'return',
        code: vytInfo.fullUrl,
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `✅ Returned: ${vytInfo.fullUrl} (from ${returnSource})`
    });

    console.log(`✅ Bowl returned successfully from ${returnSource}: ${vytInfo.fullUrl}`);
    console.log(`🔄 Bowl is now available for fresh kitchen scan`);

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
    document.getElementById('progloveInput').focus();
    updateLastActivity();
    showMessage(`🎯 SCANNING ACTIVE - Ready to scan`, 'success');
}

// ENHANCED: Stop scanning with clear sync status
function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    updateLastActivity();
    
    // Always try to sync when stopping scanning
    syncToFirebase();
    showMessage('⏹ Scanning stopped - syncing to cloud...', 'info');
}

// Storage Functions (ONLY FOR BACKUP - kept for compatibility)
function saveToStorage() {
    try {
        localStorage.setItem('proglove_data', JSON.stringify(window.appData));
    } catch (error) {
        console.log('Storage save note:', error.message);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            const data = JSON.parse(saved);
            window.appData = { ...window.appData, ...data };
            console.log('Data loaded from storage');
            cleanupIncompleteBowls();
        }
    } catch (error) {
        console.log('No previous data found - starting fresh');
    }
}

// User and Mode Management
function initializeUsers() {
    const dropdown = document.getElementById('userDropdown');
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

    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');

    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    document.getElementById('userDropdown').value = '';
    document.getElementById('dishDropdown').value = '';
    document.getElementById('progloveInput').value = '';

    loadUsers();
    updateStatsLabels();
    updateDisplay();
    updateLastActivity();
    showMessage(`📱 ${mode.toUpperCase()} mode selected`, 'info');
}

function updateStatsLabels() {
    const prepLabel = document.getElementById('prepLabel');
    if (window.appData.mode === 'kitchen') {
        prepLabel.textContent = 'Prepared Today';
    } else {
        prepLabel.textContent = 'Returned Today';
    }
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
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
    window.appData.user = dropdown.value;

    if (window.appData.user) {
        showMessage(`✅ ${window.appData.user} selected`, 'success');
        if (window.appData.mode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            loadDishLetters();
        }
    }
    updateDisplay();
    updateLastActivity();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
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
    window.appData.dishLetter = dropdown.value;

    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
    }
    updateDisplay();
    updateLastActivity();
}

// FIXED: Daily Cleanup Timer with standard date format
function startDailyCleanupTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            clearReturnData();
        }
    }, 60000);
}

function clearReturnData() {
    const today = getTodayStandard(); // Use standard date format
    if (window.appData.lastCleanup === today) return;

    window.appData.returnedBowls = [];
    window.appData.lastCleanup = today; // Store in standard format
    syncToFirebase(); // SYNC TO FIREBASE ONLY

    showMessage('✅ Return data cleared for new day', 'success');
    updateDisplay();
}

// FIXED: Display Functions with corrected counting logic
function updateDisplay() {
    document.getElementById('userDropdown').disabled = false;
    document.getElementById('dishDropdown').disabled = false;

    let canScan = window.appData.user && !window.appData.scanning;
    if (window.appData.mode === 'kitchen') canScan = canScan && window.appData.dishLetter;
    document.getElementById('startBtn').disabled = !canScan;
    document.getElementById('stopBtn').disabled = !window.appData.scanning;

    const input = document.getElementById('progloveInput');
    if (window.appData.scanning) {
        document.getElementById('scanSection').classList.add('scanning-active');
        input.placeholder = "Scan VYT code...";
        input.disabled = false;
    } else {
        document.getElementById('scanSection').classList.remove('scanning-active');
        input.placeholder = "Click START SCANNING...";
        input.disabled = !window.appData.scanning;
    }

    const today = getTodayStandard();
    
    // FIXED: Calculate Prepared Today = (All kitchen scans today) - (All return scans today)
    const allKitchenScansToday = window.appData.myScans.filter(scan => 
        scan.type === 'kitchen' && 
        formatDateStandard(new Date(scan.timestamp)) === today
    ).length;

    const allReturnScansToday = window.appData.myScans.filter(scan => 
        scan.type === 'return' && 
        formatDateStandard(new Date(scan.timestamp)) === today
    ).length;

    const preparedToday = Math.max(0, allKitchenScansToday - allReturnScansToday);

    // FIXED: Calculate My Bowl = (User's kitchen scans today) - (User's bowls returned today)
    let myBowlCount = 0;
    if (window.appData.user) {
        const userKitchenScansToday = window.appData.myScans.filter(scan => 
            scan.type === 'kitchen' && 
            scan.user === window.appData.user && 
            formatDateStandard(new Date(scan.timestamp)) === today
        ).length;

        const userBowlsReturnedToday = window.appData.myScans.filter(scan => 
            scan.type === 'return' && 
            scan.user === window.appData.user && 
            formatDateStandard(new Date(scan.timestamp)) === today
        ).length;

        myBowlCount = Math.max(0, userKitchenScansToday - userBowlsReturnedToday);
    }

    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;

    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;

    // FIXED: Show Prepared Today count and My Scans Today correctly
    if (window.appData.mode === 'kitchen') {
        document.getElementById('prepCount').textContent = preparedToday; // Show Prepared Today for all users
        document.getElementById('myScansCount').textContent = window.appData.user ? myBowlCount : 0; // Show My Bowl only when user selected
    } else {
        document.getElementById('prepCount').textContent = returnedToday; // Show Returned Today in return mode
        document.getElementById('myScansCount').textContent = window.appData.user ? returnedToday : 0; // Show Returned Today for user only when selected
    }

    // FIXED: Show accurate totals in export info
    document.getElementById('exportInfo').innerHTML = `
       <strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} bowls • Prepared: ${preparedToday} today • Returns: ${returnedToday} today
   `;
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// FIXED: Overnight Statistics with dish letter grouping
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');

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

    // Get overnight scans
    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= yesterday10PM && scanTime <= today10AM;
    });

    // Group by dish letter and user
    const dishStats = {};
    overnightScans.forEach(scan => {
        const key = `${scan.dish}-${scan.user}`;
        if (!dishStats[key]) {
            dishStats[key] = {
                dish: scan.dish,
                user: scan.user,
                kitchenScans: [],
                returnScans: [],
                startTime: null,
                endTime: null
            };
        }

        if (scan.type === 'kitchen') {
            dishStats[key].kitchenScans.push(scan);
        } else if (scan.type === 'return') {
            dishStats[key].returnScans.push(scan);
        }

        const scanTime = new Date(scan.timestamp);
        if (!dishStats[key].startTime || scanTime < new Date(dishStats[key].startTime)) {
            dishStats[key].startTime = scan.timestamp;
        }
        if (!dishStats[key].endTime || scanTime > new Date(dishStats[key].endTime)) {
            dishStats[key].endTime = scan.timestamp;
        }
    });

    // Calculate net prepared count for each dish+user combination
    const statsArray = Object.values(dishStats)
        .filter(stat => stat.kitchenScans.length > 0) // Only show combinations with kitchen scans
        .map(stat => ({
            ...stat,
            netPrepared: Math.max(0, stat.kitchenScans.length - stat.returnScans.length),
            count: stat.kitchenScans.length + stat.returnScans.length
        }))
        .sort((a, b) => {
            // Sort by dish letter first
            if (a.dish !== b.dish) {
                const aIsNumber = !isNaN(a.dish);
                const bIsNumber = !isNaN(b.dish);

                if (aIsNumber && !bIsNumber) return 1;
                if (!aIsNumber && bIsNumber) return -1;
                if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish);
                return a.dish.localeCompare(b.dish);
            }
            // Then by user name
            return a.user.localeCompare(b.user);
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
               <td>${stat.dish}</td>
               <td>${stat.user}</td>
               <td>${stat.netPrepared}</td>
               <td>${startTime}</td>
               <td>${endTime}</td>
           </tr>
       `;
    });

    statsBody.innerHTML = html;
}

// Data Export Functions
function exportActiveBowls() {
    if (window.appData.activeBowls.length === 0) {
        showMessage('❌ No active bowls to export', 'error');
        return;
    }

    const csvData = convertToCSV(window.appData.activeBowls, ['code', 'dish', 'company', 'customer', 'user', 'date', 'time']);
    downloadCSV(csvData, 'active_bowls.csv');
    showMessage('✅ Active bowls exported as CSV', 'success');
}

function exportReturnData() {
    const today = getTodayStandard(); // Use standard date format
    const todayReturns = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);

    if (todayReturns.length === 0) {
        showMessage('❌ No return data to export today', 'error');
        return;
    }

    const csvData = convertToCSV(todayReturns, ['code', 'dish', 'company', 'customer', 'returnedBy', 'returnDate', 'returnTime']);
    downloadCSV(csvData, 'return_data.csv');
    showMessage('✅ Return data exported as CSV', 'success');
}

// FIXED: Export All Data with standard date format
function exportAllData() {
    console.log('📊 Starting Excel export with standard date format...');
    
    loadXLSXLibrary()
        .then(() => {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded');
            }

            // Merge Firebase data with local backup for complete dataset
            let mergedData = {
                activeBowls: [...window.appData.activeBowls],
                preparedBowls: [...window.appData.preparedBowls],
                returnedBowls: [...window.appData.returnedBowls],
                myScans: [...window.appData.myScans]
            };

            // Try to load local backup and merge
            try {
                const localBackup = localStorage.getItem('proglove_data');
                if (localBackup) {
                    const localData = JSON.parse(localBackup);
                    console.log('🔄 Merging local backup data with current data');
                    
                    // Merge arrays, avoiding duplicates based on timestamp or code
                    if (localData.activeBowls) {
                        const existingCodes = new Set(mergedData.activeBowls.map(bowl => bowl.code));
                        localData.activeBowls.forEach(bowl => {
                            if (!existingCodes.has(bowl.code)) {
                                mergedData.activeBowls.push(bowl);
                            }
                        });
                    }
                    
                    if (localData.preparedBowls) {
                        const existingCodes = new Set(mergedData.preparedBowls.map(bowl => bowl.code));
                        localData.preparedBowls.forEach(bowl => {
                            if (!existingCodes.has(bowl.code)) {
                                mergedData.preparedBowls.push(bowl);
                            }
                        });
                    }
                    
                    if (localData.returnedBowls) {
                        const existingCodes = new Set(mergedData.returnedBowls.map(bowl => bowl.code));
                        localData.returnedBowls.forEach(bowl => {
                            if (!existingCodes.has(bowl.code)) {
                                mergedData.returnedBowls.push(bowl);
                            }
                        });
                    }
                    
                    if (localData.myScans) {
                        const existingTimestamps = new Set(mergedData.myScans.map(scan => scan.timestamp));
                        localData.myScans.forEach(scan => {
                            if (!existingTimestamps.has(scan.timestamp)) {
                                mergedData.myScans.push(scan);
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn('Local backup merge failed, using current data only:', error);
            }

            // Create workbook with merged data
            const wb = XLSX.utils.book_new();
            
            // Sheet 1: Active Bowls - Convert dates to standard format
            const activeData = mergedData.activeBowls.length > 0 
                ? mergedData.activeBowls.map(bowl => ({
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'Company': bowl.company,
                    'Customer': bowl.customer,
                    'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No',
                    'User': bowl.user,
                    'Date': convertToStandardDate(bowl.date), // Convert to standard format
                    'Time': bowl.time,
                    'Status': bowl.status
                }))
                : [{'VYT Code': 'No active bowls', 'Dish': '', 'Company': '', 'Customer': '', 'Multiple Customers': '', 'User': '', 'Date': '', 'Time': '', 'Status': ''}];
            
            const wsActive = XLSX.utils.json_to_sheet(activeData);
            XLSX.utils.book_append_sheet(wb, wsActive, 'Active Bowls');
            
            // Sheet 2: Prepared Bowls - Convert dates to standard format
            const preparedData = mergedData.preparedBowls.length > 0 
                ? mergedData.preparedBowls.map(bowl => ({
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'Company': bowl.company,
                    'Customer': bowl.customer,
                    'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No',
                    'User': bowl.user,
                    'Date': convertToStandardDate(bowl.date), // Convert to standard format
                    'Time': bowl.time,
                    'Status': bowl.status
                }))
                : [{'VYT Code': 'No prepared bowls', 'Dish': '', 'Company': '', 'Customer': '', 'Multiple Customers': '', 'User': '', 'Date': '', 'Time': '', 'Status': ''}];
            
            const wsPrepared = XLSX.utils.json_to_sheet(preparedData);
            XLSX.utils.book_append_sheet(wb, wsPrepared, 'Prepared Bowls');
            
            // Sheet 3: Returned Bowls - Convert dates to standard format
            const returnedData = mergedData.returnedBowls.length > 0 
                ? mergedData.returnedBowls.map(bowl => ({
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'Company': bowl.company,
                    'Customer': bowl.customer,
                    'Returned By': bowl.returnedBy,
                    'Return Date': convertToStandardDate(bowl.returnDate), // Convert to standard format
                    'Return Time': bowl.returnTime,
                    'Status': bowl.status
                }))
                : [{'VYT Code': 'No returned bowls', 'Dish': '', 'Company': '', 'Customer': '', 'Returned By': '', 'Return Date': '', 'Return Time': '', 'Status': ''}];

            const wsReturned = XLSX.utils.json_to_sheet(returnedData);
            XLSX.utils.book_append_sheet(wb, wsReturned, 'Returned Bowls');

            // Export the workbook
            const fileName = `complete_scanner_data_${getTodayStandard()}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            console.log('✅ Excel file exported successfully with standard date format:', {
                active: mergedData.activeBowls.length,
                prepared: mergedData.preparedBowls.length,
                returned: mergedData.returnedBowls.length
            });
            
            showMessage(`✅ All data exported: ${mergedData.activeBowls.length} active, ${mergedData.preparedBowls.length} prepared, ${mergedData.returnedBowls.length} returned bowls`, 'success');
        })
        .catch((error) => {
            console.error('Excel export error:', error);
            showMessage('❌ Excel export failed: ' + error.message, 'error');
        });
}

function convertToCSV(data, fields) {
    const headers = fields.join(',');
    const rows = data.map(item => {
        return fields.map(field => {
            let value = item[field] || '';
            // Convert dates to standard format for CSV export
            if ((field === 'date' || field === 'returnDate') && value) {
                value = convertToStandardDate(value);
            }
            return `"${value}"`;
        }).join(',');
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

// FIXED: Reset ALL prepared bowls and related scans
function resetTodaysPreparedBowls() {
    if (!confirm('Are you sure you want to remove ALL prepared bowls? This cannot be undone.')) {
        return;
    }
    
    console.log('🔄 Removing ALL prepared bowls and today\'s kitchen scans...');
    
    const today = getTodayStandard();
    const initialPreparedCount = window.appData.preparedBowls.length;
    
    // STEP 1: Remove ALL prepared bowls
    window.appData.preparedBowls = [];
    
    // STEP 2: Remove today's kitchen scans from myScans
    const initialScanCount = window.appData.myScans.length;
    window.appData.myScans = window.appData.myScans.filter(scan => 
        !(scan.type === 'kitchen' && formatDateStandard(new Date(scan.timestamp)) === today)
    );
    const removedScans = initialScanCount - window.appData.myScans.length;
    
    console.log(`🗑️ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans`);
    
    if (initialPreparedCount > 0 || removedScans > 0) {
        // Update lastSync to ensure our changes are newer
        window.appData.lastSync = new Date().toISOString();
        
        // Force sync to Firebase
        syncToFirebase();
        
        // Update display to show 0
        updateDisplay();
        
        showMessage(`✅ Removed ALL ${initialPreparedCount} prepared bowls and ${removedScans} kitchen scans`, 'success');
    } else {
        showMessage('ℹ️ No prepared bowls found to remove', 'info');
    }
}

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
window.resetTodaysPreparedBowls = resetTodaysPreparedBowls;
window.manualSyncToFirebase = syncToFirebase;
window.clearLocalBackup = clearLocalBackup;
