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
loadFromStorage();
initializeUI();
showMessage('⚠️ Using local storage (Firebase failed)', 'warning');
document.getElementById('systemStatus').textContent = '⚠️ Offline Mode - Local Storage';
});
}

// Load data from Firebase
function loadFromFirebase() {
try {
console.log('🔄 Loading data from Firebase...');
const db = firebase.database();
const appDataRef = db.ref('progloveData');

showMessage('🔄 Loading from cloud...', 'info');
document.getElementById('systemStatus').textContent = '🔄 Connecting to Cloud...';

const timeoutPromise = new Promise((_, reject) => {
setTimeout(() => reject(new Error('Firebase connection timeout')), 180000);
});

Promise.race([appDataRef.once('value'), timeoutPromise])
.then((snapshot) => {
if (snapshot.exists()) {
const firebaseData = snapshot.val();
console.log('✅ Firebase data loaded, starting merge...');

loadFromStorage();
console.log('📊 Local data (LATEST):', window.appData);

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

// Bowl-by-bowl merge - LOCAL DATA WINS
function mergeFirebaseWithLocalData(firebaseData) {
console.log('🔄 Starting bowl-by-bowl merge...');
showMessage('🔄 Merging cloud data with local data...', 'info');

const progressElement = document.getElementById('mergeProgress');
if (progressElement) {
progressElement.style.display = 'block';
progressElement.innerHTML = 'Starting data merge...';
}

let bowlsUpdated = 0;
let bowlsAdded = 0;

    // Merge activeBowls
    // Merge activeBowls - REMOVED DELAYS FOR PERFORMANCE
if (firebaseData.activeBowls && Array.isArray(firebaseData.activeBowls)) {
console.log(`🔄 Processing ${firebaseData.activeBowls.length} active bowls from Firebase...`);

firebaseData.activeBowls.forEach((firebaseBowl, index) => {
            setTimeout(() => {
                const localBowlIndex = window.appData.activeBowls.findIndex(
                    localBowl => localBowl.code === firebaseBowl.code
                );
                
                if (localBowlIndex !== -1) {
                    console.log(`✅ Keeping local bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                    bowlsUpdated++;
                } else {
                    console.log(`🆕 Adding Firebase bowl to local: ${firebaseBowl.code}`);
                    window.appData.activeBowls.push(firebaseBowl);
                    bowlsAdded++;
                }
                
                updateMergeProgress('active', index + 1, firebaseData.activeBowls.length, bowlsUpdated, bowlsAdded);
                
            }, index * 100);
            const localBowlIndex = window.appData.activeBowls.findIndex(
                localBowl => localBowl.code === firebaseBowl.code
            );
            
            if (localBowlIndex !== -1) {
                console.log(`✅ Keeping local bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                bowlsUpdated++;
            } else {
                console.log(`🆕 Adding Firebase bowl to local: ${firebaseBowl.code}`);
                window.appData.activeBowls.push(firebaseBowl);
                bowlsAdded++;
            }
            
            updateMergeProgress('active', index + 1, firebaseData.activeBowls.length, bowlsUpdated, bowlsAdded);
});
}

    // Merge preparedBowls
    // Merge preparedBowls - REMOVED DELAYS FOR PERFORMANCE
if (firebaseData.preparedBowls && Array.isArray(firebaseData.preparedBowls)) {
        setTimeout(() => {
            console.log(`🔄 Processing ${firebaseData.preparedBowls.length} prepared bowls from Firebase...`);
        console.log(`🔄 Processing ${firebaseData.preparedBowls.length} prepared bowls from Firebase...`);
        
        firebaseData.preparedBowls.forEach((firebaseBowl, index) => {
            const localBowlIndex = window.appData.preparedBowls.findIndex(
                localBowl => localBowl.code === firebaseBowl.code
            );

            firebaseData.preparedBowls.forEach((firebaseBowl, index) => {
                setTimeout(() => {
                    const localBowlIndex = window.appData.preparedBowls.findIndex(
                        localBowl => localBowl.code === firebaseBowl.code
                    );
                    
                    if (localBowlIndex !== -1) {
                        console.log(`✅ Keeping local prepared bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                        bowlsUpdated++;
                    } else {
                        console.log(`🆕 Adding Firebase prepared bowl to local: ${firebaseBowl.code}`);
                        window.appData.preparedBowls.push(firebaseBowl);
                        bowlsAdded++;
                    }
                    
                    updateMergeProgress('prepared', index + 1, firebaseData.preparedBowls.length, bowlsUpdated, bowlsAdded);
                    
                }, (firebaseData.activeBowls?.length || 0) * 100 + index * 100);
            });
        }, (firebaseData.activeBowls?.length || 0) * 100 + 1000);
            if (localBowlIndex !== -1) {
                console.log(`✅ Keeping local prepared bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                bowlsUpdated++;
            } else {
                console.log(`🆕 Adding Firebase prepared bowl to local: ${firebaseBowl.code}`);
                window.appData.preparedBowls.push(firebaseBowl);
                bowlsAdded++;
            }
            
            updateMergeProgress('prepared', index + 1, firebaseData.preparedBowls.length, bowlsUpdated, bowlsAdded);
        });
}

    // Merge returnedBowls
    // Merge returnedBowls - REMOVED DELAYS FOR PERFORMANCE
if (firebaseData.returnedBowls && Array.isArray(firebaseData.returnedBowls)) {
        setTimeout(() => {
            console.log(`🔄 Processing ${firebaseData.returnedBowls.length} returned bowls from Firebase...`);
        console.log(`🔄 Processing ${firebaseData.returnedBowls.length} returned bowls from Firebase...`);
        
        firebaseData.returnedBowls.forEach((firebaseBowl, index) => {
            const localBowlIndex = window.appData.returnedBowls.findIndex(
                localBowl => localBowl.code === firebaseBowl.code
            );

            firebaseData.returnedBowls.forEach((firebaseBowl, index) => {
                setTimeout(() => {
                    const localBowlIndex = window.appData.returnedBowls.findIndex(
                        localBowl => localBowl.code === firebaseBowl.code
                    );
                    
                    if (localBowlIndex !== -1) {
                        console.log(`✅ Keeping local returned bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                        bowlsUpdated++;
                    } else {
                        console.log(`🆕 Adding Firebase returned bowl to local: ${firebaseBowl.code}`);
                        window.appData.returnedBowls.push(firebaseBowl);
                        bowlsAdded++;
                    }
                    
                    updateMergeProgress('returned', index + 1, firebaseData.returnedBowls.length, bowlsUpdated, bowlsAdded);
                    
                }, ((firebaseData.activeBowls?.length || 0) + (firebaseData.preparedBowls?.length || 0)) * 100 + index * 100);
            });
        }, ((firebaseData.activeBowls?.length || 0) + (firebaseData.preparedBowls?.length || 0)) * 100 + 2000);
            if (localBowlIndex !== -1) {
                console.log(`✅ Keeping local returned bowl: ${firebaseBowl.code} (LOCAL WINS)`);
                bowlsUpdated++;
            } else {
                console.log(`🆕 Adding Firebase returned bowl to local: ${firebaseBowl.code}`);
                window.appData.returnedBowls.push(firebaseBowl);
                bowlsAdded++;
            }
            
            updateMergeProgress('returned', index + 1, firebaseData.returnedBowls.length, bowlsUpdated, bowlsAdded);
        });
}

    const totalBowls = (firebaseData.activeBowls?.length || 0) + 
                      (firebaseData.preparedBowls?.length || 0) + 
                      (firebaseData.returnedBowls?.length || 0);
    console.log(`✅ Merge completed: ${bowlsUpdated} bowls kept (local), ${bowlsAdded} bowls added from Firebase`);
    showMessage(`✅ Data merge complete: ${bowlsUpdated} local bowls preserved, ${bowlsAdded} cloud bowls added`, 'success');

    setTimeout(() => {
        console.log(`✅ Merge completed: ${bowlsUpdated} bowls kept (local), ${bowlsAdded} bowls added from Firebase`);
        showMessage(`✅ Data merge complete: ${bowlsUpdated} local bowls preserved, ${bowlsAdded} cloud bowls added`, 'success');
        
        if (progressElement) {
            progressElement.style.display = 'none';
        }
        
        cleanupIncompleteBowls();
        syncToFirebase();
        initializeUI();
        
    }, totalBowls * 100 + 3000);
    if (progressElement) {
        progressElement.style.display = 'none';
    }
    
    cleanupIncompleteBowls();
    syncToFirebase();
    initializeUI();
}

// Show merge progress
function updateMergeProgress(bowlType, current, total, updated, added) {
const progress = Math.round((current / total) * 100);
console.log(`📊 ${bowlType} bowls: ${current}/${total} (${progress}%) - Updated: ${updated}, Added: ${added}`);

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

// VYTAL URL DETECTION
function detectVytCode(input) {
if (!input || typeof input !== 'string') return null;

const cleanInput = input.trim();

if (cleanInput.includes('VYT.TO/') || cleanInput.includes('VYTAL')) {
return {
fullUrl: cleanInput,
type: cleanInput.includes('VYT.TO/') ? 'VYT.TO' : 'VYTAL'
};
}

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

document.getElementById('progloveInput').addEventListener('input', handleScanInput);
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

// ========== UPDATED JSON PROCESSING SECTION ==========

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
date: new Date().toLocaleDateString('en-GB'),
multipleCustomers: customer.multipleCustomers
};

window.appData.activeBowls.push(newBowl);
patchResults.created++;
}
});

// Update display and save
updateDisplay();
saveToStorage();
syncToFirebase();

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

// UPDATED Kitchen Scan - Remove from active and reset to Unknown
function kitchenScan(vytInfo) {
const startTime = Date.now();
const today = new Date().toLocaleDateString('en-GB');

// Check if already prepared today
const isPreparedToday = window.appData.preparedBowls.some(bowl => 
bowl.code === vytInfo.fullUrl && bowl.date === today
);

if (isPreparedToday) {
return { 
message: "❌ Already prepared today: " + vytInfo.fullUrl, 
type: "error",
responseTime: Date.now() - startTime
};
}

// STEP 1: Check if bowl exists in active bowls and REMOVE it
const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
let hadCustomerData = false;

if (activeBowlIndex !== -1) {
// Remove from active bowls (delete Customer A data)
window.appData.activeBowls.splice(activeBowlIndex, 1);
hadCustomerData = true;
console.log(`🗑️ Removed bowl from active with customer data: ${vytInfo.fullUrl}`);
}

const preparedBowl = {
code: vytInfo.fullUrl,
dish: window.appData.dishLetter,
user: window.appData.user,
// ✅ RESET to Unknown - Kitchen has no customer data
company: "Unknown", 
customer: "Unknown",
date: today,
time: new Date().toLocaleTimeString(),
timestamp: new Date().toISOString(),
status: 'PREPARED',
multipleCustomers: false,
hadPreviousCustomer: hadCustomerData // Track if it had previous customer data
};

// STEP 2: ADD to prepared bowls (today's preparation)
window.appData.preparedBowls.push(preparedBowl);

window.appData.myScans.push({
type: 'kitchen',
code: vytInfo.fullUrl,
dish: window.appData.dishLetter,
user: window.appData.user,
company: "Unknown", // RESET
customer: "Unknown", // RESET
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

saveToStorage();
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
// ✅ Already BLANK from prepared stage
company: "", // BLANK
customer: "", // BLANK
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
company: "", // BLANK
customer: "", // BLANK
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

saveToStorage();
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

// Overnight Statistics Table (10PM-10AM) - INCLUDES DISHES 1-4
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

// Export All Data to Excel with 3 sheets
function exportAllData() {
// Create workbook
const wb = XLSX.utils.book_new();

// Sheet 1: Active Bowls
const activeData = window.appData.activeBowls.map(bowl => ({
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
const wsActive = XLSX.utils.json_to_sheet(activeData);
XLSX.utils.book_append_sheet(wb, wsActive, 'Active Bowls');

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
'Status': bowl.status,
'Was In Active': bowl.wasInActive ? 'Yes' : 'No'
}));
const wsPrepared = XLSX.utils.json_to_sheet(preparedData);
XLSX.utils.book_append_sheet(wb, wsPrepared, 'Prepared Bowls');

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
const wsReturned = XLSX.utils.json_to_sheet(returnedData);
XLSX.utils.book_append_sheet(wb, wsReturned, 'Returned Bowls');

// Export the workbook
XLSX.writeFile(wb, 'complete_scanner_data.xlsx');
showMessage('✅ All data exported as Excel with 3 sheets', 'success');
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
