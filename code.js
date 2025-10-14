// ProGlove Scanner - Simple Bowl Tracking
window.appData = {
    mode: null,
    user: null,
    dishLetter: null,
    scanning: false,
    activeBowls: [],      // Bowls with customers
    preparedBowls: [],    // Bowls in kitchen  
    returnedBowls: [],    // Bowls returned today
    scanHistory: []
};

// Users
const USERS = [
    {name: "Hamid", role: "Kitchen"}, {name: "Richa", role: "Kitchen"}, 
    {name: "Jash", role: "Kitchen"}, {name: "Joes", role: "Kitchen"},
    {name: "Mary", role: "Kitchen"}, {name: "Rushal", role: "Kitchen"},
    {name: "Sreekanth", role: "Kitchen"}, {name: "Sultan", role: "Return"},
    {name: "Riyaz", role: "Return"}, {name: "Alan", role: "Return"},
    {name: "Adesh", role: "Return"}
];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
    loadFromStorage();
    initializeUsers();
    updateDisplay();
    startDailyCleanupTimer();
    document.getElementById('progloveInput').addEventListener('input', handleScanInput);
});

// ==================== SCANNING LOGIC ====================

function processScan(input) {
    const vytInfo = detectVytCode(input);
    if (!vytInfo) {
        showMessage("❌ Invalid VYT code", "error");
        return;
    }

    if (window.appData.mode === 'kitchen') {
        kitchenScan(vytInfo);
    } else {
        returnScan(vytInfo);
    }
    
    updateDisplay();
    saveToStorage();
}

function kitchenScan(vytInfo) {
    const today = new Date().toLocaleDateString('en-GB');
    
    // Check if already prepared today
    if (window.appData.preparedBowls.some(bowl => bowl.code === vytInfo.fullUrl && bowl.date === today)) {
        showMessage("❌ Already prepared today", "error");
        return;
    }

    // Check if in activeBowls (reset data)
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    if (activeBowlIndex !== -1) {
        window.appData.activeBowls.splice(activeBowlIndex, 1);
    }

    // Check if in returnedBowls (remove for reuse)
    const returnedBowlIndex = window.appData.returnedBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    if (returnedBowlIndex !== -1) {
        window.appData.returnedBowls.splice(returnedBowlIndex, 1);
    }

    // Add to preparedBowls (fresh start)
    const newBowl = {
        code: vytInfo.fullUrl,
        dish: window.appData.dishLetter,
        user: window.appData.user,
        company: "",
        customer: "",
        date: today,
        time: new Date().toLocaleTimeString(),
        status: 'PREPARED'
    };

    window.appData.preparedBowls.push(newBowl);
    showMessage(`✅ ${window.appData.dishLetter} Prepared`, "success");
}

function returnScan(vytInfo) {
    const today = new Date().toLocaleDateString('en-GB');
    
    // Check if in activeBowls
    const activeBowlIndex = window.appData.activeBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    if (activeBowlIndex !== -1) {
        const bowl = window.appData.activeBowls[activeBowlIndex];
        window.appData.activeBowls.splice(activeBowlIndex, 1);
        window.appData.returnedBowls.push({
            ...bowl,
            returnedBy: window.appData.user,
            returnDate: today,
            status: 'RETURNED'
        });
        showMessage("✅ Returned from customer", "success");
        return;
    }

    // Check if in preparedBowls
    const preparedBowlIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === vytInfo.fullUrl);
    if (preparedBowlIndex !== -1) {
        const bowl = window.appData.preparedBowls[preparedBowlIndex];
        window.appData.preparedBowls.splice(preparedBowlIndex, 1);
        window.appData.returnedBowls.push({
            ...bowl,
            returnedBy: window.appData.user,
            returnDate: today,
            status: 'RETURNED'
        });
        showMessage("✅ Returned from kitchen", "success");
        return;
    }

    showMessage("❌ Bowl not found", "error");
}

// ==================== JSON PROCESSING ====================

function processJSONData() {
    const jsonText = document.getElementById('jsonData').value.trim();
    if (!jsonText) {
        showMessage('❌ Paste JSON first', 'error');
        return;
    }
    
    try {
        const jsonData = JSON.parse(jsonText);
        let movedBowls = 0;
        let createdBowls = 0;

        if (jsonData.boxes) {
            jsonData.boxes.forEach(box => {
                const company = box.uniqueIdentifier ? box.uniqueIdentifier.split('-').slice(2, -1).join(' ') : "";
                
                if (box.dishes) {
                    box.dishes.forEach(dish => {
                        if (dish.bowlCodes) {
                            dish.bowlCodes.forEach(bowlCode => {
                                const customers = dish.users ? dish.users.map(u => u.username).filter(Boolean).join(', ') : "";
                                
                                if (!company) {
                                    console.log(`❌ Skipping ${bowlCode} - No company name`);
                                    return;
                                }

                                // Check if in preparedBowls (move to active)
                                const preparedIndex = window.appData.preparedBowls.findIndex(bowl => bowl.code === bowlCode);
                                if (preparedIndex !== -1) {
                                    const bowl = window.appData.preparedBowls[preparedIndex];
                                    window.appData.preparedBowls.splice(preparedIndex, 1);
                                    
                                    window.appData.activeBowls.push({
                                        ...bowl,
                                        company: company,
                                        customer: customers,
                                        dish: dish.label || bowl.dish,
                                        status: 'ACTIVE',
                                        multipleCustomers: dish.users && dish.users.length > 1
                                    });
                                    movedBowls++;
                                    return;
                                }

                                // Create new in activeBowls if not exists
                                if (!window.appData.activeBowls.some(bowl => bowl.code === bowlCode) && 
                                    !window.appData.returnedBowls.some(bowl => bowl.code === bowlCode)) {
                                    
                                    window.appData.activeBowls.push({
                                        code: bowlCode,
                                        dish: dish.label || '',
                                        user: "JSON Import",
                                        company: company,
                                        customer: customers,
                                        date: new Date().toLocaleDateString('en-GB'),
                                        time: new Date().toLocaleTimeString(),
                                        status: 'ACTIVE',
                                        multipleCustomers: dish.users && dish.users.length > 1
                                    });
                                    createdBowls++;
                                }
                            });
                        }
                    });
                }
            });
        }

        updateDisplay();
        saveToStorage();
        showMessage(`✅ ${movedBowls} bowls moved to active, ${createdBowls} new bowls`, "success");
        
    } catch (error) {
        showMessage('❌ Invalid JSON', 'error');
    }
}

// ==================== SIMPLE UTILITIES ====================

function detectVytCode(input) {
    if (!input) return null;
    const cleanInput = input.trim();
    if (cleanInput.includes('VYT.TO/') || cleanInput.includes('VYTAL')) {
        return { fullUrl: cleanInput };
    }
    return null;
}

function startDailyCleanupTimer() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 19 && now.getMinutes() === 0) {
            window.appData.returnedBowls = [];
            saveToStorage();
            showMessage('✅ Return data cleared', 'success');
            updateDisplay();
        }
    }, 60000);
}

// ==================== UI FUNCTIONS ====================

function setMode(mode) {
    window.appData.mode = mode;
    window.appData.user = null;
    window.appData.dishLetter = null;
    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    loadUsers();
    updateDisplay();
    showMessage(`📱 ${mode.toUpperCase()} mode`, 'info');
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    window.appData.user = dropdown.value;
    if (window.appData.user && window.appData.mode === 'kitchen') {
        document.getElementById('dishSection').classList.remove('hidden');
        loadDishLetters();
    }
    updateDisplay();
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    window.appData.dishLetter = dropdown.value;
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
    showMessage(`🎯 Ready to scan`, 'success');
}

function stopScanning() {
    window.appData.scanning = false;
    updateDisplay();
}

function handleScanInput(e) {
    if (!window.appData.scanning) return;
    const scanValue = e.target.value.trim();
    if (scanValue.length >= 2) {
        processScan(scanValue);
        setTimeout(() => e.target.value = '', 100);
    }
}

function updateDisplay() {
    const today = new Date().toLocaleDateString('en-GB');
    const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today).length;
    const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today).length;
    
    document.getElementById('activeCount').textContent = window.appData.activeBowls.length;
    document.getElementById('prepCount').textContent = preparedToday;
    
    document.getElementById('startBtn').disabled = !window.appData.user || window.appData.scanning;
    document.getElementById('stopBtn').disabled = !window.appData.scanning;
    
    const input = document.getElementById('progloveInput');
    input.disabled = !window.appData.scanning;
    input.placeholder = window.appData.scanning ? "Scan VYT code..." : "Click START SCANNING...";
}

function showMessage(text, type) {
    const element = document.getElementById('feedback');
    element.textContent = text;
    element.className = 'feedback ' + type;
}

// ==================== STORAGE ====================

function saveToStorage() {
    localStorage.setItem('proglove_data', JSON.stringify(window.appData));
}

function loadFromStorage() {
    const saved = localStorage.getItem('proglove_data');
    if (saved) {
        window.appData = { ...window.appData, ...JSON.parse(saved) };
    }
}

// ==================== INIT ====================

function initializeUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    const usersToShow = USERS.filter(user => user.role === window.appData.mode);
    usersToShow.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    dropdown.innerHTML = '<option value="">-- Select Dish --</option>';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'.split('').forEach(letter => {
        const option = document.createElement('option');
        option.value = letter;
        option.textContent = letter;
        dropdown.appendChild(option);
    });
}

// Global functions
window.setMode = setMode;
window.selectUser = selectUser;
window.selectDishLetter = selectDishLetter;
window.startScanning = startScanning;
window.stopScanning = stopScanning;
window.processJSONData = processJSONData;
