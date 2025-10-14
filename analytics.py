# analytics.py - Complete standalone file for tracking missing bowls
from datetime import datetime, timedelta
from collections import defaultdict

class Analytics:
    def __init__(self):
        self.missing_reports = []
    
    def track_missing_bowls(self, active_bowls: list, customer_json_data: list) -> dict:
        """Track bowls that should be returned but are still active"""
        try:
            # Process customer data from JSON
            customer_assignments = {}
            for customer in customer_json_data:
                bowl_code = str(customer.get('bowl_code', '')).upper().strip()
                company = str(customer.get('company', '')).strip()
                customer_name = str(customer.get('customer', '')).strip()
                dish_letter = str(customer.get('dish_letter', '')).upper().strip()
                assigned_date = customer.get('assigned_date', datetime.now().strftime("%Y-%m-%d"))
                
                if bowl_code and customer_name:
                    customer_assignments[bowl_code] = {
                        'company': company,
                        'customer_name': customer_name,
                        'dish_letter': dish_letter,
                        'assigned_date': assigned_date
                    }
            
            # Find missing bowls (assigned to customers but still active)
            missing_bowls = []
            today = datetime.now().date()
            
            for bowl in active_bowls:
                bowl_code = bowl.vyt_url.split('/')[-1]
                
                if bowl_code in customer_assignments:
                    customer_info = customer_assignments[bowl_code]
                    
                    # Calculate how long overdue
                    try:
                        assigned_date = datetime.strptime(customer_info['assigned_date'], "%Y-%m-%d").date()
                        days_overdue = (today - assigned_date).days
                    except:
                        days_overdue = 1  # Default to 1 day if date parsing fails
                    
                    # Only consider bowls overdue by at least 1 day
                    if days_overdue >= 1:
                        missing_bowls.append({
                            'bowl_code': bowl_code,
                            'vyt_url': bowl.vyt_url,
                            'company': customer_info['company'],
                            'customer_name': customer_info['customer_name'],
                            'dish_letter': customer_info['dish_letter'],
                            'assigned_date': customer_info['assigned_date'],
                            'days_overdue': days_overdue,
                            'assigned_to': bowl.user,
                            'status': 'MISSING'
                        })
            
            # Sort by days overdue (most critical first)
            missing_bowls.sort(key=lambda x: x['days_overdue'], reverse=True)
            
            # Generate summary
            summary = {
                'total_missing': len(missing_bowls),
                'by_company': defaultdict(int),
                'by_days_overdue': defaultdict(int),
                'critical_cases': 0
            }
            
            for bowl in missing_bowls:
                summary['by_company'][bowl['company']] += 1
                
                days = bowl['days_overdue']
                if days <= 2:
                    summary['by_days_overdue']['1-2 days'] += 1
                elif days <= 5:
                    summary['by_days_overdue']['3-5 days'] += 1
                elif days <= 10:
                    summary['by_days_overdue']['6-10 days'] += 1
                else:
                    summary['by_days_overdue']['10+ days'] += 1
                    summary['critical_cases'] += 1
            
            result = {
                'success': True,
                'missing_bowls': missing_bowls,
                'summary': summary,
                'total_customers_checked': len(customer_assignments),
                'report_date': today.strftime("%Y-%m-%d")
            }
            
            # Save this report
            self.missing_reports.append({
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'missing_count': len(missing_bowls),
                'critical_cases': summary['critical_cases']
            })
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Error tracking missing bowls: {str(e)}",
                'missing_bowls': [],
                'summary': {}
            }
    
    def get_missing_summary_display(self, missing_data: dict) -> str:
        """Create display-friendly summary of missing bowls"""
        if not missing_data['success']:
            return f"❌ Error: {missing_data['error']}"
        
        summary = missing_data['summary']
        missing_bowls = missing_data['missing_bowls']
        
        if not missing_bowls:
            return "✅ EXCELLENT! No missing bowls found. All assigned bowls have been returned."
        
        display_text = f"""
🚨 MISSING BOWLS REPORT - {missing_data['report_date']}
============================================

📊 SUMMARY:
• Total Missing: {summary['total_missing']} bowls
• Critical Cases (10+ days): {summary['critical_cases']}
• Customers Checked: {missing_data['total_customers_checked']}

🏢 BY COMPANY:
"""
        
        for company, count in summary['by_company'].items():
            if company:
                display_text += f"• {company}: {count} missing\n"
            else:
                display_text += f"• Unknown Company: {count} missing\n"
        
        display_text += "\n⏰ BY OVERDUE TIME:\n"
        for period, count in summary['by_days_overdue'].items():
            display_text += f"• {period}: {count} bowls\n"
        
        display_text += "\n🔍 DETAILED LIST (Most Critical First):\n"
        display_text += "=" * 50 + "\n"
        
        for i, bowl in enumerate(missing_bowls[:10], 1):  # Show top 10 most critical
            status_icon = "🔴" if bowl['days_overdue'] > 10 else "🟡" if bowl['days_overdue'] > 5 else "🟠"
            
            display_text += f"""
{i}. {status_icon} {bowl['bowl_code']}
   Customer: {bowl['customer_name']}
   Company: {bowl['company']} | Dish: {bowl['dish_letter']}
   Assigned: {bowl['assigned_date']} | Overdue: {bowl['days_overdue']} days
   Last User: {bowl['assigned_to']}
"""
        
        if len(missing_bowls) > 10:
            display_text += f"\n... and {len(missing_bowls) - 10} more missing bowls\n"
        
        return display_text
    
    def get_urgent_alerts(self, missing_data: dict) -> list:
        """Get urgent alerts for critical missing bowls"""
        if not missing_data['success'] or not missing_data['missing_bowls']:
            return []
        
        urgent_alerts = []
        for bowl in missing_data['missing_bowls']:
            if bowl['days_overdue'] >= 7:  # 1 week or more
                urgent_alerts.append({
                    'bowl_code': bowl['bowl_code'],
                    'customer': bowl['customer_name'],
                    'company': bowl['company'],
                    'days_overdue': bowl['days_overdue'],
                    'priority': 'HIGH' if bowl['days_overdue'] > 10 else 'MEDIUM'
                })
        
        return urgent_alerts

# Test the file
if __name__ == "__main__":
    print("✅ analytics.py loaded successfully!")
    analytics = Analytics()
    
    # Test with sample data
    test_active_bowls = []
    test_customer_data = [
        {
            'bowl_code': 'TEST123',
            'company': 'Test Company',
            'customer': 'Test Customer',
            'dish_letter': 'A',
            'assigned_date': '2024-01-01'
        }
    ]
    
    result = analytics.track_missing_bowls(test_active_bowls, test_customer_data)
    print(f"Test analytics: {result['success']}")
