// json-processor.js - Standalone JSON Processing
class JSONProcessor {
    constructor(appData) {
        this.appData = appData;
    }

    processDeliveryJSON(jsonData) {
        console.log('🔄 Processing JSON Data...');
        
        let movedBowls = 0;
        let createdBowls = 0;
        let totalProcessed = 0;

        // 1. GET DELIVERY NAME
        const deliveryName = jsonData.deliveryName || "Unknown Company";
        console.log(`🏢 Delivery: ${deliveryName}`);

        // 2. FIND ALL DISHES WITH BOWLCODES
        if (jsonData.boxes && Array.isArray(jsonData.boxes)) {
            jsonData.boxes.forEach(box => {
                if (box.dishes && Array.isArray(box.dishes)) {
                    box.dishes.forEach(dish => {
                        // 3. PROCESS EACH BOWLCODE
                        if (dish.bowlCodes && Array.isArray(dish.bowlCodes)) {
                            dish.bowlCodes.forEach(bowlCode => {
                                totalProcessed++;
                                
                                // 4. GET CUSTOMERS FOR THIS BOWL
                                const customers = this.extractCustomers(dish.users);
                                
                                // 5. PROCESS THE BOWL
                                this.processSingleBowl(
                                    bowlCode,
                                    deliveryName,
                                    customers,
                                    dish.label,
                                    dish.users?.length > 1
                                ) ? movedBowls++ : createdBowls++;
                            });
                        }
                    });
                }
            });
        }

        return {
            success: true,
            deliveryName: deliveryName,
            movedBowls: movedBowls,
            createdBowls: createdBowls,
            totalProcessed: totalProcessed
        };
    }

    extractCustomers(users) {
        if (!users || !Array.isArray(users)) return "Unknown";
        return users.map(user => user.username).filter(name => name).join(', ');
    }

    processSingleBowl(bowlCode, company, customers, dishLetter, multipleCustomers) {
        // CHECK IF IN PREPARED (MOVE TO ACTIVE)
        const preparedIndex = this.appData.preparedBowls.findIndex(bowl => bowl.code === bowlCode);
        if (preparedIndex !== -1) {
            const bowl = this.appData.preparedBowls[preparedIndex];
            this.appData.preparedBowls.splice(preparedIndex, 1);
            
            this.appData.activeBowls.push({
                ...bowl,
                company: company,
                customer: customers,
                dish: dishLetter || bowl.dish,
                status: 'ACTIVE',
                multipleCustomers: multipleCustomers
            });
            return true; // MOVED
        }

        // CREATE NEW IN ACTIVE
        const exists = this.appData.activeBowls.some(bowl => bowl.code === bowlCode) ||
                      this.appData.returnedBowls.some(bowl => bowl.code === bowlCode);
        
        if (!exists) {
            this.appData.activeBowls.push({
                code: bowlCode,
                dish: dishLetter || '',
                user: "JSON Import",
                company: company,
                customer: customers,
                date: new Date().toLocaleDateString('en-GB'),
                time: new Date().toLocaleTimeString(),
                status: 'ACTIVE',
                multipleCustomers: multipleCustomers
            });
            return false; // CREATED
        }

        return false; // ALREADY EXISTS
    }
}

// Make available globally
window.JSONProcessor = JSONProcessor;
