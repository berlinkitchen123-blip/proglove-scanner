// code.js - Main ProGlove Scanner Application
class ProGloveApp {
    constructor() {
        this.dataManager = new DataManager();
        this.firebaseManager = new FirebaseManager();
        this.uiManager = new UIManager();
        this.scannerCore = ScannerCore;
    }

    initialize() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeApp();
        });
    }

    async initializeApp() {
        try {
            // Initialize managers
            this.dataManager.loadFromStorage();
            this.uiManager.initialize();
            this.firebaseManager.initialize();
            
            // Setup Firebase real-time listeners
            this.setupFirebaseListeners();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update UI with current data
            this.uiManager.updateDisplay(this.dataManager.getAppData());
            
            // Start background tasks
            this.startDailyCleanupTimer();
            
            console.log('✅ ProGlove Scanner initialized successfully');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.uiManager.showError('App initialization failed');
        }
    }

    setupFirebaseListeners() {
        if (!this.firebaseManager.isConnected()) return;
        
        this.firebaseManager.startRealtimeListeners((category, data) => {
            // Update local data when Firebase changes
            switch (category) {
                case 'activeBowls':
                    this.dataManager.getAppData().activeBowls = data;
                    break;
                case 'preparedBowls':
                    this.dataManager.getAppData().preparedBowls = data;
                    break;
                case 'returnedBowls':
                    this.dataManager.getAppData().returnedBowls = data;
                    break;
            }
            
            this.dataManager.saveToStorage();
            this.uiManager.updateDisplay(this.dataManager.getAppData());
        });
    }

    setupEventListeners() {
        // Mode selection
        document.getElementById('kitchenBtn').addEventListener('click', () => this.setMode('kitchen'));
        document.getElementById('returnBtn').addEventListener('click', () => this.setMode('return'));
        
        // User and dish selection
        document.getElementById('userDropdown').addEventListener('change', () => this.selectUser());
        document.getElementById('dishDropdown').addEventListener('change', () => this.selectDishLetter());
        
        // Scanning controls
        document.getElementById('startBtn').addEventListener('click', () => this.startScanning());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopScanning());
        document.getElementById('progloveInput').addEventListener('input', (e) => this.handleScanInput(e));
        
        // JSON import
        document.getElementById('processJSONBtn').addEventListener('click', () => this.processJSONData());
        
        // Export functionality
        document.getElementById('exportBtn').addEventListener('click', () => this.handleExport());
        document.getElementById('clearDataBtn').addEventListener('click', () => this.handleClearData());
        
        // Statistics
        if (document.getElementById('showStatsBtn')) {
            document.getElementById('showStatsBtn').addEventListener('click', () => this.showStatistics());
        }
    }

    // ==================== MODE & USER MANAGEMENT ====================

    setMode(mode) {
        this.dataManager.setMode(mode);
        this.uiManager.loadUsers(mode);
        this.uiManager.updateModeDisplay(mode);
        this.uiManager.updateDisplay(this.dataManager.getAppData());
        this.uiManager.showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
    }

    selectUser() {
        const dropdown = document.getElementById('userDropdown');
        this.dataManager.setUser(dropdown.value);
        this.uiManager.updateUserDisplay(dropdown.value);
        this.uiManager.updateDisplay(this.dataManager.getAppData());
    }

    selectDishLetter() {
        const dropdown = document.getElementById('dishDropdown');
        this.dataManager.setDishLetter(dropdown.value);
        this.uiManager.updateDishDisplay(dropdown.value);
        this.uiManager.updateDisplay(this.dataManager.getAppData());
    }

    // ==================== SCANNING OPERATIONS ====================

    startScanning() {
        const validation = this.scannerCore.validateScanReady(this.dataManager.getAppData());
        if (!validation.valid) {
            this.uiManager.showError(validation.message);
            return;
        }
        
        this.dataManager.startScanning();
        this.uiManager.setScanningUI(true);
        
        // Log session start to Firebase
        this.firebaseManager.logScanSession(
            this.dataManager.getAppData().user,
            this.dataManager.getAppData().mode,
            this.dataManager.getAppData().dishLetter,
            'start'
        );
        
        this.uiManager.showSuccess(CONFIG.MESSAGES.SCAN_READY);
    }

    stopScanning() {
        this.dataManager.stopScanning();
        this.uiManager.setScanningUI(false);
        
        // Sync all data to Firebase when stopping
        this.syncToFirebase();
        
        // Log session end to Firebase
        this.firebaseManager.logScanSession(
            this.dataManager.getAppData().user,
            this.dataManager.getAppData().mode,
            this.dataManager.getAppData().dishLetter,
            'stop'
        );
        
        this.uiManager.showMessage(CONFIG.MESSAGES.SCAN_STOPPED, 'info');
    }

    handleScanInput(e) {
        if (!this.dataManager.isScanning()) return;
        
        const scanValue = e.target.value.trim();
        if (scanValue.length >= 2) {
            this.processScan(scanValue);
            setTimeout(() => e.target.value = '', 100);
        }
    }

    processScan(input) {
        const result = this.scannerCore.processScan(input, this.dataManager.getAppData());
        
        if (result.success) {
            // Update local data based on scan result
            this.handleSuccessfulScan(result);
            this.uiManager.showSuccess(result.message);
        } else {
            // Log error to Firebase
            this.firebaseManager.logScanError(
                this.dataManager.getAppData().user,
                this.dataManager.getAppData().mode,
                input,
                result.error
            );
            this.uiManager.showError(result.message);
        }
        
        this.dataManager.saveToStorage();
        this.uiManager.updateDisplay(this.dataManager.getAppData());
    }

    handleSuccessfulScan(result) {
        const appData = this.dataManager.getAppData();
        
        // Remove bowl from previous category if needed
        if (result.removedFrom) {
            this.dataManager.removeBowl(result.bowl.code, result.removedFrom);
        }
        
        // Add bowl to appropriate category
        if (result.action === 'PREPARED') {
            this.dataManager.addBowl(result.bowl, 'preparedBowls');
        } else if (result.action.includes('RETURNED')) {
            this.dataManager.addBowl(result.bowl, 'returnedBowls');
        }
        
        // Instantly sync to Firebase
        this.syncToFirebase();
        
        // Log successful scan
        if (this.firebaseManager.isConnected()) {
            this.firebaseManager.logToFirebase('scanHistory', {
                user: appData.user,
                mode: appData.mode,
                bowlCode: result.bowl.code,
                action: result.action,
                timestamp: this.firebaseManager.getTimestamp()
            });
        }
    }

    // ==================== FIREBASE SYNC ====================

    async syncToFirebase() {
        if (!this.firebaseManager.isConnected()) return;
        
        try {
            const success = await this.firebaseManager.syncAllData(
                this.dataManager.getActiveBowls(),
                this.dataManager.getPreparedBowls(),
                this.dataManager.getReturnedBowls()
            );
            
            if (success) {
                console.log('✅ Data synced to Firebase');
            }
        } catch (error) {
            console.error('❌ Firebase sync failed:', error);
        }
    }

    // ==================== JSON IMPORT ====================

    processJSONData() {
        const jsonText = this.uiManager.getJSONData();
        
        if (!jsonText) {
            this.uiManager.showError('Paste JSON first');
            return;
        }
        
        try {
            const result = JSONImporter.processJSONData(jsonText, this.dataManager.getAppData());
            this.dataManager.saveToStorage();
            this.syncToFirebase();
            this.uiManager.updateDisplay(this.dataManager.getAppData());
            this.uiManager.showSuccess(
                `${result.movedBowls} bowls moved to active, ${result.createdBowls} new bowls`
            );
        } catch (error) {
            this.uiManager.showError(error.message);
        }
    }

    // ==================== EXPORT FUNCTIONALITY ====================

    async handleExport() {
        const format = document.getElementById('exportFormat').value;
        const dataType = document.getElementById('exportDataType').value;
        
        try {
            const data = this.dataManager.getExportData(dataType);
            
            if (data.length === 0) {
                this.uiManager.showExportStatus('No data to export', 'error');
                return;
            }
            
            let count;
            if (format === 'excel') {
                count = await DataExporter.exportToExcel(data, dataType);
            } else if (format === 'csv') {
                count = DataExporter.exportToCSV(data, dataType);
            } else if (format === 'json') {
                count = DataExporter.exportToJSON(data, dataType);
            }
            
            this.uiManager.showExportStatus(`Exported ${count} records as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            this.uiManager.showExportStatus(`Export failed: ${error.message}`, 'error');
        }
    }

    handleClearData() {
        if (confirm('Are you sure you want to clear ALL data? This action cannot be undone.')) {
            this.dataManager.clearAllData();
            this.syncToFirebase();
            this.uiManager.updateDisplay(this.dataManager.getAppData());
            this.uiManager.showSuccess('All data cleared successfully');
        }
    }

    // ==================== STATISTICS ====================

    showStatistics() {
        const stats = Statistics.generateSummaryReport(this.dataManager.getAppData());
        this.uiManager.displayStatistics(stats);
    }

    // ==================== BACKGROUND TASKS ====================

    startDailyCleanupTimer() {
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === CONFIG.BUSINESS_DAYS.DAILY_CLEANUP_HOUR && now.getMinutes() === 0) {
                this.dataManager.clearReturnedBowls();
                this.syncToFirebase();
                this.uiManager.updateDisplay(this.dataManager.getAppData());
                this.uiManager.showSuccess('Return data cleared for the day');
            }
        }, 60000);
    }

    // ==================== UTILITY METHODS ====================

    getAppData() {
        return this.dataManager.getAppData();
    }
}

// Global functions for HTML onclick handlers
window.setMode = (mode) => app.setMode(mode);
window.selectUser = () => app.selectUser();
window.selectDishLetter = () => app.selectDishLetter();
window.startScanning = () => app.startScanning();
window.stopScanning = () => app.stopScanning();
window.processJSONData = () => app.processJSONData();

// Initialize the application
const app = new ProGloveApp();
app.initialize();
