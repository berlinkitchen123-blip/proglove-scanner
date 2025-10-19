// ProGlove Scanner - SIMPLIFIED Bowl Tracking System
window.appData = {
    mode: null,
    user: null,
    dishLetter: null,
    scanning: false,
    myScans: [],
    preparedBowls: [],
    returnedBowls: []
};

// SIMPLIFIED SCANNING SYSTEM
function processScan(input) {
    if (!window.appData.scanning) return;
    
    const scanValue = input.trim();
    console.log('🔍 Processing scan:', scanValue);
    
    // Extract VYT code (simple version)
    let vytCode = null;
    if (scanValue.includes('VYT.TO/')) {
        vytCode = scanValue.match(/VYT\.TO\/[A-Za-z0-9]+/)?.[0];
    } else if (scanValue.includes('VYTAL')) {
        vytCode = scanValue.match(/VYTAL[A-Za-z0-9]+/)?.[0];
    }
    
    if (!vytCode) {
        showMessage("❌ Invalid VYT code: " + scanValue, 'error');
        return;
    }
    
    if (window.appData.mode === 'kitchen') {
        kitchenScan(vytCode);
    } else {
        returnScan(vytCode);
    }
    
    // Clear input
    document.getElementById('progloveInput').value = '';
    updateDisplay();
}

// SIMPLIFIED KITCHEN SCAN
function kitchenScan(vytCode) {
    const today = getTodayStandard();
    
    // Check if already prepared today
    const alreadyPrepared = window.appData.preparedBowls.some(bowl => 
        bowl.code === vytCode && bowl.date === today
    );
    
    if (alreadyPrepared) {
        showMessage("❌ Already prepared today: " + vytCode, 'error');
        return;
    }
    
    // Add to prepared bowls
    const preparedBowl = {
        code: vytCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        date: today,
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
    };
    
    window.appData.preparedBowls.push(preparedBowl);
    
    // Add to scan history
    window.appData.myScans.push({
        type: 'kitchen',
        code: vytCode,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        timestamp: new Date().toISOString()
    });
    
    showMessage(`✅ ${window.appData.dishLetter} Prepared: ${vytCode}`, 'success');
    saveToStorage();
}

// SIMPLIFIED RETURN SCAN
function returnScan(vytCode) {
    const today = getTodayStandard();
    
    // Find in prepared bowls
    const preparedIndex = window.appData.preparedBowls.findIndex(bowl => 
        bowl.code === vytCode
    );
    
    if (preparedIndex === -1) {
        showMessage("❌ Bowl not found in prepared: " + vytCode, 'error');
        return;
    }
    
    // Remove from prepared and add to returned
    const returnedBowl = window.appData.preparedBowls[preparedIndex];
    window.appData.preparedBowls.splice(preparedIndex, 1);
    
    returnedBowl.returnedBy = window.appData.user;
    returnedBowl.returnDate = today;
    returnedBowl.returnTime = new Date().toLocaleTimeString();
    
    window.appData.returnedBowls.push(returnedBowl);
    
    // Add to scan history
    window.appData.myScans.push({
        type: 'return',
        code: vytCode,
        user: window.appData.user,
        timestamp: new Date().toISOString()
    });
    
    showMessage(`✅ Returned: ${vytCode}`, 'success');
    saveToStorage();
}

// SIMPLIFIED DISPLAY UPDATE
function updateDisplay() {
    const today = getTodayStandard();
    
    // Count prepared today
    const preparedToday = window.appData.preparedBowls.filter(bowl => 
        bowl.date === today
    ).length;
    
    // Count returned today
    const returnedToday = window.appData.returnedBowls.filter(bowl => 
        bowl.returnDate === today
    ).length;
    
    // Count my scans today
    let myScansToday = 0;
    if (window.appData.user) {
        myScansToday = window.appData.myScans.filter(scan => 
            scan.user === window.appData.user && 
            formatDateStandard(new Date(scan.timestamp)) === today
        ).length;
    }
    
    // Update display
    document.getElementById('prepCount').textContent = preparedToday;
    document.getElementById('myScansCount').textContent = myScansToday;
    
    if (window.appData.mode === 'return') {
        document.getElementById('prepCount').textContent = returnedToday;
    }
    
    // Update scanning status
    const input = document.getElementById('progloveInput');
    if (window.appData.scanning) {
        document.getElementById('scanSection').classList.add('scanning-active');
        input.placeholder = "Ready to scan...";
        input.disabled = false;
        input.focus();
    } else {
        document.getElementById('scanSection').classList.remove('scanning-active');
        input.placeholder = "Click START SCANNING...";
        input.disabled = true;
    }
}

// SIMPLIFIED STORAGE (Local storage only - remove Firebase complexity)
function saveToStorage() {
    try {
        localStorage.setItem('proglove_scanner_data', JSON.stringify({
            myScans: window.appData.myScans,
            preparedBowls: window.appData.preparedBowls,
            returnedBowls: window.appData.returnedBowls
        }));
    } catch (error) {
        console.log('Storage save note:', error.message);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('proglove_scanner_data');
        if (saved) {
            const data = JSON.parse(saved);
            window.appData.myScans = data.myScans || [];
            window.appData.preparedBowls = data.preparedBowls || [];
            window.appData.returnedBowls = data.returnedBowls || [];
        }
    } catch (error) {
        console.log('No previous data found');
    }
}

// SIMPLIFIED EXPORT
function exportAllData() {
    const today = getTodayStandard();
    
    const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today);
    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
    
    let csvContent = "Type,VYT Code,Dish,User,Time,Returned By,Return Time\n";
    
    // Add prepared bowls
    preparedToday.forEach(bowl => {
        csvContent += `Prepared,${bowl.code},${bowl.dish},${bowl.user},${bowl.time},,\n`;
    });
    
    // Add returned bowls
    returnedToday.forEach(bowl => {
        csvContent += `Returned,${bowl.code},${bowl.dish},${bowl.user},${bowl.time},${bowl.returnedBy},${bowl.returnTime}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bowl_data_${today}.csv`;
    a.click();
    
    showMessage(`✅ Exported: ${preparedToday.length} prepared, ${returnedToday.length} returned`, 'success');
}

// SIMPLIFIED RESET
function resetTodaysPreparedBowls() {
    if (!confirm('Reset ALL prepared bowls for today?')) return;
    
    const today = getTodayStandard();
    const initialCount = window.appData.preparedBowls.length;
    
    // Remove only today's prepared bowls
    window.appData.preparedBowls = window.appData.preparedBowls.filter(bowl => 
        bowl.date !== today
    );
    
    const removedCount = initialCount - window.appData.preparedBowls.length;
    
    saveToStorage();
    updateDisplay();
    showMessage(`✅ Reset ${removedCount} prepared bowls`, 'success');
}

// UTILITY FUNCTIONS
function getTodayStandard() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateStandard(date) {
    if (!date) return getTodayStandard();
    return new Date(date).toISOString().split('T')[0];
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// INITIALIZE
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    updateDisplay();
    
    // Simple input handler
    const progloveInput = document.getElementById('progloveInput');
    progloveInput.addEventListener('input', function(e) {
        if (window.appData.scanning && e.target.value.length >= 8) {
            processScan(e.target.value);
        }
    });
});

// Make functions available globally
window.startScanning = function() {
    if (!window.appData.user) {
        showMessage('❌ Select user first', 'error');
        return;
    }
    if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
        showMessage('❌ Select dish letter first', 'error');
        return;
    }
    
    window.appData.scanning = true;
    updateDisplay();
    showMessage('🎯 SCANNING ACTIVE', 'success');
};

window.stopScanning = function() {
    window.appData.scanning = false;
    updateDisplay();
    showMessage('⏹ Scanning stopped', 'info');
};

window.setMode = function(mode) {
    window.appData.mode = mode;
    window.appData.user = null;
    window.appData.dishLetter = null;
    window.appData.scanning = false;
    
    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    
    updateDisplay();
    showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
};

window.selectUser = function() {
    const dropdown = document.getElementById('userDropdown');
    window.appData.user = dropdown.value;
    if (window.appData.user) {
        showMessage(`✅ ${window.appData.user} selected`, 'success');
    }
    updateDisplay();
};

window.selectDishLetter = function() {
    const dropdown = document.getElementById('dishDropdown');
    window.appData.dishLetter = dropdown.value;
    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter} selected`, 'success');
    }
    updateDisplay();
};

window.exportAllData = exportAllData;
window.resetTodaysPreparedBowls = resetTodaysPreparedBowls;
