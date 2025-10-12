// Firebase Configuration and Utilities

// Firebase Configuration - EDIT THIS IF NEEDED IN FUTURE
const firebaseConfig = {
    apiKey: "AIzaSyCL3hffCHosBceIRGR1it2dYEDb3uxIrJw",
    authDomain: "proglove-scanner.firebaseapp.com",
    databaseURL: "https://proglove-scanner-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "proglove-scanner",
    storageBucket: "proglove-scanner.firebasestorage.app",
    messagingSenderId: "177575768177",
    appId: "1:177575768177:web:0a0acbf222218e0c0b2bd0"
};

// Utility functions
class ProGloveUtils {
    static validateVYTCode(code) {
        const vytRegex = /^(HTTP:\/\/VYT\.TO\/|VYT_)[A-Z0-9]+$/i;
        return vytRegex.test(code);
    }

    static formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-GB');
    }

    static calculateUserStats(scans, user, dishLetter) {
        const today = this.formatDate(new Date());
        const userScans = scans.filter(scan => 
            scan.user === user && 
            this.formatDate(new Date(scan.timestamp)) === today
        );
        
        if (dishLetter) {
            return userScans.filter(scan => scan.dish === dishLetter).length;
        }
        
        return userScans.length;
    }
}

// Error handling
class ProGloveError extends Error {
    constructor(message, type, code) {
        super(message);
        this.name = 'ProGloveError';
        this.type = type;
        this.code = code;
    }
}

class ValidationError extends ProGloveError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR', 400);
    }
}

// Make utilities globally available
window.ProGloveUtils = ProGloveUtils;
window.ProGloveError = ProGloveError;
window.ValidationError = ValidationError;
window.firebaseConfig = firebaseConfig;
