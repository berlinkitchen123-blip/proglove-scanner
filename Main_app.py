# main_app.py - Simple text-based interface
from data_models import Bowl, ScannerSystem
from file_manager import FileManager
from scanner_operations import ScannerOperations
from json_processor import JSONProcessor
from analytics import Analytics
import json
from datetime import datetime

class ProGloveApp:
    def __init__(self):
        self.system = ScannerSystem()
        self.file_manager = FileManager()
        self.scanner = ScannerOperations()
        self.json_processor = JSONProcessor()
        self.analytics = Analytics()
        self.load_data()
    
    def load_data(self):
        """Load existing data"""
        data = self.file_manager.load_from_json()
        if 'bowls' in data:
            for bowl_data in data['bowls']:
                bowl = Bowl(
                    vyt_url=bowl_data['vyt_url'],
                    dish_letter=bowl_data.get('dish_letter', ''),
                    user=bowl_data.get('user', ''),
                    company=bowl_data.get('company', ''),
                    customer=bowl_data.get('customer', ''),
                    status=bowl_data.get('status', 'active')
                )
                bowl.color = bowl_data.get('color', 'black')
                self.system.bowls.append(bowl)
        
        if 'scan_history' in data:
            self.system.scan_history = data['scan_history']
        
        print(f"✅ Loaded {len(self.system.bowls)} bowls and {len(self.system.scan_history)} scan records")
    
    def save_data(self):
        """Save all data"""
        success = self.file_manager.save_to_json(self.system.bowls, self.system.scan_history)
        if success:
            print("💾 Data saved successfully!")
        return success
    
    def show_menu(self):
        """Display main menu"""
        print(f"""
🍱 PROGLOVE SCANNER SYSTEM
==========================
📊 Stats: {len(self.system.bowls)} total bowls | 
          {len([b for b in self.system.bowls if b.status=='active'])} active | 
          {len([b for b in self.system.bowls if b.status=='returned'])} returned

1. 📱 Scan Bowl (Kitchen/Return)
2. 👀 View All Bowls
3. 📊 Process Customer JSON
4. 🚨 Check Missing Bowls
5. 💾 Save Data
6. 🚪 Exit

Enter choice (1-6): """, end='')
    
    def run(self):
        """Main application loop"""
        print("🚀 ProGlove Scanner System Started!")
        
        while True:
            self.show_menu()
            choice = input().strip()
            
            if choice == '1':
                self.scan_bowl()
            elif choice == '2':
                self.view_bowls()
            elif choice == '3':
                self.process_json()
            elif choice == '4':
                self.check_missing_bowls()
            elif choice == '5':
                self.save_data()
            elif choice == '6':
                self.save_data()
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid choice. Please enter 1-6.")
    
    def scan_bowl(self):
        """Handle bowl scanning"""
        print("\n📱 BOWL SCANNING")
        print("=" * 30)
        
        vyt_code = input("Scan or enter VYT code: ").strip()
        if not vyt_code:
            print("❌ No code entered")
            return
        
        print("\nOperation types:")
        print("1. Kitchen Scan (New bowl)")
        print("2. Return Scan (Bowl return)")
        op_choice = input("Choose operation (1-2): ").strip()
        
        if op_choice == '1':
            operation = 'kitchen'
        elif op_choice == '2':
            operation = 'return'
        else:
            print("❌ Invalid operation choice")
            return
        
        user_name = input("Enter your name: ").strip()
        if not user_name:
            print("❌ User name required")
            return
        
        # Process the scan
        result = self.scanner.process_scan(vyt_code, operation, user_name, self.system.bowls)
        print(f"\n{result['message']}")
        
        if result['success']:
            # Add to scan history
            self.system.scan_history.append({
                'bowl_code': result.get('bowl_code', ''),
                'operation': operation,
                'user': user_name,
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
    
    def view_bowls(self):
        """Display all bowls"""
        print(f"\n👀 ALL BOWLS ({len(self.system.bowls)} total)")
        print("=" * 80)
        
        if not self.system.bowls:
            print("No bowls found. Start scanning!")
            return
        
        # Group by status
        for status in ['active', 'returned']:
            status_bowls = [b for b in self.system.bowls if b.status == status]
            if status_bowls:
                print(f"\n{status.upper()} BOWLS ({len(status_bowls)}):")
                print("-" * 40)
                
                for bowl in status_bowls[:20]:  # Show first 20
                    code = bowl.vyt_url.split('/')[-1]
                    customer_display = bowl.customer
                    if bowl.color == 'red':
                        customer_display = f"🚨 {customer_display}"
                    elif bowl.color == 'green':
                        customer_display = f"✅ {customer_display}"
                    
                    print(f"• {code} | {bowl.dish_letter} | {bowl.company} | {customer_display} | {bowl.user}")
                
                if len(status_bowls) > 20:
                    print(f"... and {len(status_bowls) - 20} more")
        
        input("\nPress Enter to continue...")
    
    def process_json(self):
        """Process customer JSON data"""
        print("\n📊 PROCESS CUSTOMER JSON")
        print("=" * 40)
        print("Paste JSON data (format: [{{'bowl_code': 'ABC123', 'company': 'X', 'customer': 'Y', 'dish_letter': 'A'}}]")
        print("Enter JSON data (press Enter twice to finish):")
        
        lines = []
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
        
        json_input = "\n".join(lines)
        if not json_input.strip():
            print("❌ No JSON data provided")
            return
        
        # Add current date to customer data for tracking
        try:
            customer_data = json.loads(json_input)
            today = datetime.now().strftime("%Y-%m-%d")
            for item in customer_data:
                if 'assigned_date' not in item:
                    item['assigned_date'] = today
        except:
            pass
        
        # Process the JSON
        results = self.json_processor.process_customer_data(json_input, self.system.bowls)
        summary = self.json_processor.get_processing_summary(results)
        print(summary)
        
        # Save after processing
        self.save_data()
    
    def check_missing_bowls(self):
        """Check for missing bowls from customers"""
        print("\n🚨 CHECK MISSING BOWLS")
        print("=" * 40)
        
        # Get active bowls
        active_bowls = [b for b in self.system.bowls if b.status == 'active']
        
        if not active_bowls:
            print("❌ No active bowls found")
            return
        
        # We need customer JSON data to compare
        print("Paste current customer assignment JSON:")
        print("Enter JSON data (press Enter twice to finish):")
        
        lines = []
        while True:
            line = input()
            if line == "":
                break
            lines.append(line)
        
        json_input = "\n".join(lines)
        if not json_input.strip():
            print("❌ No customer data provided")
            return
        
        try:
            customer_data = json.loads(json_input)
        except Exception as e:
            print(f"❌ Invalid JSON: {e}")
            return
        
        # Track missing bowls
        missing_result = self.analytics.track_missing_bowls(active_bowls, customer_data)
        display_text = self.analytics.get_missing_summary_display(missing_result)
        print(display_text)
        
        # Show urgent alerts
        urgent_alerts = self.analytics.get_urgent_alerts(missing_result)
        if urgent_alerts:
            print("\n🔴 URGENT ALERTS:")
            for alert in urgent_alerts:
                print(f"• {alert['bowl_code']} - {alert['customer']} - {alert['days_overdue']} days overdue - {alert['priority']} PRIORITY")

# Run the application
if __name__ == "__main__":
    app = ProGloveApp()
    app.run()
