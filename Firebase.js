// firebase-manager.js
class FirebaseManager {
    constructor() {
        this.initialized = false;
        this.database = null;
    }

    initialize() {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            this.database = firebase.database();
            this.initialized = true;
            console.log('✅ Firebase connected');
            return true;
        }
        console.log('⚠️ Firebase not available');
        return false;
    }

    // Real-time listeners
    startRealtimeListeners(onDataUpdate) {
        if (!this.initialized) return;

        ['activeBowls', 'preparedBowls', 'returnedBowls'].forEach(category => {
            this.database.ref(category).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && onDataUpdate) {
                    onDataUpdate(category, Object.values(data));
                }
            });
        });
    }

    // Data synchronization
    async syncAllData(activeBowls, preparedBowls, returnedBowls) {
        if (!this.initialized) return false;

        try {
            await this.database.ref('activeBowls').set(this.arrayToObject(activeBowls, 'code'));
            await this.database.ref('preparedBowls').set(this.arrayToObject(preparedBowls, 'code'));
            await this.database.ref('returnedBowls').set(this.arrayToObject(returnedBowls, 'code'));
            console.log('✅ All data synced to Firebase');
            return true;
        } catch (error) {
            console.error('❌ Firebase sync error:', error);
            return false;
        }
    }

    // Logging
    logScanSession(user, mode, dish, action) {
        this.logToFirebase('scanSessions', {
            user, mode, dish, action,
            timestamp: this.getTimestamp()
        });
    }

    logScanError(user, mode, scanInput, error) {
        this.logToFirebase('scanErrors', {
            user, mode, scanInput, error,
            timestamp: this.getTimestamp()
        });
    }

    // Utility methods
    logToFirebase(path, data) {
        if (!this.initialized) return;
        this.database.ref(path).push(data);
    }

    getTimestamp() {
        return this.initialized ? firebase.database.ServerValue.TIMESTAMP : new Date().getTime();
    }

    arrayToObject(array, keyField) {
        return array.reduce((obj, item) => {
            const key = item[keyField].replace(/[\.\$#\[\]\/]/g, '_');
            obj[key] = item;
            return obj;
        }, {});
    }

    isConnected() {
        return this.initialized;
    }
}
