// data-manager.js - Data Storage & Management
class DataManager {
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
    }

    // ==================== MODE & USER MANAGEMENT ====================

    setMode(mode) {
        this.appData.mode = mode;
        this.appData.user = null;
        this.appData.dishLetter = null;
        return this.appData;
    }

    setUser(user) {
        this.appData.user = user;
        return this.appData;
    }

    setDishLetter(dishLetter) {
        this.appData.dishLetter = dishLetter;
        return this.appData;
    }

    // ==================== SCANNING STATE ====================

    startScanning() {
        this.appData.scanning = true;
        return this.appData;
    }

    stopScanning() {
        this.appData.scanning = false;
        return this.appData;
    }

    isScanning() {
        return this.appData.scanning;
    }

    canStartScanning() {
        if (!this.appData.user) return false;
        if (this.appData.mode === 'kitchen' && !this.appData.dishLetter) return false;
        return true;
    }

    // ==================== BOWL MANAGEMENT ====================

    addBowl(bowl, category) {
        this.appData[category].push(bowl);
        return bowl;
    }

    removeBowl(bowlCode, category) {
        const index = this.appData[category].findIndex(bowl => bowl.code === bowlCode);
        if (index !== -1) {
            return this.appData[category].splice(index, 1)[0];
        }
        return null;
    }

    findBowl(bowlCode) {
        const categories = ['activeBowls', 'preparedBowls', 'returnedBowls'];
        for (const category of categories) {
            const bowl = this.appData[category].find(bowl => bowl.code === bowlCode);
            if (bowl) return { bowl, category };
        }
        return null;
    }

    removeBowlFromAllCategories(bowlCode) {
        const categories = ['activeBowls', 'preparedBowls', 'returnedBowls'];
        categories.forEach(category => {
            this.removeBowl(bowlCode, category);
        });
    }

    // ==================== DATA QUERIES ====================

    getTodaysPreparedBowls() {
        const today = new Date().toLocaleDateString('en-GB');
        return this.appData.preparedBowls.filter(bowl => bowl.date === today);
    }

    getTodaysReturnedBowls() {
        const today = new Date().toLocaleDateString('en-GB');
        return this.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    }

    getExportData(dataType) {
        const today = new Date().toLocaleDateString('en-GB');
        
        switch (dataType) {
            case 'active':
                return this.appData.activeBowls;
            case 'prepared':
                return this.getTodaysPreparedBowls();
            case 'returned':
                return this.getTodaysReturnedBowls();
            case 'today':
                return [
                    ...this.getTodaysPreparedBowls(),
                    ...this.getTodaysReturnedBowls()
                ];
            case 'all':
            default:
                return [
                    ...this.appData.activeBowls,
                    ...this.appData.preparedBowls,
                    ...this.appData.returnedBowls
                ];
        }
    }

    // ==================== STORAGE MANAGEMENT ====================

    saveToStorage() {
        try {
            localStorage.setItem('proglove_data', JSON.stringify(this.appData));
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            return false;
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('proglove_data');
            if (saved) {
                this.appData = { ...this.appData, ...JSON.parse(saved) };
            }
            return this.appData;
        } catch (error) {
            console.error('Storage load error:', error);
            return this.appData;
        }
    }

    clearAllData() {
        this.appData.activeBowls = [];
        this.appData.preparedBowls = [];
        this.appData.returnedBowls = [];
        this.appData.scanHistory = [];
        this.saveToStorage();
        return this.appData;
    }

    clearReturnedBowls() {
        this.appData.returnedBowls = [];
        this.saveToStorage();
        return this.appData;
    }

    // ==================== DATA ACCESS ====================

    getAppData() {
        return this.appData;
    }

    getActiveBowls() {
        return this.appData.activeBowls;
    }

    getPreparedBowls() {
        return this.appData.preparedBowls;
    }

    getReturnedBowls() {
        return this.appData.returnedBowls;
    }

    getStats() {
        const today = new Date().toLocaleDateString('en-GB');
        return {
            active: this.appData.activeBowls.length,
            preparedToday: this.getTodaysPreparedBowls().length,
            returnedToday: this.getTodaysReturnedBowls().length,
            totalScans: this.appData.scanHistory.length
        };
    }
}
