// kitchen-stats.js - Overnight statistics with user totals
class KitchenStats {
    constructor(appData) {
        this.appData = appData;
    }

    // Get overnight statistics (10PM previous day to 10AM current day)
    getOvernightStats() {
        const now = new Date();
        const today10AM = new Date(now);
        today10AM.setHours(10, 0, 0, 0);
        
        const yesterday10PM = new Date(now);
        yesterday10PM.setDate(yesterday10PM.getDate() - 1);
        yesterday10PM.setHours(22, 0, 0, 0);
        
        const isOvernightCycle = now >= yesterday10PM && now <= today10AM;
        const cycleName = isOvernightCycle ? 'Yesterday 10PM - Today 10AM' : 'Today 10PM - Tomorrow 10AM';

        // Filter scans for overnight cycle
        const overnightScans = this.appData.preparedBowls.filter(bowl => {
            try {
                const scanDate = new Date(bowl.date.split('/').reverse().join('-') + 'T' + bowl.time);
                return scanDate >= yesterday10PM && scanDate <= today10AM;
            } catch (e) {
                return false;
            }
        });

        return {
            cycleName: cycleName,
            totalScans: overnightScans.length,
            byUserDish: this.getUserDishStats(overnightScans),
            byUserTotal: this.getUserTotalStats(overnightScans),
            timeRange: {
                start: yesterday10PM.toLocaleString(),
                end: today10AM.toLocaleString()
            }
        };
    }

    // Get statistics grouped by User + Dish
    getUserDishStats(scans) {
        const userDishStats = {};
        
        scans.forEach(scan => {
            const key = `${scan.user}-${scan.dish}`;
            if (!userDishStats[key]) {
                userDishStats[key] = {
                    dish: scan.dish,
                    user: scan.user,
                    count: 0,
                    startTime: null,
                    endTime: null
                };
            }
            
            userDishStats[key].count++;
            
            const scanTime = new Date(scan.date.split('/').reverse().join('-') + 'T' + scan.time);
            if (!userDishStats[key].startTime || scanTime < userDishStats[key].startTime) {
                userDishStats[key].startTime = scanTime;
            }
            if (!userDishStats[key].endTime || scanTime > userDishStats[key].endTime) {
                userDishStats[key].endTime = scanTime;
            }
        });

        // Convert to array and sort
        return Object.values(userDishStats)
            .sort((a, b) => {
                // Sort by dish (A-Z, then 1-4), then by user
                if (a.dish !== b.dish) {
                    const aIsNumber = !isNaN(a.dish);
                    const bIsNumber = !isNaN(b.dish);
                    if (aIsNumber && !bIsNumber) return 1;
                    if (!aIsNumber && bIsNumber) return -1;
                    if (aIsNumber && bIsNumber) return parseInt(a.dish) - parseInt(b.dish);
                    return a.dish.localeCompare(b.dish);
                }
                return a.user.localeCompare(b.user);
            })
            .map(stat => ({
                dish: stat.dish,
                user: stat.user,
                count: stat.count,
                startTime: stat.startTime ? stat.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-',
                endTime: stat.endTime ? stat.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'
            }));
    }

    // Get total statistics by User (for round graph)
    getUserTotalStats(scans) {
        const userStats = {};
        
        scans.forEach(scan => {
            if (!userStats[scan.user]) {
                userStats[scan.user] = {
                    user: scan.user,
                    total: 0
                };
            }
            userStats[scan.user].total++;
        });

        // Calculate percentages
        const totalScans = scans.length;
        const userTotals = Object.values(userStats)
            .sort((a, b) => b.total - a.total)
            .map(stat => ({
                user: stat.user,
                total: stat.total,
                percentage: totalScans > 0 ? Math.round((stat.total / totalScans) * 100) : 0
            }));

        return {
            users: userTotals,
            totalScans: totalScans
        };
    }

    // Get data for round graph (user totals only)
    getRoundGraphData() {
        const overnightStats = this.getOvernightStats();
        return overnightStats.byUserTotal;
    }
}

// Make available globally
window.KitchenStats = KitchenStats;
