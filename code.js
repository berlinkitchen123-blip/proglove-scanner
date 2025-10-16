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

// ========== FIREBASE FUNCTIONS ==========

// Load Firebase SDK dynamically
function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
        // Check if Firebase is already loaded
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            console.log('✅ Firebase already loaded');
            resolve();
            return;
        }

        console.log('🔄 Loading Firebase SDK...');
        
        // Load Firebase App
        const scriptApp = document.createElement('script');
        scriptApp.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        scriptApp.onload = function() {
            console.log('✅ Firebase App loaded');
            // Load Firebase Database
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
            
            // Now initialize Firebase app
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✅ Firebase app initialized');
            }
            
            // Load data from Firebase
            loadFromFirebase();
        })
        .catch((error) => {
            console.error('❌ Failed to load Firebase SDK:', error);
            loadFromStorage();
            initializeUI();
            showMessage('⚠️ Using local storage (Firebase failed to load)', 'warning');
            document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
        });
}

// Load data from Firebase with bowl-by-bowl merge - LOCAL DATA WINS
function loadFromFirebase() {
    try {
        console.log('🔄 Loading data from Firebase...');
        const db = firebase.database();
        const appDataRef = db.ref('progloveData');
        
        showMessage('🔄 Loading from cloud...', 'info');
        document.getElementById('systemStatus').textContent = '🔄 Connecting to Cloud...';
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase connection timeout')), 180000); // 3 minutes timeout
        });

        Promise.race([appDataRef.once('value'), timeoutPromise])
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const firebaseData = snapshot.val();
                    console.log('✅ Firebase data loaded, starting bowl-by-bowl merge...');
                    console.log('📊 Firebase data:', firebaseData);
                    
                    // Load local data (LATEST)
                    loadFromStorage();
                    console.log('📊 Local data (LATEST):', window.appData);
                    
                    // Start bowl-by-bowl merge - LOCAL DATA WINS
                    mergeFirebaseWithLocalData(firebaseData);
                    
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

// Bowl-by-bowl merge - LOCAL DATA WINS over Firebase data
function mergeFirebaseWithLocalData(firebaseData) {
    console.log('🔄 Starting bowl-by-bowl merge...');
    showMessage('🔄 Merging cloud data with local data...', 'info');
    
    // Show progress element
    const progressElement = document.getElementById('mergeProgress');
    if (progressElement) {
        progressElement.style.display = 'block';
        progressElement.innerHTML = 'Starting data merge...';
    }
    
    let bowlsUpdated = 0;
    let bowlsAdded = 0;
    
    // Merge activeBowls - LOCAL WINS
    if (firebaseData.activeBowls && Array.isArray(firebaseData.activeBowls)) {
        console.log(`🔄 Processing ${firebaseData.activeBowls.length} active bowls from Firebase...`);
        
        firebaseData.activeBowls.forEach((firebaseBowl, index) => {
            setTimeout(() => {
                const localBowlIndex = window.appData.activeBowls.findIndex(
                    localBowl => localBowl.code === firebaseBowl.code
                );
                
                if (localBowlIndex !== -1) {
                    // Bowl exists in both - KEEP LOCAL DATA (newer)
                    console.log(`✅ Keeping local bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                    bowlsUpdated++;
                } else {
                    // Bowl only in Firebase - ADD to local (but this shouldn't happen if local is newer)
                    console.log(`🆕 Adding Firebase bowl to local: ${firebaseBowl.code}`);
                    window.appData.activeBowls.push(firebaseBowl);
                    bowlsAdded++;
                }
                
                // Update progress
                updateMergeProgress('active', index + 1, firebaseData.activeBowls.length, bowlsUpdated, bowlsAdded);
                
            }, index * 100); // 100ms delay between each bowl
        });
    }
    
    // Merge preparedBowls - LOCAL WINS
    if (firebaseData.preparedBowls && Array.isArray(firebaseData.preparedBowls)) {
        setTimeout(() => {
            console.log(`🔄 Processing ${firebaseData.preparedBowls.length} prepared bowls from Firebase...`);
            
            firebaseData.preparedBowls.forEach((firebaseBowl, index) => {
                setTimeout(() => {
                    const localBowlIndex = window.appData.preparedBowls.findIndex(
                        localBowl => localBowl.code === firebaseBowl.code
                    );
                    
                    if (localBowlIndex !== -1) {
                        // Bowl exists in both - KEEP LOCAL DATA (newer)
                        console.log(`✅ Keeping local prepared bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                        bowlsUpdated++;
                    } else {
                        // Bowl only in Firebase - ADD to local
                        console.log(`🆕 Adding Firebase prepared bowl to local: ${firebaseBowl.code}`);
                        window.appData.preparedBowls.push(firebaseBowl);
                        bowlsAdded++;
                    }
                    
                    // Update progress
                    updateMergeProgress('prepared', index + 1, firebaseData.preparedBowls.length, bowlsUpdated, bowlsAdded);
                    
                }, (firebaseData.activeBowls?.length || 0) * 100 + index * 100);
            });
        }, (firebaseData.activeBowls?.length || 0) * 100 + 1000);
    }
    
    // Merge returnedBowls - LOCAL WINS
    if (firebaseData.returnedBowls && Array.isArray(firebaseData.returnedBowls)) {
        setTimeout(() => {
            console.log(`🔄 Processing ${firebaseData.returnedBowls.length} returned bowls from Firebase...`);
            
            firebaseData.returnedBowls.forEach((firebaseBowl, index) => {
                setTimeout(() => {
                    const localBowlIndex = window.appData.returnedBowls.findIndex(
                        localBowl => localBowl.code === firebaseBowl.code
                    );
                    
                    if (localBowlIndex !== -1) {
                        // Bowl exists in both - KEEP LOCAL DATA (newer)
                        console.log(`✅ Keeping local returned bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                        bowlsUpdated++;
                    } else {
                        // Bowl only in Firebase - ADD to local
                        console.log(`🆕 Adding Firebase returned bowl to local: ${firebaseBowl.code}`);
                        window.appData.returnedBowls.push(firebaseBowl);
                        bowlsAdded++;
                    }
                    
                    // Update progress
                    updateMergeProgress('returned', index + 1, firebaseData.returnedBowls.length, bowlsUpdated, bowlsAdded);
                    
                }, ((firebaseData.activeBowls?.length || 0) + (firebaseData.preparedBowls?.length || 0)) * 100 + index * 100);
            });
        }, ((firebaseData.activeBowls?.length || 0) + (firebaseData.preparedBowls?.length || 0)) * 100 + 2000);
    }
    
    // Finalize after all merges complete
    const totalBowls = (firebaseData.activeBowls?.length || 0) + 
                      (firebaseData.preparedBowls?.length || 0) + 
                      (firebaseData.returnedBowls?.length || 0);
    
    setTimeout(() => {
        console.log(`✅ Merge completed: ${bowlsUpdated} bowls kept (local), ${bowlsAdded} bowls added from Firebase`);
        showMessage(`✅ Data merge complete: ${bowlsUpdated} local bowls preserved, ${bowlsAdded} cloud bowls added`, 'success');
        
        // Hide progress element
        if (progressElement) {
            progressElement.style.display = 'none';
        }
        
        // Clean up and sync merged data back to Firebase
        cleanupIncompleteBowls();
        syncToFirebase(); // Upload merged data to Firebase
        
        // Initialize UI
        initializeUI();
        
    }, totalBowls * 100 + 3000); // Wait for all operations to complete
}

// Show merge progress
function updateMergeProgress(bowlType, current, total, updated, added) {
    const progress = Math.round((current / total) * 100);
    console.log(`📊 ${bowlType} bowls: ${current}/${total} (${progress}%) - Updated: ${updated}, Added: ${added}`);
    
    // Update UI progress
    const progressElement = document.getElementById('mergeProgress');
    if (progressElement) {
        progressElement.innerHTML = `
            Merging ${bowlType} bowls: ${current}/${total} (${progress}%)<br>
            Local bowls kept: ${updated} | Cloud bowls added: ${added}
        `;
    }
}

// Sync to Firebase
function syncToFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.log('Firebase not available, saving to local storage only');
            saveToStorage();
            return;
        }
        
        const db = firebase.database();
        const backupData = {
            activeBowls: window.appData.activeBowls,
            preparedBowls: window.appData.preparedBowls,
            returnedBowls: window.appData.returnedBowls,
            myScans: window.appData.myScans,
            scanHistory: window.appData.scanHistory,
            customerData: window.appData.customerData,
            lastCleanup: window.appData.lastCleanup,
            lastSync: new Date().toISOString()
        };
        
        db.ref('progloveData').set(backupData)
            .then(() => {
                window.appData.lastSync = new Date().toISOString();
                console.log('✅ Data synced to Firebase');
                document.getElementById('systemStatus').textContent = '✅ Cloud Synced';
            })
            .catch((error) => {
                console.error('Firebase sync failed:', error);
                saveToStorage();
                document.getElementById('systemStatus').textContent = '⚠️ Sync Failed - Using Local';
            });
    } catch (error) {
        console.error('Sync error:', error);
        saveToStorage();
    }
}

// Clean up VYT codes without company details
function cleanupIncompleteBowls() {
    const initialCount = window.appData.activeBowls.length;
    
    window.appData.activeBowls = window.appData.activeBowls.filter(bowl => {
        // Remove bowls that have incomplete company data
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

// ========== EXISTING SCANNER FUNCTIONS ==========

// VYTAL URL DETECTION - KEEP URLs EXACT, NO SHORTENING
function detectVytCode(input) {
    if (!input || typeof input !== 'string') return null;

    const cleanInput = input.trim();

    // Check if it's ANY VYTAL-related URL (VYT.TO or VYTAL)
    if (cleanInput.includes('VYT.TO/') || cleanInput.includes('VYTAL')) {
        return {
            fullUrl: cleanInput, // KEEP ORIGINAL URL EXACTLY
            type: cleanInput.includes('VYT.TO/') ? 'VYT.TO' : 'VYTAL'
        };
    }

    return null;
}

// Helper function to extract company from uniqueIdentifier
function extractCompanyFromUniqueIdentifier(uniqueIdentifier) {
    if (!uniqueIdentifier) return "Unknown";
    
    // Example: "cm-1-Bahnhofstr - degewo-2025-10-13" → "Bahnhofstr - degewo"
    const parts = uniqueIdentifier.split('-');
    if (parts.length >= 3) {
        // Join parts from index 2 to second-last (excluding date)
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

    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Scanner System...');
    initializeFirebase(); // This starts the Firebase loading process
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

// UPDATED JSON Data Processing - Extract from your actual JSON structure
function processJSONData() {
    const jsonTextarea = document.getElementById('jsonData');
    const jsonText = jsonTextarea.value.trim();

    if (!jsonText) {
        showMessage('❌ Please paste JSON data first', 'error');
        return;
    }

    try {
        const jsonData = JSON.parse(jsonText);
        console.log('🔍 Starting JSON extraction from delivery data...');

        const extractedData = [];
        const patchResults = {
            matched: 0,
            failed: []
        };

        // STEP 1: Extract data from your JSON structure
        if (jsonData.boxes && Array.isArray(jsonData.boxes)) {
            jsonData.boxes.forEach(box => {
                const company = extractCompanyFromUniqueIdentifier(box.uniqueIdentifier);
                
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
                                        company: company,
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
        
        console.log('📊 Extracted data:', extractedData);
        console.log('Active bowls before patch:', window.appData.activeBowls.length);
        
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

                // Patch the data to all matching bowls
                matchingBowls.forEach(bowl => {
                    // Store original values for logging
                    const oldCompany = bowl.company;
                    const oldCustomer = bowl.customer;

                    // Patch the data from JSON
                    bowl.company = customer.company || "Unknown";
                    bowl.customer = customer.customer || "Unknown";
                    bowl.dish = customer.dish || bowl.dish;
                    bowl.multipleCustomers = customer.multipleCustomers;

                    console.log(`🔄 Patched bowl ${bowl.code}: Company "${oldCompany}" → "${bowl.company}" | Customer "${oldCustomer}" → "${bowl.customer}"`);
                });

                patchResults.matched += matchingBowls.length;
            } else {
                // No active bowl found for this VYT code
                console.log(`❌ No active bowl found for VYT code: ${exactVytCode}`);
                patchResults.failed.push({
                    vyt_code: exactVytCode,
                    customer: customer.customer || 'Unknown',
                    company: customer.company || 'Unknown',
                    reason: 'No active bowl found with this VYT code'
                });
            }
        });

        // STEP 3: After individual patching, combine customer names for same dish + COLOR CODING
        if (patchResults.matched > 0) {
            combineCustomerNamesByDish();
        }
        
        // Update display and save
        updateDisplay();
        saveToStorage();
        syncToFirebase();

        // Show results
        showMessage(`✅ JSON processing completed: ${extractedData.length} VYT codes extracted, ${patchResults.matched} bowls updated`, 'success');

        // Show detailed results
        document.getElementById('patchResults').style.display = 'block';
        document.getElementById('patchSummary').textContent = 
            `Extracted: ${extractedData.length} VYT codes | Matched: ${patchResults.matched} bowls | Failed: ${patchResults.failed.length}`;

        const failedDiv = document.getElementById('failedMatches');
        if (patchResults.failed.length > 0) {
            let failedHtml = '<strong>Failed matches:</strong><br>';
            patchResults.failed.forEach(failed => {
                failedHtml += `• ${failed.vyt_code} - ${failed.customer} (${failed.reason})<br>`;
            });
            failedDiv.innerHTML = failedHtml;
        } else {
            failedDiv.innerHTML = '<em>All VYT codes matched successfully!</em>';
        }

        document.getElementById('jsonStatus').innerHTML = 
            `<strong>JSON Status:</strong> ${extractedData.length} VYT codes extracted from delivery data, ${patchResults.matched} bowls patched`;

        console.log('📊 Final patch results:', patchResults);

    } catch (error) {
        showMessage('❌ Error processing JSON data: ' + error.message, 'error');
    }
}

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

// UPDATED Scanning Functions - KEEP URLs EXACT
function processScan(input) {
    let result;

    // Detect VYT code - KEEP URL EXACT
    const vytInfo = detectVytCode(input);

    if (!vytInfo) {
        return {
            message: "❌ Invalid VYT code/URL format: " + input,
            type: "error", 
            responseTime: 0
        };
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

// UPDATED Kitchen Scan - REMOVE company details when moving from active to prepared
function kitchenScan(vytInfo) {
    const startTime = Date.now();
    const today = new Date().toLocaleDateString('en-GB');

    // Check if bowl is already processed today
    const isAlreadyActive = window.appData.activeBowls.some(bowl => bowl.code === vytInfo.fullUrl);
    const isPreparedToday = window.appData.preparedBowls.some(bowl => bowl.code === vytInfo.fullUrl && bowl.date === today);

    // ERROR: Bowl is currently active (can't scan same bowl twice without return)
    if (isAlreadyActive) {
        return { 
            message: "❌ Bowl already active: " + vytInfo.fullUrl, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    // ERROR: Already prepared today (even if returned, can't prepare twice same day)
    if (isPreparedToday) {
        return { 
            message: "❌ Already prepared today: " + vytInfo.fullUrl, 
            type: "error",
            responseTime: Date.now() - startTime
        };
    }

    // Check if this bowl exists in active bowls with company details
    const existingActiveBowl = window.appData.activeBowls.find(bowl => bowl.code === vytInfo.fullUrl);
    
    const newBowl = {
        code: vytInfo.fullUrl, // STORE EXACT URL
        dish: window.appData.dishLetter,
        user: window.appData.user,
        // REMOVE company and customer details when moving to prepared
        company: "", // Clear company name
        customer: "", // Clear customer name
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        status: 'ACTIVE',
        multipleCustomers: false
    };

    // If bowl exists in active with company details, remove it first
    if (existingActiveBowl) {
        const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
        window.appData.activeBowls.splice(activeIndex, 1);
        console.log(`🗑️ Removed bowl from active with company details: ${vytInfo.fullUrl}`);
    }

    // ADD TO BOTH collections
    window.appData.activeBowls.push(newBowl);
    window.appData.preparedBowls.push({...newBowl, status: 'PREPARED'});

    window.appData.myScans.push({
        type: 'kitchen',
        code: vytInfo.fullUrl, // STORE EXACT URL
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: newBowl.company,
        customer: newBowl.customer,
        timestamp: new Date().toISOString()
    });

    window.appData.scanHistory.unshift({
        type: 'kitchen',
        code: vytInfo.fullUrl, // STORE EXACT URL
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl}`
    });

    saveToStorage();
    syncToFirebase();

    return { 
        message: `✅ ${window.appData.dishLetter} Prepared: ${vytInfo.fullUrl}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// UPDATED Return Scan - CORRECTED LOGIC: Remove from BOTH active and prepared
function returnScan(vytInfo) {
    const startTime = Date.now();
    const today = new Date().toLocaleDateString('en-GB');

    // Find in activeBowls
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);

    if (activeBowlIndex === -1) {
        const isReturnedToday = window.appData.returnedBowls.some(bowl => bowl.code === vytInfo.fullUrl && bowl.returnDate === today);

        if (isReturnedToday) {
            return { 
                message: "❌ Already returned today: " + vytInfo.fullUrl, 
                type: "error",
                responseTime: Date.now() - startTime
            };
        } else {
            return { 
                message: "❌ Bowl not active: " + vytInfo.fullUrl, 
                type: "error",
                responseTime: Date.now() - startTime
            };
        }
    }

    const activeBowl = window.appData.activeBowls[activeBowlIndex];

    // STEP 1: Remove from activeBowls
    window.appData.activeBowls.splice(activeBowlIndex, 1);

    // STEP 2: Remove from preparedBowls (today's entry)
    const preparedBowlIndex = window.appData.preparedBowls.findIndex(
        bowl => bowl.code === vytInfo.fullUrl && bowl.date === today
    );
    if (preparedBowlIndex !== -1) {
        window.appData.preparedBowls.splice(preparedBowlIndex, 1);
    }

    // STEP 3: Add to returnedBowls
    window.appData.returnedBowls.push({
        ...activeBowl,
        returnedBy: window.appData.user,
        returnDate: today,
        returnTime: new Date().toLocaleTimeString(),
        returnTimestamp: new Date().toISOString(),
        status: 'RETURNED'
    });

    window.appData.myScans.push({
        type: 'return',
        code: vytInfo.fullUrl, // STORE EXACT URL
        user: window.appData.user,
        company: activeBowl.company,
        customer: activeBowl.customer,
        timestamp: new Date().toISOString(),
        originalData: activeBowl
    });

    window.appData.scanHistory.unshift({
        type: 'return',
        code: vytInfo.fullUrl, // STORE EXACT URL
        user: window.appData.user,
        timestamp: new Date().toISOString(),
        message: `Returned: ${vytInfo.fullUrl}`
    });

    saveToStorage();
    syncToFirebase();

    return { 
        message: `✅ Returned: ${vytInfo.fullUrl}`, 
        type: "success",
        responseTime: Date.now() - startTime
    };
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
    saveToStorage();
    syncToFirebase();

    showMessage('✅ Return data cleared for new day', 'success');
    updateDisplay();
}

// Storage Functions
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
            
            // Clean up incomplete bowls when loading from storage
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

    // Add letters A-Z
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        const option = document.createElement('option');
        option.value = letter;
        option.textContent = letter;
        dropdown.appendChild(option);
    });

    // Add numbers 1-4
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

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    updateLastActivity();
    showMessage(`⏹ Scanning stopped`, 'info');
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;

    const scanValue = e.target.value.trim();
    if (scanValue.length >= 2) {
        processScan(scanValue);
        setTimeout(() => e.target.value = '', 100);
    }
    updateLastActivity();
}

// Overnight Statistics Table (10PM-10AM) - INCLUDES DISHES 1-4
function updateOvernightStats() {
    const statsBody = document.getElementById('overnightStatsBody');
    const cycleInfo = document.getElementById('cycleInfo');

    // Calculate overnight cycle (10PM previous day to 10AM current day)
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

    // Filter scans for overnight cycle
    const overnightScans = window.appData.myScans.filter(scan => {
        const scanTime = new Date(scan.timestamp);
        return scanTime >= yesterday10PM && scanTime <= today10AM;
    });

    // Group by dish and user - INCLUDES DISHES 1-4
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

    // Convert to array and sort - INCLUDES DISHES 1-4
    const statsArray = Object.values(dishStats).sort((a, b) => {
        // Sort dishes: A-Z then 1-4
        if (a.dish !== b.dish) {
            const aIsNumber = !isNaN(a.dish);
            const bIsNumber = !isNaN(b.dish);

            if (aIsNumber && !bIsNumber) return 1; // Numbers after letters
            if (!aIsNumber && bIsNumber) return -1; // Letters before numbers
            if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish); // Numeric sort for numbers
            return a.dish.localeCompare(b.dish); // Alphabetic sort for letters
        }
        return new Date(a.startTime) - new Date(b.startTime);
    });

    // Update table
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

// Export All Data to Excel
function exportAllData() {
    const allData = {
        activeBowls: window.appData.activeBowls,
        preparedBowls: window.appData.preparedBowls,
        returnedBowls: window.appData.returnedBowls,
        customerData: window.appData.customerData,
        scanHistory: window.appData.scanHistory,
        exportTime: new Date().toISOString()
    };

    const csvData = convertAllDataToCSV(allData);
    downloadCSV(csvData, 'complete_scanner_data.csv');
    showMessage('✅ All data exported as CSV', 'success');
}

function convertAllDataToCSV(allData) {
    let csvContent = "PROGLOVE SCANNER - COMPLETE DATA EXPORT\n";
    csvContent += `Exported on: ${new Date().toLocaleString()}\n\n`;

    // Active Bowls - INCLUDE COLOR CODING INFO
    csvContent += "ACTIVE BOWLS\n";
    csvContent += "Code,Dish,Company,Customer,Multiple Customers,User,Date,Time,Status\n";
    allData.activeBowls.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${multipleFlag}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    csvContent += "\n";

    // Prepared Bowls (Today)
    const today = new Date().toLocaleDateString('en-GB');
    const todayPrepared = allData.preparedBowls.filter(bowl => bowl.date === today);
    csvContent += "PREPARED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,Multiple Customers,User,Date,Time,Status\n";
    todayPrepared.forEach(bowl => {
        const multipleFlag = bowl.multipleCustomers ? "Yes" : "No";
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${multipleFlag}","${bowl.user}","${bowl.date}","${bowl.time}","${bowl.status}"\n`;
    });
    csvContent += "\n";

    // Returned Bowls (Today)
    const todayReturns = allData.returnedBowls.filter(bowl => bowl.returnDate === today);
    csvContent += "RETURNED BOWLS (TODAY)\n";
    csvContent += "Code,Dish,Company,Customer,Returned By,Return Date,Return Time\n";
    todayReturns.forEach(bowl => {
        csvContent += `"${bowl.code}","${bowl.dish}","${bowl.company}","${bowl.customer}","${bowl.returnedBy}","${bowl.returnDate}","${bowl.returnTime}"\n`;
    });
    csvContent += "\n";

    // Customer Data
    csvContent += "CUSTOMER DATA\n";
    csvContent += "VYT Code,Company,Customer,Dish\n";
    allData.customerData.forEach(customer => {
        csvContent += `"${customer.vyt_code}","${customer.company}","${customer.customer}","${customer.dish}"\n`;
    });
    csvContent += "\n";

    // Recent Scan History
    csvContent += "RECENT SCAN HISTORY (Last 50)\n";
    csvContent += "Type,Code,User,Company,Customer,Timestamp,Message\n";
    allData.scanHistory.slice(0, 50).forEach(scan => {
        csvContent += `"${scan.type}","${scan.code}","${scan.user}","${scan.company || ''}","${scan.customer || ''}","${scan.timestamp}","${scan.message}"\n`;
    });

    return csvContent;
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

// Display Functions
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

    const today = new Date().toLocaleDateString('en-GB');
    const userTodayScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && 
        new Date(scan.timestamp).toLocaleDateString('en-GB') === today
    ).length;

    const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;

    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;

    if (window.appData.mode === 'kitchen') {
        document.getElementById('prepCount').textContent = preparedToday;
        document.getElementById('myScansCount').textContent = userTodayScans;
    } else {
        document.getElementById('prepCount').textContent = returnedToday;
        document.getElementById('myScansCount').textContent = userTodayScans;
    }

    document.getElementById('exportInfo').innerHTML = `
       <strong>Data Status:</strong> Active: ${window.appData.activeBowls.length} bowls • Prepared: ${preparedToday} today • Returns: ${returnedToday} today
   `;
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
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
