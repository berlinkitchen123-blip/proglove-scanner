# json_processor.py - Complete standalone file
import json
from datetime import datetime

class JSONProcessor:
    def __init__(self):
        self.processing_log = []
    
    def process_customer_data(self, json_input: str, bowls: list) -> dict:
        """Process JSON data for customer assignment"""
        try:
            # Parse JSON input
            if isinstance(json_input, str):
                customer_data = json.loads(json_input)
            else:
                customer_data = json_input
            
            results = {
                'assigned': [],
                'conflicts': [],
                'errors': [],
                'processed_count': 0
            }
            
            # Get active bowls
            active_bowls = [b for b in bowls if b.status == 'active']
            
            for item in customer_data:
                try:
                    bowl_code = str(item.get('bowl_code', '')).upper().strip()
                    company = str(item.get('company', '')).strip()
                    customer = str(item.get('customer', '')).strip()
                    dish_letter = str(item.get('dish_letter', '')).upper().strip()
                    
                    if not bowl_code:
                        results['errors'].append("Missing bowl code in JSON item")
                        continue
                    
                    if not company or not customer:
                        results['errors'].append(f"Missing company/customer for bowl {bowl_code}")
                        continue
                    
                    # Find matching active bowl
                    matching_bowls = []
                    for bowl in active_bowls:
                        bowl_url_code = bowl.vyt_url.split('/')[-1]
                        if bowl_url_code == bowl_code:
                            matching_bowls.append(bowl)
                    
                    if not matching_bowls:
                        results['errors'].append(f"No active bowl found for code: {bowl_code}")
                        continue
                    
                    # Check for dish letter conflicts
                    dish_bowls = []
                    for bowl in active_bowls:
                        if (bowl.dish_letter.upper() == dish_letter and 
                            bowl.company == company and bowl.customer):
                            dish_bowls.append(bowl)
                    
                    if len(dish_bowls) == 0:
                        # First assignment for this dish letter
                        for bowl in matching_bowls:
                            bowl.dish_letter = dish_letter
                            bowl.company = company
                            bowl.customer = customer
                            bowl.color = 'green'
                            bowl.updated_at = datetime.now()
                        
                        results['assigned'].append({
                            'bowl_code': bowl_code,
                            'customer': customer,
                            'dish_letter': dish_letter,
                            'color': 'green',
                            'type': 'single_customer'
                        })
                        
                    elif len(dish_bowls) == 1:
                        # Single customer - green assignment
                        for bowl in matching_bowls:
                            bowl.dish_letter = dish_letter
                            bowl.company = company
                            bowl.customer = customer
                            bowl.color = 'green'
                            bowl.updated_at = datetime.now()
                        
                        results['assigned'].append({
                            'bowl_code': bowl_code,
                            'customer': customer,
                            'dish_letter': dish_letter,
                            'color': 'green',
                            'type': 'single_customer'
                        })
                        
                    else:
                        # Multiple customers - red conflict
                        all_customers = []
                        for b in dish_bowls:
                            if b.customer and b.customer not in all_customers:
                                all_customers.append(b.customer)
                        
                        # Add current customer if not already listed
                        if customer not in all_customers:
                            all_customers.append(customer)
                        
                        customer_list = ", ".join(all_customers)
                        
                        for bowl in matching_bowls:
                            bowl.dish_letter = dish_letter
                            bowl.company = company
                            bowl.customer = customer_list
                            bowl.color = 'red'
                            bowl.updated_at = datetime.now()
                        
                        results['conflicts'].append({
                            'bowl_code': bowl_code,
                            'customers': customer_list,
                            'dish_letter': dish_letter,
                            'color': 'red',
                            'type': 'multiple_customers'
                        })
                    
                    results['processed_count'] += 1
                    
                except Exception as e:
                    results['errors'].append(f"Error processing bowl {bowl_code}: {str(e)}")
            
            # Log processing results
            self.processing_log.append({
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'processed': results['processed_count'],
                'assigned': len(results['assigned']),
                'conflicts': len(results['conflicts']),
                'errors': len(results['errors'])
            })
            
            return results
            
        except json.JSONDecodeError as e:
            return {
                'assigned': [],
                'conflicts': [],
                'errors': [f"Invalid JSON format: {str(e)}"],
                'processed_count': 0
            }
        except Exception as e:
            return {
                'assigned': [],
                'conflicts': [],
                'errors': [f"Processing error: {str(e)}"],
                'processed_count': 0
            }
    
    def get_processing_summary(self, results: dict) -> str:
        """Get human-readable summary of processing results"""
        summary = f"""
📊 JSON Processing Results:
✅ Successfully assigned: {len(results['assigned'])} bowls
⚠️  Multiple customers: {len(results['conflicts'])} bowls
❌ Errors: {len(results['errors'])}
📋 Total processed: {results['processed_count']}
"""
        return summary

# Test the file
if __name__ == "__main__":
    print("✅ json_processor.py loaded successfully!")
    processor = JSONProcessor()
    test_json = '[{"bowl_code": "TEST123", "company": "TestCo", "customer": "Test Customer", "dish_letter": "A"}]'
    results = processor.process_customer_data(test_json, [])
    print(f"Test processing: {results['processed_count']} items")
