// data-export.js - Excel export functionality
class DataExport {
    constructor(appData) {
        this.appData = appData;
    }

    // Export ACTIVE BOWLS to Excel
    exportActiveBowls() {
        const data = this.appData.activeBowls.map(bowl => ({
            'VYT Code': bowl.code,
            'Dish Letter': bowl.dish,
            'Company': bowl.company,
            'Customer': bowl.customer,
            'Assigned By': bowl.user,
            'Date Assigned': bowl.date,
            'Time Assigned': bowl.time,
            'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No',
            'Status': bowl.status
        }));
        
        this.exportToExcel(data, 'Active_Bowls');
        return `✅ ${data.length} active bowls exported to Excel`;
    }

    // Export PREPARED BOWLS to Excel
    exportPreparedBowls() {
        const today = new Date().toLocaleDateString('en-GB');
        const data = this.appData.preparedBowls
            .filter(bowl => bowl.date === today)
            .map(bowl => ({
                'VYT Code': bowl.code,
                'Dish Letter': bowl.dish,
                'Prepared By': bowl.user,
                'Date Prepared': bowl.date,
                'Time Prepared': bowl.time,
                'Status': bowl.status
            }));
        
        this.exportToExcel(data, 'Prepared_Bowls_Today');
        return `✅ ${data.length} prepared bowls exported to Excel`;
    }

    // Export RETURN DATA to Excel
    exportReturnData() {
        const today = new Date().toLocaleDateString('en-GB');
        const data = this.appData.returnedBowls
            .filter(bowl => bowl.returnDate === today)
            .map(bowl => ({
                'VYT Code': bowl.code,
                'Dish Letter': bowl.dish,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'Returned By': bowl.returnedBy,
                'Return Date': bowl.returnDate,
                'Return Time': bowl.returnTime,
                'Original User': bowl.user
            }));
        
        this.exportToExcel(data, 'Return_Data_Today');
        return `✅ ${data.length} returned bowls exported to Excel`;
    }

    // Export KITCHEN STATISTICS to Excel
    exportKitchenStats() {
        const today = new Date().toLocaleDateString('en-GB');
        const todayBowls = this.appData.preparedBowls.filter(bowl => bowl.date === today);
        
        // User Statistics
        const userStats = this.calculateUserStats(todayBowls);
        
        // Dish Statistics  
        const dishStats = this.calculateDishStats(todayBowls);
        
        // Hourly Statistics
        const hourlyStats = this.calculateHourlyStats(todayBowls);
        
        // Create multiple sheets
        const sheets = {
            'User_Performance': userStats,
            'Dish_Statistics': dishStats,
            'Hourly_Activity': hourlyStats,
            'Summary': [{
                'Total Bowls Prepared': todayBowls.length,
                'Unique Users': new Set(todayBowls.map(b => b.user)).size,
                'Unique Dishes': new Set(todayBowls.map(b => b.dish)).size,
                'Report Date': today,
                'Generated At': new Date().toLocaleTimeString()
            }]
        };
        
        this.exportMultipleSheets(sheets, 'Kitchen_Statistics');
        return '✅ Kitchen statistics exported to Excel';
    }

    // Export ALL DATA to Excel with multiple sheets
    exportAllData() {
        const today = new Date().toLocaleDateString('en-GB');
        
        const sheets = {
            'Active_Bowls': this.appData.activeBowls.map(bowl => ({
                'VYT Code': bowl.code,
                'Dish': bowl.dish,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'User': bowl.user,
                'Date': bowl.date,
                'Time': bowl.time,
                'Multiple Customers': bowl.multipleCustomers ? 'Yes' : 'No'
            })),
            
            'Prepared_Today': this.appData.preparedBowls
                .filter(bowl => bowl.date === today)
                .map(bowl => ({
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'User': bowl.user,
                    'Time': bowl.time
                })),
                
            'Returns_Today': this.appData.returnedBowls
                .filter(bowl => bowl.returnDate === today)
                .map(bowl => ({
                    'VYT Code': bowl.code,
                    'Dish': bowl.dish,
                    'Company': bowl.company,
                    'Customer': bowl.customer,
                    'Returned By': bowl.returnedBy,
                    'Return Time': bowl.returnTime
                })),
                
            'Scan_History': this.appData.scanHistory.slice(0, 100).map(scan => ({
                'Type': scan.type,
                'VYT Code': scan.code,
                'User': scan.user,
                'Timestamp': scan.timestamp,
                'Message': scan.message
            }))
        };
        
        this.exportMultipleSheets(sheets, 'Complete_Scanner_Data');
        return '✅ All data exported to Excel with multiple sheets';
    }

    // Calculate user statistics
    calculateUserStats(bowls) {
        const userStats = {};
        bowls.forEach(bowl => {
            if (!userStats[bowl.user]) {
                userStats[bowl.user] = {
                    'User': bowl.user,
                    'Total Bowls': 0,
                    'First Scan': bowl.time,
                    'Last Scan': bowl.time,
                    'Dishes Prepared': ''
                };
            }
            
            userStats[bowl.user]['Total Bowls']++;
            
            if (bowl.time < userStats[bowl.user]['First Scan']) {
                userStats[bowl.user]['First Scan'] = bowl.time;
            }
            if (bowl.time > userStats[bowl.user]['Last Scan']) {
                userStats[bowl.user]['Last Scan'] = bowl.time;
            }
            
            // Track dishes
            const dishes = userStats[bowl.user]['Dishes Prepared'].split(', ').filter(d => d);
            if (!dishes.includes(bowl.dish)) {
                dishes.push(bowl.dish);
                userStats[bowl.user]['Dishes Prepared'] = dishes.join(', ');
            }
        });
        
        return Object.values(userStats);
    }

    // Calculate dish statistics
    calculateDishStats(bowls) {
        const dishStats = {};
        bowls.forEach(bowl => {
            if (!dishStats[bowl.dish]) {
                dishStats[bowl.dish] = {
                    'Dish Letter': bowl.dish,
                    'Total Prepared': 0,
                    'Users': ''
                };
            }
            
            dishStats[bowl.dish]['Total Prepared']++;
            
            // Track users
            const users = dishStats[bowl.dish]['Users'].split(', ').filter(u => u);
            if (!users.includes(bowl.user)) {
                users.push(bowl.user);
                dishStats[bowl.dish]['Users'] = users.join(', ');
            }
        });
        
        return Object.values(dishStats);
    }

    // Calculate hourly statistics
    calculateHourlyStats(bowls) {
        const hourlyStats = {};
        bowls.forEach(bowl => {
            const hour = bowl.time.split(':')[0] + ':00';
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = {
                    'Time Slot': hour,
                    'Bowls Prepared': 0
                };
            }
            hourlyStats[hour]['Bowls Prepared']++;
        });
        
        return Object.values(hourlyStats).sort((a, b) => a['Time Slot'].localeCompare(b['Time Slot']));
    }

    // Main Excel export function (single sheet)
    exportToExcel(data, sheetName = 'Data') {
        // Check if XLSX is available
        if (typeof XLSX === 'undefined') {
            alert('❌ Excel export library not loaded. Please include SheetJS library.');
            return;
        }
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // Multiple sheets export
    exportMultipleSheets(sheets, filename) {
        if (typeof XLSX === 'undefined') {
            alert('❌ Excel export library not loaded. Please include SheetJS library.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        Object.entries(sheets).forEach(([sheetName, data]) => {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
}

// Make available globally
window.DataExport = DataExport;
