// export.js - Enhanced Excel Export with Color Coding

// Export functionality initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeExportSection();
    setupExportEventListeners();
});

// Initialize export section UI
function initializeExportSection() {
    // Create export section if it doesn't exist
    if (!document.getElementById('exportSection')) {
        const exportSection = document.createElement('div');
        exportSection.id = 'exportSection';
        exportSection.className = 'section';
        exportSection.innerHTML = `
            <h2>Data Export</h2>
            <div class="export-controls">
                <div class="export-format-selector">
                    <label>Export Format:</label>
                    <select id="exportFormat">
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                    </select>
                </div>
                <div class="export-data-selector">
                    <label>Data to Export:</label>
                    <select id="exportDataType">
                        <option value="all">All Data</option>
                        <option value="active">Active Bowls</option>
                        <option value="prepared">Prepared Bowls</option>
                        <option value="returned">Returned Bowls</option>
                        <option value="today">Today's Data</option>
                    </select>
                </div>
                <div class="export-actions">
                    <button id="exportBtn" class="btn-primary">Export Data</button>
                    <button id="clearDataBtn" class="btn-secondary">Clear All Data</button>
                </div>
            </div>
            <div class="export-info">
                <h4>Color Coding in Excel Export:</h4>
                <ul>
                    <li><span class="color-demo" style="color: green;">Green</span> - Single customer</li>
                    <li><span class="color-demo" style="color: red;">Red</span> - Multiple customers</li>
                    <li><span class="color-demo" style="color: #FFD700;">Yellow</span> - Active 3+ days</li>
                    <li><span class="color-demo" style="color: #FF69B4;">Pink</span> - Active 4+ days</li>
                    <li><span class="color-demo" style="color: #FFA500;">Orange</span> - Active 5+ days</li>
                    <li><span class="color-demo" style="color: #FF0000;">Red</span> - Active 6+ days</li>
                </ul>
            </div>
            <div id="exportStatus" class="export-status"></div>
        `;
        
        // Find where to insert the export section (after the JSON section)
        const jsonSection = document.querySelector('.section:has(#jsonData)');
        if (jsonSection) {
            jsonSection.parentNode.insertBefore(exportSection, jsonSection.nextSibling);
        } else {
            // Fallback: append to body
            document.body.appendChild(exportSection);
        }
    }
}

// Set up event listeners for export functionality
function setupExportEventListeners() {
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('clearDataBtn').addEventListener('click', handleClearData);
}

// Main export handler
function handleExport() {
    const format = document.getElementById('exportFormat').value;
    const dataType = document.getElementById('exportDataType').value;
    
    const data = getExportData(dataType);
    
    if (data.length === 0) {
        showExportStatus('No data to export', 'error');
        return;
    }
    
    switch (format) {
        case 'excel':
            exportToExcel(data, dataType);
            break;
        case 'csv':
            exportToCSV(data, dataType);
            break;
        case 'json':
            exportToJSON(data, dataType);
            break;
    }
}

// Get data based on selected type
function getExportData(dataType) {
    const today = new Date().toLocaleDateString('en-GB');
    
    switch (dataType) {
        case 'active':
            return window.appData.activeBowls;
        case 'prepared':
            return window.appData.preparedBowls.filter(bowl => bowl.date === today);
        case 'returned':
            return window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
        case 'today':
            const preparedToday = window.appData.preparedBowls.filter(bowl => bowl.date === today);
            const returnedToday = window.appData.returnedBowls.filter(bowl => bowl.returnDate === today);
            return [...preparedToday, ...returnedToday];
        case 'all':
        default:
            return [
                ...window.appData.activeBowls,
                ...window.appData.preparedBowls,
                ...window.appData.returnedBowls
            ];
    }
}

// Calculate business days active
function getBusinessDaysActive(bowl) {
    if (!bowl.date) return 0;
    
    const startDate = parseUKDate(bowl.date);
    const today = new Date();
    
    // Reset times for accurate day calculation
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    let businessDays = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate <= today) {
        const dayOfWeek = currentDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return Math.max(0, businessDays - 1); // Subtract 1 to exclude start day
}

// Parse UK date format (DD/MM/YYYY)
function parseUKDate(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(); // Fallback to current date
}

// Get color based on business days active
function getDaysActiveColor(businessDays) {
    if (businessDays >= 6) return '#FF0000'; // Red - 6+ days
    if (businessDays >= 5) return '#FFA500'; // Orange - 5 days
    if (businessDays >= 4) return '#FF69B4'; // Pink - 4 days
    if (businessDays >= 3) return '#FFD700'; // Yellow - 3 days
    return '#000000'; // Black - less than 3 days
}

// Get customer count color
function getCustomerColor(customerField) {
    if (!customerField) return '#000000'; // Black for no customer
    
    const customers = customerField.split(',').filter(c => c.trim() !== '');
    return customers.length === 1 ? '#008000' : '#FF0000'; // Green for single, Red for multiple
}

// Enhanced Excel Export with Color Coding
function exportToExcel(data, dataType) {
    if (data.length === 0) {
        showExportStatus('No data to export', 'error');
        return;
    }

    try {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data for Excel with additional calculated fields
        const excelData = data.map(bowl => {
            const businessDays = getBusinessDaysActive(bowl);
            const customerColor = getCustomerColor(bowl.customer);
            const daysColor = getDaysActiveColor(businessDays);
            
            return {
                'Bowl Code': bowl.code,
                'Dish': bowl.dish,
                'User': bowl.user,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'Date': bowl.date,
                'Time': bowl.time,
                'Status': bowl.status,
                'Returned By': bowl.returnedBy || '',
                'Return Date': bowl.returnDate || '',
                'Business Days Active': businessDays,
                'Multiple Customers': bowl.multipleCustomers || (bowl.customer && bowl.customer.split(',').length > 1),
                '_CustomerColor': customerColor,
                '_DaysColor': daysColor
            };
        });

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData, {
            header: [
                'Bowl Code', 'Dish', 'User', 'Company', 'Customer', 
                'Date', 'Time', 'Status', 'Returned By', 'Return Date',
                'Business Days Active', 'Multiple Customers'
            ]
        });

        // Apply color formatting
        applyExcelFormatting(ws, excelData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Bowl Data');

        // Generate Excel file
        const fileName = `proglove_data_${dataType}_${getTimestamp()}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showExportStatus(`Exported ${data.length} records as Excel with color coding`, 'success');
        
    } catch (error) {
        console.error('Excel export error:', error);
        showExportStatus('Error exporting to Excel', 'error');
    }
}

// Apply color formatting to Excel worksheet
function applyExcelFormatting(ws, data) {
    if (!ws['!ref']) return;

    // Get the range of cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Apply formatting to each row
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const dataIndex = row - (range.s.r + 1);
        const bowlData = data[dataIndex];
        
        if (!bowlData) continue;

        // Color Bowl Code based on days active
        const bowlCodeCell = XLSX.utils.encode_cell({ r: row, c: 0 }); // Column A
        if (!ws[bowlCodeCell]) ws[bowlCodeCell] = {};
        if (!ws[bowlCodeCell].s) ws[bowlCodeCell].s = {};
        ws[bowlCodeCell].s.font = { color: { rgb: bowlData._DaysColor } };

        // Color Customer based on customer count
        const customerCell = XLSX.utils.encode_cell({ r: row, c: 4 }); // Column E
        if (!ws[customerCell]) ws[customerCell] = {};
        if (!ws[customerCell].s) ws[customerCell].s = {};
        ws[customerCell].s.font = { color: { rgb: bowlData._CustomerColor } };
    }

    // Add header styling
    for (let col = range.s.c; col <= range.e.c; col++) {
        const headerCell = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        if (!ws[headerCell]) ws[headerCell] = {};
        if (!ws[headerCell].s) ws[headerCell].s = {};
        ws[headerCell].s = {
            fill: { fgColor: { rgb: "4472C4" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center" }
        };
    }

    // Auto-fit columns
    if (!ws['!cols']) ws['!cols'] = [];
    for (let i = 0; i <= range.e.c; i++) {
        ws['!cols'][i] = { width: 15 };
    }
}

// CSV Export (fallback)
function exportToCSV(data, dataType) {
    if (data.length === 0) {
        showExportStatus('No data to export', 'error');
        return;
    }
    
    const headers = Object.keys(data[0]).filter(key => !key.startsWith('_'));
    
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
        const row = headers.map(header => {
            let value = item[header] || '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
        csvContent += row + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `proglove_data_${dataType}_${getTimestamp()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showExportStatus(`Exported ${data.length} records as CSV`, 'success');
}

// JSON Export
function exportToJSON(data, dataType) {
    if (data.length === 0) {
        showExportStatus('No data to export', 'error');
        return;
    }
    
    const jsonData = {
        exportDate: new Date().toISOString(),
        dataType: dataType,
        records: data
    };
    
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `proglove_data_${dataType}_${getTimestamp()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showExportStatus(`Exported ${data.length} records as JSON`, 'success');
}

// Clear all data with confirmation
function handleClearData() {
    if (confirm('Are you sure you want to clear ALL data? This action cannot be undone.')) {
        window.appData.activeBowls = [];
        window.appData.preparedBowls = [];
        window.appData.returnedBowls = [];
        window.appData.scanHistory = [];
        
        if (typeof saveToStorage === 'function') {
            saveToStorage();
        }
        
        if (typeof updateDisplay === 'function') {
            updateDisplay();
        }
        
        showExportStatus('All data cleared successfully', 'success');
    }
}

// Show export status message
function showExportStatus(message, type) {
    const statusElement = document.getElementById('exportStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `export-status ${type}`;
        
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'export-status';
        }, 5000);
    }
}

// Generate timestamp for filenames
function getTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, -5);
}

// Load SheetJS library dynamically
function loadSheetJS() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Enhanced export handler with SheetJS loading
async function handleExport() {
    const format = document.getElementById('exportFormat').value;
    const dataType = document.getElementById('exportDataType').value;
    
    const data = getExportData(dataType);
    
    if (data.length === 0) {
        showExportStatus('No data to export', 'error');
        return;
    }
    
    try {
        if (format === 'excel') {
            showExportStatus('Loading Excel library...', 'info');
            await loadSheetJS();
        }
        
        switch (format) {
            case 'excel':
                exportToExcel(data, dataType);
                break;
            case 'csv':
                exportToCSV(data, dataType);
                break;
            case 'json':
                exportToJSON(data, dataType);
                break;
        }
    } catch (error) {
        console.error('Export error:', error);
        showExportStatus('Error during export: ' + error.message, 'error');
    }
}

// Add CSS for export section
function addExportStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .export-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 15px;
            align-items: end;
        }
        
        .export-format-selector,
        .export-data-selector {
            display: flex;
            flex-direction: column;
            min-width: 150px;
        }
        
        .export-format-selector label,
        .export-data-selector label {
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 14px;
        }
        
        .export-actions {
            display: flex;
            gap: 10px;
        }
        
        .export-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #007bff;
        }
        
        .export-info h4 {
            margin-top: 0;
            color: #0056b3;
        }
        
        .export-info ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .export-info li {
            margin: 5px 0;
        }
        
        .color-demo {
            font-weight: bold;
            display: inline-block;
            min-width: 60px;
        }
        
        .export-status {
            margin-top: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            font-weight: bold;
            min-height: 20px;
        }
        
        .export-status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .export-status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .export-status.info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        #exportBtn, #clearDataBtn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        
        #exportBtn {
            background-color: #28a745;
            color: white;
        }
        
        #exportBtn:hover {
            background-color: #218838;
        }
        
        #clearDataBtn {
            background-color: #dc3545;
            color: white;
        }
        
        #clearDataBtn:hover {
            background-color: #c82333;
        }
        
        select {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: white;
        }
    `;
    document.head.appendChild(style);
}

// Initialize styles when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportStyles);
} else {
    addExportStyles();
}

// Make functions available globally
window.handleExport = handleExport;
window.handleClearData = handleClearData;
window.getBusinessDaysActive = getBusinessDaysActive;
