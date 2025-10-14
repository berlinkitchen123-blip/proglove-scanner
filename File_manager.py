# file_manager.py - Complete standalone file
import json
import pandas as pd
from datetime import datetime
import os

class FileManager:
    def __init__(self, data_file="proglove_data.json"):
        self.data_file = data_file
    
    def save_to_json(self, bowls: list, scan_history: list) -> bool:
        try:
            data = {
                'bowls': [bowl.to_dict() if hasattr(bowl, 'to_dict') else bowl for bowl in bowls],
                'scan_history': scan_history,
                'last_saved': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            with open(self.data_file, 'w') as f:
                json.dump(data, f, indent=2)
            print("✅ Data saved successfully!")
            return True
        except Exception as e:
            print(f"❌ Error saving data: {e}")
            return False
    
    def load_from_json(self):
        try:
            if not os.path.exists(self.data_file):
                print("⚠️  No existing data file found.")
                return {'bowls': [], 'scan_history': []}
            
            with open(self.data_file, 'r') as f:
                data = json.load(f)
            print("✅ Data loaded successfully!")
            return data
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return {'bowls': [], 'scan_history': []}
    
    def export_to_excel(self, bowls: list, filename: str = "proglove_export.xlsx"):
        try:
            if not bowls:
                print("❌ No data to export")
                return False
            
            # Convert to DataFrame
            bowl_data = [bowl.to_dict() if hasattr(bowl, 'to_dict') else bowl for bowl in bowls]
            df = pd.DataFrame(bowl_data)
            
            # Create Excel file with multiple sheets by status
            with pd.ExcelWriter(filename, engine='openpyxl') as writer:
                for status in ['active', 'prepared', 'returned']:
                    status_df = df[df['status'] == status]
                    status_df.to_excel(writer, sheet_name=status.capitalize(), index=False)
            
            print(f"✅ Excel file exported: {filename}")
            return True
        except Exception as e:
            print(f"❌ Error exporting to Excel: {e}")
            return False

# Test the file
if __name__ == "__main__":
    print("✅ file_manager.py loaded successfully!")
    fm = FileManager()
    fm.save_to_json([], [])
