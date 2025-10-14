// config.js - Configuration & Constants
const CONFIG = {
    USERS: [
        {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
        {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"},
        {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"},
        {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"},
        {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"},
        {name: "Adesh", role: "Return"}
    ],

    DISH_LETTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split(''),

    FIREBASE_PATHS: {
        ACTIVE: 'activeBowls',
        PREPARED: 'preparedBowls',
        RETURNED: 'returnedBowls',
        SESSIONS: 'scanSessions',
        ERRORS: 'scanErrors',
        HISTORY: 'scanHistory'
    },

    COLOR_CODING: {
        DAYS_ACTIVE: {
            3: '#FFD700', // Yellow
            4: '#FF69B4', // Pink  
            5: '#FFA500', // Orange
            6: '#FF0000'  // Red
        },
        CUSTOMERS: {
            SINGLE: '#008000', // Green
            MULTIPLE: '#FF0000' // Red
        }
    },

    BUSINESS_DAYS: {
        WEEKEND_DAYS: [0, 6], // Sunday, Saturday
        DAILY_CLEANUP_HOUR: 19 // 7 PM
    },

    STORAGE_KEYS: {
        MAIN_DATA: 'proglove_data',
        SETTINGS: 'proglove_settings'
    },

    MESSAGES: {
        SCAN_READY: '🎯 Ready to scan',
        SCAN_STOPPED: '📋 Scan session ended',
        FIREBASE_CONNECTED: '✅ Connected to cloud',
        FIREBASE_OFFLINE: '⚠️ Offline mode'
    }
};
