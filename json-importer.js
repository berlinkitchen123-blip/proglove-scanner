// json-importer.js - JSON Data Import Processing
class JSONImporter {
    static processJSONData(jsonText, appData) {
        if (!jsonText.trim()) {
            throw new Error('Paste JSON first');
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
                                    const preparedIndex = appData.preparedBowls.findIndex(bowl => bowl.code === bowlCode);
                                    if (preparedIndex !== -1) {
                                        const bowl = appData.preparedBowls[preparedIndex];
                                        appData.preparedBowls.splice(preparedIndex, 1);
                                        
                                        appData.activeBowls.push({
                                            ...bowl,
                                            company: company,
                                            customer: customers,
                                            dish: dish.label || bowl.dish,
                                            status: 'ACTIVE',
                                            multipleCustomers: dish.users && dish.users.length > 1,
                                            importTimestamp: Date.now()
                                        });
                                        movedBowls++;
                                        return;
                                    }

                                    // Create new in activeBowls if not exists
                                    if (!appData.activeBowls.some(bowl => bowl.code === bowlCode) && 
                                        !appData.returnedBowls.some(bowl => bowl.code === bowlCode)) {
                                        
                                        appData.activeBowls.push({
                                            code: bowlCode,
                                            dish: dish.label || '',
                                            user: "JSON Import",
                                            company: company,
                                            customer: customers,
                                            date: new Date().toLocaleDateString('en-GB'),
                                            time: new Date().toLocaleTimeString(),
                                            status: 'ACTIVE',
                                            multipleCustomers: dish.users && dish.users.length > 1,
                                            importTimestamp: Date.now()
                                        });
                                        createdBowls++;
                                    }
                                });
                            }
                        });
                    }
                });
            }

            return { movedBowls, createdBowls };
            
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    static validateJSONStructure(jsonData) {
        if (!jsonData.boxes || !Array.isArray(jsonData.boxes)) {
            throw new Error('Invalid JSON structure: missing boxes array');
        }
        
        // Validate each box has required fields
        jsonData.boxes.forEach((box, index) => {
            if (!box.uniqueIdentifier) {
                throw new Error(`Box ${index} missing uniqueIdentifier`);
            }
            if (box.dishes && !Array.isArray(box.dishes)) {
                throw new Error(`Box ${index} dishes must be an array`);
            }
        });
        
        return true;
    }

    static formatJSONForDisplay(jsonText) {
        try {
            const jsonData = JSON.parse(jsonText);
            return JSON.stringify(jsonData, null, 2);
        } catch (e) {
            return jsonText;
        }
    }

    static getImportStats(jsonData) {
        let totalBoxes = 0;
        let totalDishes = 0;
        let totalBowls = 0;

        if (jsonData.boxes) {
            totalBoxes = jsonData.boxes.length;
            jsonData.boxes.forEach(box => {
                if (box.dishes) {
                    totalDishes += box.dishes.length;
                    box.dishes.forEach(dish => {
                        if (dish.bowlCodes) {
                            totalBowls += dish.bowlCodes.length;
                        }
                    });
                }
            });
        }

        return {
            totalBoxes,
            totalDishes,
            totalBowls
        };
    }
}
