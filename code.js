// Additional utilities for ProGlove Scanner - FINAL VERSION
class ProGloveUtils {
  static validateVYTCode(code) {
    const vytRegex = /^(HTTP:\/\/VYT\.TO\/|VYT_)[A-Z0-9]+$/i;
    return vytRegex.test(code);
  }

  static generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

  static calculateStats(scans, mode) {
    const today = this.formatDate(new Date());
    const todayScans = scans.filter(scan => 
      this.formatDate(new Date(scan.timestamp)) === today
    );

    return {
      total: scans.length,
      today: todayScans.length,
      byType: todayScans.reduce((acc, scan) => {
        acc[scan.type] = (acc[scan.type] || 0) + 1;
        return acc;
      }, {}),
      byUser: todayScans.reduce((acc, scan) => {
        acc[scan.user] = (acc[scan.user] || 0) + 1;
        return acc;
      }, {})
    };
  }

  static exportData(appData) {
    const exportData = {
      timestamp: new Date().toISOString(),
      mode: appData.mode,
      user: appData.user,
      scans: appData.myScans,
      stats: this.calculateStats(appData.myScans, appData.mode)
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    return URL.createObjectURL(dataBlob);
  }
}

// Error types for better error handling
class ProGloveError extends Error {
  constructor(message, type, code) {
    super(message);
    this.name = 'ProGloveError';
    this.type = type;
    this.code = code;
  }
}

class SystemLockedError extends ProGloveError {
  constructor(lockedBy, lockTime) {
    super(`System locked by ${lockedBy}`, 'SYSTEM_LOCKED', 423);
    this.lockedBy = lockedBy;
    this.lockTime = lockTime;
  }
}

class ValidationError extends ProGloveError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
