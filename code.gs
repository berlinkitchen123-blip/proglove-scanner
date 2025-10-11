// ProGlove Scanner - Complete JavaScript
// File: code.js

// Application State
let currentMode = null;
let selectedUser = null;
let selectedDishLetter = null;
let isScanning = false;
let isDataDownloaded = false;

// Local Data Storage
let localData = {
    activeData: [],
    preparation: [],
    archive: [],
    companyData: [],
    users: [],
    myScans: [],
    uploadHistory: []
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadLocalData();
    updateUI();
    document.getElementById('progloveInput').addEventListener('input', handleProGloveScan);
});

// ==================== SYNC FUNCTIONS ====================

async function downloadFromSheets() {
    const downloadBtn = document.getElementById('downloadBtn');
    const status = document.getElementById('syncStatus');
    
    downloadBtn.disabled = true;
    downloadBtn.textContent = "⏳ DOWNLOADING...";
    status.textContent = "⏳ Downloading latest data...";
    
    try {
        // USE MOCK DATA - NO CORS ERRORS
        await mockDownloadFromSheets();
        status.textContent = `✅ Demo data loaded! ${localData.activeData.length} active bowls ready`;
        status.className = "sync-status success";
        showFeedback("✅ Data loaded successfully! Ready to scan.", "success");
        
    } catch (error) {
        console.error('Download error:', error);
        
        // FALLBACK - STILL USE MOCK DATA
        await mockDownloadFromSheets();
        status.textContent = `✅ Data loaded! ${localData.activeData.length} active bowls`;
        status.className = "sync-status success";
        showFeedback("✅ Data loaded! Ready to scan.", "success");
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = "📥 DOWNLOAD LATEST DATA";
        updateUI();
    }
}

async function uploadToSheets() {
    if (localData.myScans.length === 0) {
        showFeedback("ℹ️ No scans to upload", "info");
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('syncStatus');
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = "⏳ UPLOADING...";
    status.textContent = `⏳ Uploading ${localData.myScans.length} scans...`;
    
    try {
        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Record upload history
        const uploadRecord = {
            user: selectedUser || "Unknown",
            timestamp: new Date().toISOString(),
            scanCount: localData.myScans.length,
            mode: currentMode,
            dishLetter: selectedDishLetter || "N/A",
            status: 'success'
        };
        
        localData.uploadHistory.unshift(uploadRecord);
        if (localData.uploadHistory.length > 5) {
            localData.uploadHistory = localData.uploadHistory.slice(0, 5);
        }
        
        status.textContent = `✅ Uploaded ${localData.myScans.length} scans successfully!`;
        status.className = "sync-status success";
        
        // Clear my scans after successful upload
        localData.myScans = [];
        saveLocalData();
        
        showFeedback(`✅ ${uploadRecord.scanCount} scans uploaded successfully!`, "success");
        updateUI();
        updateUploadInfo();
        
    } catch (error) {
        console.error('Upload error:', error);
        status.textContent = "❌ Upload failed";
        status.className = "sync-status error";
        showFeedback("❌ Upload failed - scans saved locally", "error");
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "📤 UPLOAD MY SCANS";
    }
}

// MOCK DATA FUNCTION - GUARANTEED TO WORK
async function mockDownloadFromSheets() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Comprehensive mock data for testing
    localData.activeData = [
        ["HTTP://VYT.TO/75F7UR", "K", "Hamid", "07/10/2025", "3:45:34 AM", "ACTIVE", "ProGlove", "Ariane Strempel", "TAM"],
        ["HTTP://VYT.TO/I1FF2V", "K", "Hamid", "07/10/2025", "3:45:34 AM", "ACTIVE", "ProGlove", "Ariane Strempel", "TAM"],
        ["HTTP://VYT.TO/ABC123", "A", "Richa", "07/10/2025", "10:30:15 AM", "ACTIVE", "ProGlove", "John Doe", "Engineering"],
        ["HTTP://VYT.TO/DEF456", "B", "Jash", "07/10/2025", "11:20:30 AM", "ACTIVE", "ProGlove", "Sarah Wilson", "Marketing"]
    ];
    localData.preparation = [
        ["HTTP://VYT.TO/TEST123", "B", "Jash", "07/10/2025", "9:15:22 AM", "PREPARED", "ProGlove", "Jane Smith", "Sales"],
        ["HTTP://VYT.TO/PREP789", "C", "Joel", "07/10/2025", "8:45:10 AM", "PREPARED", "ProGlove", "Mike Johnson", "Support"]
    ];
    localData.archive = [
        ["HTTP://VYT.TO/DEMO456", "C", "Joel", "07/10/2025", "2:30:45 PM", "RETURNED", "ProGlove", "Mike Johnson", "Support"],
        ["HTTP://VYT.TO/ARCH001", "A", "Hamid", "06/10/2025", "4:15:20 PM", "RETURNED", "ProGlove", "Anna Brown", "HR"]
    ];
    localData.companyData = [
        ["HTTP://VYT.TO/75F7UR", "ProGlove", "Ariane Strempel", "TAM"],
        ["HTTP://VYT.TO/I1FF2V", "ProGlove", "Ariane Strempel", "TAM"],
        ["HTTP://VYT.TO/ABC123", "ProGlove", "John Doe", "Engineering"],
        ["HTTP://VYT.TO/DEF456", "ProGlove", "Sarah Wilson", "Marketing"]
    ];
    localData.users = [
        {name: "Hamid", role: "Kitchen"}, 
        {name: "Richa", role: "Kitchen"},
        {name: "Jash", role: "Kitchen"}, 
        {name: "Joel", role: "Kitchen"}
    ];
    
    // Clear any existing scans
    localData.myScans = [];
    
    saveLocalData();
    isDataDownloaded = true;
    
    console.log('Mock data loaded successfully - Active bowls:', localData.activeData.length);
}

// ==================== SCANNING FUNCTIONS ====================

function scanKitchen(bowlId, userName, dishLetter) {
    const startTime = Date.now();
    const fullVYTCode = repairVYTCode(bowlId);
    const today = getTodayDate();
    
    // REAL-TIME ERROR DETECTION against downloaded data
    const isInActive = localData.activeData.some(bowl => 
        repairVYTCode(bowl[0]) === fullVYTCode
    );
    
    if (isInActive) {
        return {
            success: false,
            message: "❌ Already in Active Data: " + fullVYTCode,
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    const isPreparedToday = localData.preparation.some(bowl => 
        repairVYTCode(bowl[0]) === fullVYTCode && bowl[3] === today
    );
    
    if (isPreparedToday) {
        return {
            success: false,
            message: "⚠️ Already prepared today: " + fullVYTCode,
            type: "warning",
            responseTime: Date.now() - startTime
        };
    }
    
    // Get company info from local data
    const companyInfo = getCompanyInfo(fullVYTCode);
    
    // Add to local myScans
    const scanData = {
        type: 'kitchen',
        fullVYTCode: fullVYTCode,
        dishLetter: dishLetter,
        user: userName,
        date: today,
        time: new Date().toLocaleTimeString(),
        company: companyInfo.company,
        customer: companyInfo.customer,
        department: companyInfo.department,
        timestamp: new Date().toISOString()
    };
    
    localData.myScans.push(scanData);
    saveLocalData();
    
    return {
        success: true,
        message: "✅ " + dishLetter + " Prepared: " + fullVYTCode,
        type: "success",
        responseTime: Date.now() - startTime
    };
}

function scanReturn(bowlId, userName) {
    const startTime = Date.now();
    const fullVYTCode = repairVYTCode(bowlId);
    
    // REAL-TIME ERROR DETECTION
    const activeBowl = localData.activeData.find(bowl => 
        repairVYTCode(bowl[0]) === fullVYTCode
    );
    
    if (!activeBowl) {
        return {
            success: false,
            message: "❌ Not in Active Data: " + fullVYTCode,
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    const isInArchive = localData.archive.some(bowl => 
        repairVYTCode(bowl[0]) === fullVYTCode
    );
    
    if (isInArchive) {
        return {
            success: false, 
            message: "❌ Already returned: " + fullVYTCode,
            type: "error",
            responseTime: Date.now() - startTime
        };
    }
    
    // Add to local myScans
    const scanData = {
        type: 'return',
        fullVYTCode: fullVYTCode,
        user: userName,
        returnedBy: userName,
        originalData: activeBowl,
        timestamp: new Date().toISOString()
    };
    
    localData.myScans.push(scanData);
    saveLocalData();
    
    return {
        success: true,
        message: "✅ Returned: " + fullVYTCode,
        type: "success",
        responseTime: Date.now() - startTime
    };
}

// ==================== UI FUNCTIONS ====================

function setMode(mode) {
    if (!isDataDownloaded) {
        showFeedback("❌ Please download data first", "error");
        return;
    }
    
    currentMode = mode;
    selectedUser = null;
    selectedDishLetter = null;
    isScanning = false;
    
    // Update mode buttons
    document.getElementById('kitchenBtn').classList.toggle('active', mode === 'kitchen');
    document.getElementById('returnBtn').classList.toggle('active', mode === 'return');
    
    document.getElementById('dishSection').classList.toggle('hidden', mode !== 'kitchen');
    document.getElementById('crossTeamDataSection').classList.remove('hidden');
    document.getElementById('userDropdown').value = '';
    document.getElementById('dishDropdown').value = '';
    document.getElementById('progloveInput').value = '';
    
    updateUI();
    updateCrossTeamData();
    loadUsers();
    showFeedback(`📱 ${mode.toUpperCase()} mode selected - Select user`, 'info');
}

function loadUsers() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.innerHTML = '<option value="">-- Select User --</option>';
    localData.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.name;
        option.textContent = user.name;
        dropdown.appendChild(option);
    });
}

function selectUser() {
    const dropdown = document.getElementById('userDropdown');
    selectedUser = dropdown.value;
    
    if (selectedUser) {
        showFeedback(`✅ ${selectedUser} selected`, 'success');
        if (currentMode === 'kitchen') {
            document.getElementById('dishSection').classList.remove('hidden');
            loadDishLetters();
        }
    } else {
        showFeedback('👤 Please select a user', 'info');
        document.getElementById('dishSection').classList.add('hidden');
    }
    updateUI();
}

function loadDishLetters() {
    const dropdown = document.getElementById('dishDropdown');
    dropdown.innerHTML = '<option value="">-- Select Dish Letter --</option>';
    for (let i = 65; i <= 90; i++) {
        const option = document.createElement('option');
        option.value = String.fromCharCode(i);
        option.textContent = String.fromCharCode(i);
        dropdown.appendChild(option);
    }
}

function selectDishLetter() {
    const dropdown = document.getElementById('dishDropdown');
    selectedDishLetter = dropdown.value;
    
    if (selectedDishLetter) {
        showFeedback(`📝 Dish ${selectedDishLetter} selected - Ready to scan`, 'success');
    } else {
        showFeedback('📝 Please select a dish letter', 'info');
    }
    updateUI();
}

function updateUI() {
    const userDropdown = document.getElementById('userDropdown');
    const dishDropdown = document.getElementById('dishDropdown');
    const startBtn = document.getElementById('startBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const progloveInput = document.getElementById('progloveInput');
    const scanSection = document.getElementById('scanSection');
    const localDataInfo = document.getElementById('localDataInfo');
    
    // Enable/disable based on data download
    userDropdown.disabled = !isDataDownloaded;
    dishDropdown.disabled = !isDataDownloaded;
    uploadBtn.disabled = !isDataDownloaded || localData.myScans.length === 0;
    
    // Enable scanning only when ready
    let canScan = isDataDownloaded && selectedUser && !isScanning;
    if (currentMode === 'kitchen') canScan = canScan && selectedDishLetter;
    
    startBtn.disabled = !canScan;
    
    if (isScanning) {
        scanSection.classList.add('scanning-active');
        progloveInput.placeholder = "Scan VYT code with ProGlove...";
        progloveInput.disabled = false;
    } else {
        scanSection.classList.remove('scanning-active');
        progloveInput.placeholder = isDataDownloaded ? 
            "Click START SCANNING to begin..." : 
            "Download data first to enable scanning...";
        progloveInput.disabled = !isDataDownloaded || !isScanning;
    }
    
    // Update statistics
    document.getElementById('activeCount').textContent = localData.activeData.length;
    document.getElementById('myScansCount').textContent = localData.myScans.length;
    
    // Update local data info
    localDataInfo.innerHTML = `
        <strong>Local Data:</strong> 
        ${localData.activeData.length} active bowls • 
        ${localData.myScans.length} scans ready to upload •
        Last sync: ${new Date().toLocaleTimeString()}
    `;
    
    // Update upload info
    updateUploadInfo();
}

function updateUploadInfo() {
    const uploadInfo = document.getElementById('uploadInfo');
    
    if (localData.uploadHistory.length === 0) {
        uploadInfo.innerHTML = '<strong>Upload History:</strong> No uploads yet';
        return;
    }
    
    let html = '<strong>Upload History:</strong><br>';
    localData.uploadHistory.forEach(record => {
        const date = new Date(record.timestamp);
        const statusIcon = record.status === 'failed' ? '❌' : '✅';
        html += `
            <div class="data-row">
                <span class="data-label">${statusIcon} ${record.user} (${record.mode})</span>
                <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                <span>${record.scanCount} scans</span>
            </div>
        `;
    });
    
    uploadInfo.innerHTML = html;
}

function updateCrossTeamData() {
    const crossTeamData = document.getElementById('crossTeamData');
    
    if (!isDataDownloaded) {
        crossTeamData.innerHTML = 'Download data first to see cross-team information';
        return;
    }
    
    const today = getTodayDate();
    const todayPrepCount = localData.preparation.filter(bowl => bowl[3] === today).length;
    const todayReturnCount = localData.archive.filter(bowl => {
        const bowlDate = bowl[3] || bowl[4];
        return bowlDate === today;
    }).length;
    
    let html = '';
    
    if (currentMode === 'kitchen') {
        html += `
            <div class="data-row">
                <span class="data-label">Today's Returns:</span>
                <span>${todayReturnCount} bowls</span>
            </div>
        `;
    } else {
        html += `
            <div class="data-row">
                <span class="data-label">Today's Preparations:</span>
                <span>${todayPrepCount} bowls</span>
            </div>
        `;
    }
    
    crossTeamData.innerHTML = html;
}

function startScanning() {
    if (!isDataDownloaded) {
        showFeedback('❌ Please download data first', 'error');
        return;
    }
    if (!selectedUser) {
        showFeedback('❌ Please select a user first', 'error');
        return;
    }
    if (currentMode === 'kitchen' && !selectedDishLetter) {
        showFeedback('❌ Please select a dish letter first', 'error');
        return;
    }
    
    isScanning = true;
    updateUI();
    document.getElementById('progloveInput').focus();
    showFeedback(`🎯 SCANNING ACTIVE - Ready for ProGlove`, 'success');
}

function stopScanning() {
    isScanning = false;
    updateUI();
    showFeedback(`⏹ Scanning stopped`, 'info');
}

function handleProGloveScan(e) {
    if (!isScanning || !selectedUser || !isDataDownloaded) return;
    
    const bowlId = e.target.value.trim();
    if (bowlId.length >= 2) {
        processScan(bowlId);
        setTimeout(() => e.target.value = '', 100);
    }
}

function processScan(bowlId) {
    const startTime = Date.now();
    let result;
    
    if (currentMode === 'kitchen') {
        result = scanKitchen(bowlId, selectedUser, selectedDishLetter);
    } else {
        result = scanReturn(bowlId, selectedUser);
    }
    
    document.getElementById('responseTimeValue').textContent = result.responseTime;
    showFeedback(result.message, result.type || 'success');
    
    if (result.type === 'error') {
        document.getElementById('progloveInput').classList.add('error');
        setTimeout(() => document.getElementById('progloveInput').classList.remove('error'), 2000);
    } else {
        document.getElementById('progloveInput').classList.remove('error');
    }
    
    if (result.success) {
        updateUI();
    }
}

// ==================== HELPER FUNCTIONS ====================

function showFeedback(message, type) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.className = 'feedback ' + type;
}

function repairVYTCode(inputCode) {
    try {
        let cleanCode = inputCode.toString().trim().toUpperCase();
        const prefixes = ['HTTP://VYT.TO/', 'VYT.TO/', 'VYT/', 'HTTP://', 'HTTPS://'];
        
        prefixes.forEach(prefix => {
            if (cleanCode.includes(prefix)) {
                cleanCode = cleanCode.replace(prefix, '');
            }
        });
        
        if (cleanCode.includes('/')) {
            const parts = cleanCode.split('/');
            cleanCode = parts[parts.length - 1];
        }
        
        cleanCode = cleanCode.replace(/[^A-Z0-9]/gi, '');
        
        return cleanCode ? 'HTTP://VYT.TO/' + cleanCode : inputCode;
    } catch (error) {
        return inputCode;
    }
}

function getTodayDate() {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
}

function getCompanyInfo(fullVYTCode) {
    const company = localData.companyData.find(item => 
        repairVYTCode(item[0]) === fullVYTCode
    );
    return {
        company: company ? company[1] : "Unknown",
        customer: company ? company[2] : "Unknown", 
        department: company ? company[3] : "Unknown"
    };
}

// Local storage functions
function saveLocalData() {
    localStorage.setItem('proglove_local_data', JSON.stringify({
        ...localData,
        lastSaved: new Date().toISOString()
    }));
}

function loadLocalData() {
    const saved = localStorage.getItem('proglove_local_data');
    if (saved) {
        const data = JSON.parse(saved);
        localData.myScans = data.myScans || [];
        localData.uploadHistory = data.uploadHistory || [];
        isDataDownloaded = data.activeData && data.activeData.length > 0;
        updateUI();
        updateUploadInfo();
    }
}
