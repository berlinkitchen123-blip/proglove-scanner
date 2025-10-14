// scanner-core.js - Scanning Business Logic
class ScannerCore {
    // ==================== VYT CODE DETECTION ====================

    static detectVytCode(input) {
        if (!input) return null;
        const cleanInput = input.trim();
        if (cleanInput.includes('VYT.TO/') || cleanInput.includes('VYTAL')) {
            return { fullUrl: cleanInput };
        }
        return null;
    }

    // ==================== SCAN PROCESSING ====================

    static processScan(input, appData) {
        const vytInfo = this.detectVytCode(input);
        if (!vytInfo) {
            return {
                success: false,
                message: "❌ Invalid VYT code",
                error: 'INVALID_VYT_CODE'
            };
        }

        try {
            if (appData.mode === 'kitchen') {
                return this.processKitchenScan(vytInfo, appData);
            } else {
                return this.processReturnScan(vytInfo, appData);
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ ${error.message}`,
                error: error.message
            };
        }
    }

    static processKitchenScan(vytInfo, appData) {
        const today = new Date().toLocaleDateString('en-GB');
        
        // Check if already prepared today
        if (appData.preparedBowls.some(bowl => bowl.code === vytInfo.fullUrl && bowl.date === today)) {
            throw new Error('Already prepared today');
        }

        // Create new bowl object
        const newBowl = {
            code: vytInfo.fullUrl,
            dish: appData.dishLetter,
            user: appData.user,
            company: "",
            customer: "",
            date: today,
            time: new Date().toLocaleTimeString(),
            status: 'PREPARED',
            timestamp: Date.now()
        };

        return {
            success: true,
            message: `✅ ${appData.dishLetter} Prepared`,
            bowl: newBowl,
            action: 'PREPARED',
            removedFrom: this.findAndRemoveBowl(vytInfo.fullUrl, appData)
        };
    }

    static processReturnScan(vytInfo, appData) {
        const today = new Date().toLocaleDateString('en-GB');
        
        // Check active bowls first
        const activeBowlIndex = appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
        if (activeBowlIndex !== -1) {
            const bowl = appData.activeBowls[activeBowlIndex];
            const returnedBowl = {
                ...bowl,
                returnedBy: appData.user,
                returnDate: today,
                status: 'RETURNED',
                timestamp: Date.now()
            };

            return {
                success: true,
                message: "✅ Returned from customer",
                bowl: returnedBowl,
                action: 'RETURNED_FROM_ACTIVE',
                removedFrom: 'activeBowls'
            };
        }

        // Check prepared bowls
        const preparedBowlIndex = appData.preparedBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
        if (preparedBowlIndex !== -1) {
            const bowl = appData.preparedBowls[preparedBowlIndex];
            const returnedBowl = {
                ...bowl,
                returnedBy: appData.user,
                returnDate: today,
                status: 'RETURNED',
                timestamp: Date.now()
            };

            return {
                success: true,
                message: "✅ Returned from kitchen",
                bowl: returnedBowl,
                action: 'RETURNED_FROM_PREPARED',
                removedFrom: 'preparedBowls'
            };
        }

        throw new Error('Bowl not found in system');
    }

    // ==================== BOWL MANAGEMENT ====================

    static findAndRemoveBowl(bowlCode, appData) {
        const categories = ['activeBowls', 'returnedBowls'];
        let removedFrom = null;

        categories.forEach(category => {
            const index = appData[category].findIndex(bowl => bowl.code === bowlCode);
            if (index !== -1) {
                appData[category].splice(index, 1);
                removedFrom = category;
            }
        });

        return removedFrom;
    }

    // ==================== VALIDATION ====================

    static validateScanReady(appData) {
        if (!appData.user) {
            return { valid: false, message: 'Select user first' };
        }
        if (appData.mode === 'kitchen' && !appData.dishLetter) {
            return { valid: false, message: 'Select dish letter first' };
        }
        if (appData.scanning) {
            return { valid: false, message: 'Already scanning' };
        }
        return { valid: true, message: 'Ready to scan' };
    }

    // ==================== UTILITIES ====================

    static generateBowlId() {
        return 'bowl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    static sanitizeBowlCode(code) {
        return code.replace(/[\.\$#\[\]\/]/g, '_');
    }
}
