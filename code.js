// ProGlove Scanner - Complete System
window.appData = {
    mode: null, user: null, dishLetter: null, scanning: false,
    myScans: [], activeBowls: [], preparedBowls: [], returnedBowls: [],
    scanHistory: [], customerData: [], dishTimes: {},
    lastActivity: Date.now(), lastCleanup: null, lastSync: null
};

const USERS = [
    {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
    {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
];

function getStandardizedDate() {
    return new Date().toISOString().split('T')[0];
}

function isKitchenTime() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 10;
}

document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    initializeUsers();
    updateDisplay();
    updateOvernightStats();
    startDailyResetTimer();
    
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
    document.addEventListener('click', updateLastActivity);
    document.addEventListener('keydown', updateLastActivity);
    
    if (typeof initializeFirebase === 'function') initializeFirebase();
});

function updateLastActivity() {
    window.appData.lastActivity = Date.now();
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    const input = e.target;
    const scanValue = input.value.trim();
    
    if (scanValue.includes('vyt') || scanValue.includes('VYT')) {
        input.value = '';
        if (!window.appData.user) {
            showMessage('❌ Select user first', 'error');
            return;
        }
        if (window.appData.mode === 'kitchen' && !window.appData.dishLetter) {
            showMessage('❌ Select dish letter first', 'error');
            return;
        }
        processScan(scanValue);
    }
    updateLastActivity();
}

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
    showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
}

function updateStatsLabels() {
    const label = document.getElementById('prepLabel');
    if (label) label.textContent = window.appData.mode === 'kitchen' ? 'Prepared Today' : 'Returned Today';
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    const users = window.appData.mode === 'kitchen' ? 
        USERS.filter(u => u.role === 'Kitchen') : 
        USERS.filter(u => u.role === 'Return');
    users.forEach(user => {
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
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    dropdown.innerHTML = '<option value="">-- Select Dish Letter --</option>';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split('').forEach(char => {
        const option = document.createElement('option');
        option.value = char;
        option.textContent = char;
        dropdown.appendChild(option);
    });
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    window.appData.dishLetter = dropdown.value;
    if (window.appData.dishLetter) {
        showMessage(`📝 Dish ${window.appData.dishLetter}`, 'success');
    }
    updateDisplay();
}

function startScanning() {
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
    document.getElementById('progloveInput').focus();
    showMessage(`🎯 SCANNING ACTIVE`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
    showMessage(`⏹ Scanning stopped`, 'info');
}

function processScan(code) {
    let result;
    let actualMode = window.appData.mode;
    if (isKitchenTime()) actualMode = 'kitchen';
    
    try {
        result = actualMode === 'kitchen' ? kitchenScan(code) : returnScan(code);
    } catch (error) {
        result = { message: "System error", type: "error", responseTime: 0 };
    }
    
    document.getElementById('responseTimeValue').textContent = result.responseTime + 'ms';
    showMessage(result.message, result.type);
    
    if (result.type === 'error') {
        const input = document.getElementById('progloveInput');
        input.classList.add('error');
        setTimeout(() => input.classList.remove('error'), 2000);
    }
    
    updateDisplay();
    updateOvernightStats();
    return result;
}

function kitchenScan(code) {
    const startTime = Date.now();
    const today = getStandardizedDate();
    
    if (window.appData.preparedBowls.some(bowl => bowl.code === code && bowl.date === today)) {
        return { message: "❌ Already prepared: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    window.appData.activeBowls = window.appData.activeBowls.filter(bowl => bowl.code !== code);
    
    const newBowl = {
        code: code, dish: window.appData.dishLetter || "AUTO", user: window.appData.user,
        company: "Unknown", customer: "Unknown", date: today,
        time: new Date().toLocaleTimeString(), timestamp: new Date().toISOString(), status: 'PREPARED'
    };
    
    window.appData.preparedBowls.push(newBowl);
    window.appData.myScans.push({type: 'kitchen', code: code, dish: window.appData.dishLetter, user: window.appData.user, timestamp: new Date().toISOString()});
    
    if (typeof syncToFirebase === 'function') syncToFirebase();
    
    return { message: `✅ ${window.appData.dishLetter} Prepared: ${code}`, type: "success", responseTime: Date.now() - startTime };
}

function returnScan(code) {
    const startTime = Date.now();
    const today = getStandardizedDate();
    
    if (!window.appData.user) {
        return { message: "❌ Select user first", type: "error", responseTime: Date.now() - startTime };
    }
    
    if (window.appData.returnedBowls.some(bowl => bowl.code === code && bowl.returnDate === today)) {
        return { message: "❌ Already returned: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    let sourceBowl = null;
    let sourceType = '';
    const activeBefore = window.appData.activeBowls.length;
    
    const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === code);
    if (preparedIndex !== -1) {
        sourceBowl = window.appData.preparedBowls[preparedIndex];
        sourceType = 'prepared';
        window.appData.preparedBowls.splice(preparedIndex, 1);
    } else {
        const activeIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === code);
        if (activeIndex !== -1) {
            sourceBowl = window.appData.activeBowls[activeIndex];
            sourceType = 'active';
            window.appData.activeBowls.splice(activeIndex, 1);
        }
    }
    
    if (!sourceBowl) {
        return { message: "❌ Bowl not found: " + code, type: "error", responseTime: Date.now() - startTime };
    }
    
    const returnedBowl = {...sourceBowl, returnedBy: window.appData.user, returnDate: today,
        returnTime: new Date().toLocaleTimeString(), returnTimestamp: new Date().toISOString(), status: 'RETURNED', source: sourceType};
    
    window.appData.returnedBowls.push(returnedBowl);
    window.appData.myScans.push({type: 'return', code: code, user: window.appData.user, timestamp: new Date().toISOString()});
    
    const activeAfter = window.appData.activeBowls.length;
    const countChange = sourceType === 'active' ? ` (Active: ${activeBefore} → ${activeAfter})` : '';
    
    if (typeof syncToFirebase === 'function') syncToFirebase();
    
    return { message: `✅ Returned: ${code}${countChange}`, type: "success", responseTime: Date.now() - startTime };
}

function updateDishTimes(dishLetter, user) {
    const timeKey = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (!window.appData.dishTimes[dishLetter]) {
        window.appData.dishTimes[dishLetter] = {firstScan: timeKey, lastScan: timeKey, users: [user], count: 1};
    } else {
        window.appData.dishTimes[dishLetter].lastScan = timeKey;
        if (!window.appData.dishTimes[dishLetter].users.includes(user)) {
            window.appData.dishTimes[dishLetter].users.push(user);
        }
        window.appData.dishTimes[dishLetter].count++;
    }
}

function startDailyResetTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 22 && now.getMinutes() === 0) {
            resetDailyStatistics();
        }
    }, 60000);
}

function resetDailyStatistics() {
    const today = getStandardizedDate();
    if (window.appData.lastCleanup === today) return;
    
    const overnightPrepared = window.appData.preparedBowls.filter(bowl => {
        const hour = new Date(bowl.timestamp).getHours();
        return hour >= 22 || hour < 10;
    });
    
    overnightPrepared.forEach(bowl => {
        window.appData.activeBowls.push({...bowl, status: 'ACTIVE', preparedTimestamp: bowl.timestamp, timestamp: new Date().toISOString()});
    });
    
    window.appData.lastCleanup = today;
    if (typeof syncToFirebase === 'function') syncToFirebase();
    updateDisplay();
    showMessage('✅ Daily reset', 'success');
}

function updateDisplay() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const input = document.getElementById('progloveInput');
    const scanSection = document.getElementById('scanSection');
    
    const canScan = window.appData.user && !window.appData.scanning && 
                   (window.appData.mode !== 'kitchen' || window.appData.dishLetter);
    
    if (startBtn) startBtn.disabled = !canScan;
    if (stopBtn) stopBtn.disabled = !window.appData.scanning;
    
    if (input) {
        input.placeholder = window.appData.scanning ? "Scan VYT code..." : "Click START SCANNING...";
        input.disabled = !window.appData.scanning;
        if (scanSection) {
            scanSection.classList.toggle('scanning-active', window.appData.scanning);
        }
    }
    
    const today = getStandardizedDate();
    const userScans = window.appData.myScans.filter(scan => 
        scan.user === window.appData.user && getStandardizedDate(scan.timestamp) === today).length;
    const prepared = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returned = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
    
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;
    document.getElementById('prepCount').textContent = window.appData.mode === 'kitchen' ? prepared : returned;
    document.getElementById('myScansCount').textContent = userScans;
    document.getElementById('exportInfo').innerHTML = 
        `<strong>Data:</strong> Active: ${window.appData.activeBowls.length} | Prepared: ${prepared} | Returns: ${returned}`;
}

function updateOvernightStats() {
    try {
        const statsBody = document.getElementById('overnightStatsBody');
        const cycleInfo = document.getElementById('cycleInfo');
        if (!statsBody || !cycleInfo) return;
        
        const now = new Date();
        const hour = now.getHours();
        let cycleStart, cycleEnd, cycleText;
        
        if (hour >= 22 || hour < 10) {
            cycleStart = new Date(now); 
            if (hour < 10) cycleStart.setDate(cycleStart.getDate() - 1);
            cycleStart.setHours(22, 0, 0, 0);
            cycleEnd = new Date(now); cycleEnd.setDate(cycleEnd.getDate() + 1); cycleEnd.setHours(10, 0, 0, 0);
            cycleText = `Tonight 10PM - Tomorrow 10AM`;
        } else {
            cycleStart = new Date(now); cycleStart.setDate(cycleStart.getDate() - 1); cycleStart.setHours(22, 0, 0, 0);
            cycleEnd = new Date(now); cycleEnd.setHours(10, 0, 0, 0);
            cycleText = `Last Night 10PM - Today 10AM`;
        }
        
        cycleInfo.textContent = cycleText;
        const overnightScans = window.appData.myScans.filter(scan => {
            const scanTime = new Date(scan.timestamp);
            return scanTime >= cycleStart && scanTime <= cycleEnd;
        });
        
        const dishStats = {};
        overnightScans.forEach(scan => {
            const dish = scan.dish || "Unknown";
            const user = scan.user || "Unknown";
            const key = `${dish}-${user}`;
            if (!dishStats[key]) dishStats[key] = { dish: dish, user: user, count: 0, startTime: null, endTime: null };
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
            const dishA = a.dish || "Unknown";
            const dishB = b.dish || "Unknown";
            if (dishA !== dishB) return String(dishA).localeCompare(String(dishB));
            return new Date(a.startTime || now) - new Date(b.startTime || now);
        });
        
        let html = statsArray.length === 0 ? 
            '<tr><td colspan="5" style="text-align: center;">No overnight scans</td></tr>' :
            statsArray.map(stat => {
                const start = stat.startTime ? new Date(stat.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                const end = stat.endTime ? new Date(stat.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                return `<tr><td class="dish-header">${stat.dish}</td><td>${stat.user}</td><td>${stat.count}</td><td>${start}</td><td>${end}</td></tr>`;
            }).join('');
        statsBody.innerHTML = html;
    } catch (error) {}
}

function saveToStorage() {
    localStorage.setItem('proglove_data', JSON.stringify(window.appData));
}

function loadFromStorage() {
    const saved = localStorage.getItem('proglove_data');
    if (saved) window.appData = {...window.appData, ...JSON.parse(saved)};
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// Global functions
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.exportActiveBowls = exportActiveBowls;
window.exportReturnData = exportReturnData;
window.exportAllData = exportAllData;
