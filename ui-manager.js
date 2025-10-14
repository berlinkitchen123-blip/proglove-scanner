// ui-manager.js - User Interface Management
class UIManager {
    constructor() {
        this.elements = {};
    }

    // ==================== INITIALIZATION ====================

    initialize() {
        this.cacheElements();
        this.initializeUsers();
        this.initializeDishLetters();
    }

    cacheElements() {
        this.elements = {
            kitchenBtn: document.getElementById('kitchenBtn'),
            returnBtn: document.getElementById('returnBtn'),
            userDropdown: document.getElementById('userDropdown'),
            dishDropdown: document.getElementById('dishDropdown'),
            dishSection: document.getElementById('dishSection'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            progloveInput: document.getElementById('progloveInput'),
            activeCount: document.getElementById('activeCount'),
            prepCount: document.getElementById('prepCount'),
            feedback: document.getElementById('feedback'),
            jsonData: document.getElementById('jsonData')
        };
    }

    // ==================== USER INTERFACE ====================

    initializeUsers() {
        const dropdown = this.elements.userDropdown;
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        CONFIG.USERS.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            dropdown.appendChild(option);
        });
    }

    loadUsers(mode) {
        const dropdown = this.elements.userDropdown;
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        const usersToShow = CONFIG.USERS.filter(user => user.role === mode);
        usersToShow.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            dropdown.appendChild(option);
        });
    }

    initializeDishLetters() {
        const dropdown = this.elements.dishDropdown;
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">-- Select Dish --</option>';
        CONFIG.DISH_LETTERS.forEach(letter => {
            const option = document.createElement('option');
            option.value = letter;
            option.textContent = letter;
            dropdown.appendChild(option);
        });
    }

    // ==================== MODE & STATE DISPLAY ====================

    updateModeDisplay(mode) {
        if (this.elements.kitchenBtn) {
            this.elements.kitchenBtn.classList.toggle('active', mode === 'kitchen');
        }
        if (this.elements.returnBtn) {
            this.elements.returnBtn.classList.toggle('active', mode === 'return');
        }
        if (this.elements.dishSection) {
            this.elements.dishSection.classList.toggle('hidden', mode !== 'kitchen');
        }
    }

    updateUserDisplay(user) {
        // User selection is handled by dropdown, but we can add visual feedback
        if (user && this.elements.userDropdown) {
            this.elements.userDropdown.value = user;
        }
    }

    updateDishDisplay(dishLetter) {
        if (dishLetter && this.elements.dishDropdown) {
            this.elements.dishDropdown.value = dishLetter;
        }
    }

    // ==================== SCANNING UI ====================

    setScanningUI(scanning) {
        if (this.elements.startBtn) {
            this.elements.startBtn.disabled = scanning;
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.disabled = !scanning;
        }
        if (this.elements.progloveInput) {
            this.elements.progloveInput.disabled = !scanning;
            this.elements.progloveInput.placeholder = scanning ? 
                "Scan VYT code..." : "Click START SCANNING...";
            if (scanning) {
                this.elements.progloveInput.focus();
            }
        }
    }

    // ==================== DATA DISPLAY ====================

    updateDisplay(appData) {
        this.updateCounts(appData);
        this.setScanningUI(appData.scanning);
    }

    updateCounts(appData) {
        const today = new Date().toLocaleDateString('en-GB');
        const preparedToday = appData.preparedBowls.filter(bowl => bowl.date === today).length;
        
        if (this.elements.activeCount) {
            this.elements.activeCount.textContent = appData.activeBowls.length;
        }
        if (this.elements.prepCount) {
            this.elements.prepCount.textContent = preparedToday;
        }
    }

    // ==================== FEEDBACK & MESSAGES ====================

    showMessage(text, type = 'info') {
        const element = this.elements.feedback;
        if (!element) return;

        element.textContent = text;
        element.className = `feedback ${type}`;

        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (element.textContent === text) {
                    this.clearMessage();
                }
            }, 3000);
        }
    }

    clearMessage() {
        if (this.elements.feedback) {
            this.elements.feedback.textContent = '';
            this.elements.feedback.className = 'feedback';
        }
    }

    showLoading(message = 'Loading...') {
        this.showMessage(`⏳ ${message}`, 'info');
    }

    showError(message) {
        this.showMessage(`❌ ${message}`, 'error');
    }

    showSuccess(message) {
        this.showMessage(`✅ ${message}`, 'success');
    }

    // ==================== FORM MANAGEMENT ====================

    getJSONData() {
        return this.elements.jsonData ? this.elements.jsonData.value.trim() : '';
    }

    setJSONData(json) {
        if (this.elements.jsonData) {
            this.elements.jsonData.value = json;
        }
    }

    clearJSONData() {
        this.setJSONData('');
    }

    // ==================== EXPORT UI ====================

    showExportStatus(message, type = 'info') {
        const statusElement = document.getElementById('exportStatus');
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `export-status ${type}`;

        if (type === 'success') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'export-status';
            }, 5000);
        }
    }

    // ==================== STATISTICS DISPLAY ====================

    displayStatistics(stats) {
        // Create or update statistics display
        let statsElement = document.getElementById('statisticsDisplay');
        if (!statsElement) {
            statsElement = document.createElement('div');
            statsElement.id = 'statisticsDisplay';
            statsElement.className = 'statistics-panel';
            document.body.appendChild(statsElement);
        }

        statsElement.innerHTML = `
            <div class="stats-header">
                <h3>📊 Statistics Report</h3>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="stats-content">
                <div class="stat-item">
                    <span>Active Bowls:</span>
                    <strong>${stats.summary.active}</strong>
                </div>
                <div class="stat-item">
                    <span>Prepared Today:</span>
                    <strong>${stats.summary.prepared}</strong>
                </div>
                <div class="stat-item">
                    <span>Returned Today:</span>
                    <strong>${stats.summary.returned}</strong>
                </div>
                <div class="stat-item">
                    <span>Aging Bowls (3+ days):</span>
                    <strong>${stats.agingBowls}</strong>
                </div>
            </div>
        `;
    }

    // ==================== UTILITY METHODS ====================

    enableElement(selector, enabled = true) {
        const element = document.querySelector(selector);
        if (element) {
            element.disabled = !enabled;
        }
    }

    toggleElement(selector, show = true) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.toggle('hidden', !show);
        }
    }
}
