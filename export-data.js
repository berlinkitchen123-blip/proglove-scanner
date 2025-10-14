// export-data.js - Enhanced Data Export with Statistics
class DataExporter {
    static async exportToExcel(data, dataType) {
        await this.loadSheetJS();
        
        const wb = XLSX.utils.book_new();
        
        // Main data sheet
        const excelData = this.prepareExcelData(data);
        const ws = XLSX.utils.json_to_sheet(excelData.processedData, {
            header: excelData.headers
        });
        this.applyExcelFormatting(ws, excelData.processedData);
        XLSX.utils.book_append_sheet(wb, ws, 'Bowl Data');
        
        // Statistics sheet
        this.addStatisticsSheet(wb, data, dataType);
        
        // Aging analysis sheet
        this.addAgingAnalysisSheet(wb, data);
        
        const fileName = `proglove_${dataType}_${this.getTimestamp()}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        return data.length;
    }

    static prepareExcelData(data) {
        const headers = [
            'Bowl Code', 'Dish', 'User', 'Company', 'Customer', 
            'Date', 'Time', 'Status', 'Returned By', 'Return Date',
            'Business Days Active', 'Customer Count', 'Aging Status'
        ];
        
        const processedData = data.map(bowl => {
            const businessDays = this.calculateBusinessDays(bowl.date);
            const customerCount = bowl.customer ? bowl.customer.split(',').filter(c => c.trim()).length : 0;
            const agingStatus = this.getAgingStatus(businessDays);
            
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
                'Customer Count': customerCount,
                'Aging Status': agingStatus.text,
                '_CustomerColor': customerCount === 1 ? '#008000' : '#FF0000',
                '_DaysColor': agingStatus.color
            };
        });
        
        return { headers, processedData };
    }

    static addStatisticsSheet(wb, data, dataType) {
        const stats = Statistics.generateExportData({
            activeBowls: data.filter(b => b.status === 'ACTIVE'),
            preparedBowls: data.filter(b => b.status === 'PREPARED'),
            returnedBowls: data.filter(b => b.status === 'RETURNED'),
            scanHistory: []
        });
        
        const statsData = [
            ['PROGLOVE SCANNER - STATISTICS REPORT', ''],
            ['Report Date', stats.reportDate],
            ['Generated', stats.generatedAt],
            ['Data Type', dataType],
            ['Total Records', data.length],
            [''],
            ['OVERVIEW', ''],
            ['Active Bowls', stats.overview.totalActive],
            ['Prepared Today', stats.overview.totalPrepared],
            ['Returned Today', stats.overview.totalReturned],
            ['Aging Bowls (3+ days)', stats.overview.agingBowls],
            [''],
            ['USER PERFORMANCE', 'Prepared', 'Returned', 'Total']
        ];
        
        // Add user stats
        stats.userPerformance.forEach(user => {
            statsData.push([user.user, user.prepared, user.returned, user.total]);
        });
        
        statsData.push(['', '', '', '']);
        statsData.push(['DISH PERFORMANCE', 'Prepared', 'Active', 'Returned']);
        
        // Add dish stats
        stats.dishPerformance.forEach(dish => {
            statsData.push([dish.dish, dish.prepared, dish.active, dish.returned]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(statsData);
        this.applyStatsFormatting(ws, statsData.length);
        XLSX.utils.book_append_sheet(wb, ws, 'Statistics');
    }

    static addAgingAnalysisSheet(wb, data) {
        const agingBowls = data.filter(bowl => {
            const businessDays = this.calculateBusinessDays(bowl.date);
            return businessDays >= 3;
        }).map(bowl => {
            const businessDays = this.calculateBusinessDays(bowl.date);
            const agingStatus = this.getAgingStatus(businessDays);
            
            return {
                'Bowl Code': bowl.code,
                'Dish': bowl.dish,
                'Company': bowl.company,
                'Customer': bowl.customer,
                'Start Date': bowl.date,
                'Business Days Active': businessDays,
                'Aging Level': agingStatus.level,
                'Action Required': businessDays >= 6 ? 'URGENT' : businessDays >= 4 ? 'FOLLOW UP' : 'MONITOR'
            };
        });
        
        if (agingBowls.length > 0) {
            const headers = Object.keys(agingBowls[0]);
            const ws = XLSX.utils.json_to_sheet(agingBowls, { header: headers });
            this.applyAgingFormatting(ws, agingBowls);
            XLSX.utils.book_append_sheet(wb, ws, 'Aging Analysis');
        }
    }

    static applyExcelFormatting(ws, data) {
        if (!ws['!ref']) return;

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Apply color coding
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const dataIndex = row - (range.s.r + 1);
            const bowlData = data[dataIndex];
            
            if (!bowlData) continue;

            // Color Bowl Code based on days active
            const bowlCodeCell = XLSX.utils.encode_cell({ r: row, c: 0 });
            if (!ws[bowlCodeCell]) ws[bowlCodeCell] = {};
            if (!ws[bowlCodeCell].s) ws[bowlCodeCell].s = {};
            ws[bowlCodeCell].s.font = { color: { rgb: bowlData._DaysColor }, bold: true };

            // Color Customer based on customer count
            const customerCell = XLSX.utils.encode_cell({ r: row, c: 4 });
            if (!ws[customerCell]) ws[customerCell] = {};
            if (!ws[customerCell].s) ws[customerCell].s = {};
            ws[customerCell].s.font = { color: { rgb: bowlData._CustomerColor } };
        }

        // Header styling
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

    static applyStatsFormatting(ws, dataLength) {
        if (!ws['!ref']) return;

        // Style headers and important cells
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let col = range.s.c; col <= range.e.c; col++) {
            const headerCell = XLSX.utils.encode_cell({ r: range.s.r, c: col });
            if (ws[headerCell]) {
                ws[headerCell].s = {
                    fill: { fgColor: { rgb: "7030A0" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true },
                    alignment: { horizontal: "center" }
                };
            }
        }

        // Auto-fit columns
        if (!ws['!cols']) ws['!cols'] = [];
        for (let i = 0; i <= range.e.c; i++) {
            ws['!cols'][i] = { width: 18 };
        }
    }

    static applyAgingFormatting(ws, data) {
        if (!ws['!ref']) return;

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const dataIndex = row - (range.s.r + 1);
            const bowl = data[dataIndex];
            
            if (!bowl) continue;

            // Color based on aging level
            let color = '#000000';
            if (bowl['Aging Level'] === 'CRITICAL') color = '#FF0000';
            else if (bowl['Aging Level'] === 'HIGH') color = '#FFA500';
            else if (bowl['Aging Level'] === 'MEDIUM') color = '#FF69B4';
            else if (bowl['Aging Level'] === 'LOW') color = '#FFD700';

            const agingCell = XLSX.utils.encode_cell({ r: row, c: 5 }); // Aging Level column
            if (!ws[agingCell]) ws[agingCell] = {};
            if (!ws[agingCell].s) ws[agingCell].s = {};
            ws[agingCell].s.font = { color: { rgb: color }, bold: true };

            const actionCell = XLSX.utils.encode_cell({ r: row, c: 6 }); // Action Required column
            if (!ws[actionCell]) ws[actionCell] = {};
            if (!ws[actionCell].s) ws[actionCell].s = {};
            ws[actionCell].s.font = { color: { rgb: color }, bold: true };
        }

        // Header styling
        for (let col = range.s.c; col <= range.e.c; col++) {
            const headerCell = XLSX.utils.encode_cell({ r: range.s.r, c: col });
            if (ws[headerCell]) {
                ws[headerCell].s = {
                    fill: { fgColor: { rgb: "C00000" } },
                    font: { color: { rgb: "FFFFFF" }, bold: true },
                    alignment: { horizontal: "center" }
                };
            }
        }
    }

    // Existing methods remain the same...
    static calculateBusinessDays(dateString) {
        if (!dateString) return 0;
        
        const startDate = this.parseUKDate(dateString);
        const today = new Date();
        
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        let businessDays = 0;
        let currentDate = new Date(startDate);
        
        while (currentDate <= today) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return Math.max(0, businessDays - 1);
    }

    static getAgingStatus(businessDays) {
        if (businessDays >= 6) return { level: 'CRITICAL', color: '#FF0000', text: '6+ days - URGENT' };
        if (businessDays >= 5) return { level: 'HIGH', color: '#FFA500', text: '5 days - High Priority' };
        if (businessDays >= 4) return { level: 'MEDIUM', color: '#FF69B4', text: '4 days - Medium Priority' };
        if (businessDays >= 3) return { level: 'LOW', color: '#FFD700', text: '3 days - Low Priority' };
        return { level: 'NORMAL', color: '#000000', text: 'Normal' };
    }

    static parseUKDate(dateString) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date();
    }

    static async loadSheetJS() {
        if (typeof XLSX !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    static getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    }

    // CSV and JSON export methods (keep your existing ones)
    static exportToCSV(data, dataType) {
        // Your existing CSV export code
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
        link.setAttribute('download', `proglove_data_${dataType}_${this.getTimestamp()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return data.length;
    }

    static exportToJSON(data, dataType) {
        const jsonData = {
            exportDate: new Date().toISOString(),
            dataType: dataType,
            recordCount: data.length,
            records: data
        };
        
        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `proglove_data_${dataType}_${this.getTimestamp()}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return data.length;
    }
}
