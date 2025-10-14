// app.js - Main Application Coordinator with Existing Firebase

class ProGloveApp {
    constructor() {
        this.appData = {
            mode: null,
            user: null,
            dishLetter: null,
            scanning: false,
            activeBowls: [],
            preparedBowls: [],  
            returnedBowls: [],
            scanHistory: []
        };
        
        // Use your existing Firebase initialization
        this.firebaseInitialized = false;
        this.database = null;
    }

    initialize() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeFirebase(); // Use your existing Firebase init
            this.loadFromStorage();
            this.initializeUsers();
            this.setupEventListeners();
            this.updateDisplay();
            this.startDailyCleanupTimer();
        });
    }

    // ==================== FIREBASE INTEGRATION ====================

    initializeFirebase() {
        // Use your existing Firebase initialization from code.js
        // Assuming you already have firebase.initializeApp() in your code
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            this.database = firebase.database();
            this.firebaseInitialized = true;
            this.startFirebaseListeners();
            console.log('✅ Firebase connected from existing setup');
        } else {
            console.log('⚠️ Firebase not available - using offline mode');
        }
    }

    startFirebaseListeners() {
        if (!this.firebaseInitialized) return;

        // Listen for real-time updates from all users
        this.database.ref('activeBowls').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.appData.activeBowls = Object.values(data);
                this.updateDisplay();
                this.saveToStorage();
            }
        });

        this.database.ref('preparedBowls').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.appData.preparedBowls = Object.values(data);
                this.updateDisplay();
                this.saveToStorage();
            }
        });

        this.database.ref('returnedBowls').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.appData.returnedBowls = Object.values(data);
                this.updateDisplay();
                this.saveToStorage();
            }
        });
    }

    // ==================== SCANNING WITH FIREBASE ====================

    startScanning() {
        if (!this.appData.user) {
            this.showMessage('❌ Select user first', 'error');
            return;
        }
        if (this.appData.mode === 'kitchen' && !this.appData.dishLetter) {
            this.showMessage('❌ Select dish letter first', 'error');
            return;
        }
        
        this.appData.scanning = true;
        this.updateDisplay();
        document.getElementById('progloveInput').focus();
        
        // Log session start to Firebase
        this.logToFirebase('scanSessions', {
            user: this.appData.user,
            mode: this.appData.mode,
            dish: this.appData.dishLetter,
            action: 'start',
            timestamp: this.getFirebaseTimestamp()
        });
        
        this.showMessage(`🎯 Ready to scan - Live mode active`, 'success');
    }

    stopScanning() {
        this.appData.scanning = false;
        
        // Final sync to Firebase
        this.syncAllDataToFirebase();
        
        // Log session end to Firebase
        this.logToFirebase('scanSessions', {
            user: this.appData.user,
            mode: this.appData.mode,
            action: 'stop',
            timestamp: this.getFirebaseTimestamp()
        });
        
        this.updateDisplay();
        this.showMessage('📋 Scan session ended - Data synced to cloud', 'info');
    }

    processScan(input) {
        const vytInfo = this.detectVytCode(input);
        if (!vytInfo) {
            this.logScanError(input, 'Invalid VYT code');
            this.showMessage("❌ Invalid VYT code", "error");
            return;
        }

        try {
            if (this.appData.mode === 'kitchen') {
                this.kitchenScan(vytInfo);
            } else {
                this.returnScan(vytInfo);
            }
            
            this.updateDisplay();
            this.saveToStorage();
            
            // Instantly sync to Firebase for real-time updates
            this.syncAllDataToFirebase();
            
        } catch (error) {
            this.logScanError(input, error.message);
            this.showMessage(`❌ ${error.message}`, "error");
        }
    }

    kitchenScan(vytInfo) {
        const today = new Date().toLocaleDateString('en-GB');
        
        // Check if already prepared today
        if (this.appData.preparedBowls.some(bowl => bowl.code === vytInfo.fullUrl && bowl.date === today)) {
            throw new Error('Already prepared today');
        }

        // Remove from other categories
        this.removeBowlFromAllCategories(vytInfo.fullUrl);

        // Add to preparedBowls
        const newBowl = {
            code: vytInfo.fullUrl,
            dish: this.appData.dishLetter,
            user: this.appData.user,
            company: "",
            customer: "",
            date: today,
            time: new Date().toLocaleTimeString(),
            status: 'PREPARED',
            timestamp: this.getFirebaseTimestamp()
        };

        this.appData.preparedBowls.push(newBowl);
        this.showMessage(`✅ ${this.appData.dishLetter} Prepared`, "success");
    }

    returnScan(vytInfo) {
        const today = new Date().toLocaleDateString('en-GB');
        
        // Check if in activeBowls
        const activeBowlIndex = this.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
        if (activeBowlIndex !== -1) {
            const bowl = this.appData.activeBowls[activeBowlIndex];
            this.appData.activeBowls.splice(activeBowlIndex, 1);
            
            const returnedBowl = {
                ...bowl,
                returnedBy: this.appData.user,
                returnDate: today,
                status: 'RETURNED',
                timestamp: this.getFirebaseTimestamp()
            };
            
            this.appData.returnedBowls.push(returnedBowl);
            this.showMessage("✅ Returned from customer", "success");
            return;
        }

        // Check if in preparedBowls
        const preparedBowlIndex = this.appData.preparedBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
        if (preparedBowlIndex !== -1) {
            const bowl = this.appData.preparedBowls[preparedBowlIndex];
            this.appData.preparedBowls.splice(preparedBowlIndex, 1);
            
            const returnedBowl = {
                ...bowl,
                returnedBy: this.appData.user,
                returnDate: today,
                status: 'RETURNED',
                timestamp: this.getFirebaseTimestamp()
            };
            
            this.appData.returnedBowls.push(returnedBowl);
            this.showMessage("✅ Returned from kitchen", "success");
            return;
        }

        throw new Error('Bowl not found in system');
    }

    // ==================== FIREBASE DATA SYNC ====================

    syncAllDataToFirebase() {
        if (!this.firebaseInitialized) return;
        
        try {
            // Convert arrays to objects for Firebase
            const activeBowlsObj = this.arrayToObject(this.appData.activeBowls, 'code');
            const preparedBowlsObj = this.arrayToObject(this.appData.preparedBowls, 'code');
            const returnedBowlsObj = this.arrayToObject(this.appData.returnedBowls, 'code');
            
            // Update Firebase
            this.database.ref('activeBowls').set(activeBowlsObj);
            this.database.ref('preparedBowls').set(preparedBowlsObj);
            this.database.ref('returnedBowls').set(returnedBowlsObj);
            
            console.log('✅ Data synced to Firebase');
        } catch (error) {
            console.error('❌ Firebase sync error:', error);
        }
    }

    logScanError(scanInput, errorMessage) {
        this.logToFirebase('scanErrors', {
            user: this.appData.user,
            mode: this.appData.mode,
            scanInput: scanInput,
            error: errorMessage,
            timestamp: this.getFirebaseTimestamp()
        });
    }

    logToFirebase(path, data) {
        if (!this.firebaseInitialized) return;
        
        try {
            this.database.ref(path).push(data);
        } catch (error) {
            console.error('❌ Firebase log error:', error);
        }
    }

    getFirebaseTimestamp() {
        if (this.firebaseInitialized) {
            return firebase.database.ServerValue.TIMESTAMP;
        }
        return new Date().getTime();
    }

    // ==================== UTILITY FUNCTIONS ====================

    arrayToObject(array, keyField) {
        return array.reduce((obj, item) => {
            const key = item[keyField].replace(/[\.\$#\[\]\/]/g, '_');
            obj[key] = item;
            return obj;
        }, {});
    }

    removeBowlFromAllCategories(bowlCode) {
        // Remove from activeBowls
        const activeIndex = this.appData.activeBowls.findIndex(bowl => bowl.code === bowlCode);
        if (activeIndex !== -1) {
            this.appData.activeBowls.splice(activeIndex, 1);
        }

        // Remove from returnedBowls
        const returnedIndex = this.appData.returnedBowls.findIndex(bowl => bowl.code === bowlCode);
        if (returnedIndex !== -1) {
            this.appData.returnedBowls.splice(returnedIndex, 1);
        }
    }

    detectVytCode(input) {
        if (!input) return null;
        const cleanInput = input.trim();
        if (cleanInput.includes('VYT.TO/') || cleanInput.includes('VYTAL')) {
            return { fullUrl: cleanInput };
        }
        return null;
    }

    // ==================== EXISTING FUNCTIONALITY ====================

    setMode(mode) {
        this.appData.mode = mode;
        this.appData.user = null;
        this.appData.dishLetter = null;
        
        document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
        document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
        document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
        
        this.loadUsers();
        this.updateDisplay();
        this.showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
    }

    initializeUsers() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        USERS.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            dropdown.appendChild(option);
        });
    }

    loadUsers() {
        const dropdown = document.getElementById('userDropdown');
        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        const usersToShow = USERS.filter(user => user.role === this.appData.mode);
        usersToShow.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            dropdown.appendChild(option);
        });
    }

    selectUser() {
        const dropdown = document.getElementById('userDropdown');
        this.appData.user = dropdown.value;
        
        if (this.appData.user && this.appData.mode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            this.loadDishLetters();
        }
        this.updateDisplay();
    }

    loadDishLetters() {
        const dropdown = document.getElementById('dishDropdown');
        dropdown.innerHTML = '<option value="">-- Select Dish --</option>';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split('').forEach(letter => {
            const option = document.createElement('option');
            option.value = letter;
            option.textContent = letter;
            dropdown.appendChild(option);
        });
    }

    selectDishLetter() {
        const dropdown = document.getElementById('dishDropdown');
        this.appData.dishLetter = dropdown.value;
        this.updateDisplay();
    }

    updateDisplay() {
        const today = new Date().toLocaleDateString('en-GB');
        const preparedToday = this.appData.preparedBowls.filter(bowl => bowl.date === today).length;
        
        document.getElementById('activeCount').textContent = this.appData.activeBowls.length;
        document.getElementById('prepCount').textContent = preparedToday;
        
        document.getElementById('startBtn').disabled = !this.appData.user || this.appData.scanning;
        document.getElementById('stopBtn').disabled = !this.appData.scanning;
        
        const input = document.getElementById('progloveInput');
        input.disabled = !this.appData.scanning;
        input.placeholder = this.appData.scanning ? "Scan VYT code..." : "Click START SCANNING...";
    }

    showMessage(text, type) {
        const element = document.getElementById('feedback');
        element.textContent = text;
        element.className = 'feedback ' + type;
    }

    saveToStorage() {
        localStorage.setItem('proglove_data', JSON.stringify(this.appData));
    }

    loadFromStorage() {
        const saved = localStorage.getItem('proglove_data');
        if (saved) {
            this.appData = { ...this.appData, ...JSON.parse(saved) };
        }
    }

    startDailyCleanupTimer() {
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 19 && now.getMinutes() === 0) {
                this.appData.returnedBowls = [];
                this.saveToStorage();
                this.syncAllDataToFirebase();
                this.showMessage('✅ Return data cleared', 'success');
                this.updateDisplay();
            }
        }, 60000);
    }

    // JSON Import, Export, and other methods remain the same as before
    processJSONData() { /* your existing JSON code */ }
    handleExport() { /* your existing export code */ }
    handleClearData() { /* your existing clear data code */ }

    setupEventListeners() {
        document.getElementById('kitchenBtn').addEventListener('click', () => this.setMode('kitchen'));
        document.getElementById('returnBtn').addEventListener('click', () => this.setMode('return'));
        document.getElementById('userDropdown').addEventListener('change', () => this.selectUser());
        document.getElementById('dishDropdown').addEventListener('change', () => this.selectDishLetter());
        document.getElementById('startBtn').addEventListener('click', () => this.startScanning());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopScanning());
        document.getElementById('progloveInput').addEventListener('input', (e) => this.handleScanInput(e));
        document.getElementById('processJSONBtn').addEventListener('click', () => this.processJSONData());
        document.getElementById('exportBtn').addEventListener('click', () => this.handleExport());
        document.getElementById('clearDataBtn').addEventListener('click', () => this.handleClearData());
    }
}

// Your existing USERS array
const USERS = [
    {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
    {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
];

// Global functions for HTML
window.setMode = (mode) => app.setMode(mode);
window.selectUser = () => app.selectUser();
window.selectDishLetter = () => app.selectDishLetter();
window.startScanning = () => app.startScanning();
window.stopScanning = () => app.stopScanning();
window.processJSONData = () => app.processJSONData();

// Initialize
const app = new ProGloveApp();
app.initialize();
