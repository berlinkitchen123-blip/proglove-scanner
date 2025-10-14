# scanner_operations.py - Complete standalone file
from datetime import datetime
import re

class ScannerOperations:
    def __init__(self):
        self.operations_log = []
    
    def extract_bowl_code(self, vyt_url: str) -> str:
        """Extract bowl code from VYT URL"""
        try:
            vyt_url = vyt_url.upper().strip()
            
            # Handle different URL formats
            if 'VYT.TO/' in vyt_url:
                return vyt_url.split('VYT.TO/')[1]
            elif vyt_url.startswith('HTTP'):
                parts = vyt_url.split('/')
                return parts[-1]
            else:
                # Assume it's already just the code
                return vyt_url
        except Exception as e:
            print(f"❌ Error extracting bowl code: {e}")
            return ""
    
    def validate_vyt_code(self, vyt_code: str) -> bool:
        """Validate VYT code format"""
        if not vyt_code:
            return False
        
        # Check if it's a URL or just code
        code = self.extract_bowl_code(vyt_code)
        if not code:
            return False
        
        # Basic validation - alphanumeric, 3-10 characters
        if re.match(r'^[A-Z0-9]{3,10}$', code):
            return True
        return False
    
    def check_duplicate(self, bowl_code: str, bowls: list, operation_type: str) -> dict:
        """Check for duplicate operations"""
        bowl_code = bowl_code.upper()
        
        for bowl in bowls:
            existing_code = self.extract_bowl_code(bowl.vyt_url)
            if existing_code == bowl_code:
                if operation_type == "kitchen" and bowl.status == "active":
                    return {
                        'is_duplicate': True,
                        'message': f"⚠️ Bowl {bowl_code} is already ACTIVE (scanned by {bowl.user})",
                        'bowl': bowl
                    }
                elif operation_type == "return" and bowl.status == "returned":
                    return {
                        'is_duplicate': True,
                        'message': f"⚠️ Bowl {bowl_code} is already RETURNED",
                        'bowl': bowl
                    }
                elif operation_type == "return" and bowl.status == "active":
                    return {
                        'is_duplicate': True,
                        'message': f"❌ Bowl {bowl_code} is ACTIVE but not prepared yet",
                        'bowl': bowl
                    }
        
        return {'is_duplicate': False, 'message': "✅ New bowl - ready to process"}
    
    def process_scan(self, vyt_code: str, operation_type: str, user: str, bowls: list):
        """Process a scan operation"""
        from data_models import Bowl
        
        # Validate input
        if not self.validate_vyt_code(vyt_code):
            return {'success': False, 'message': '❌ Invalid VYT code format'}
        
        if not user.strip():
            return {'success': False, 'message': '❌ Please enter user name'}
        
        bowl_code = self.extract_bowl_code(vyt_code)
        vyt_url = f"HTTP://VYT.TO/{bowl_code}"
        
        # Check for duplicates
        duplicate_check = self.check_duplicate(bowl_code, bowls, operation_type)
        if duplicate_check['is_duplicate']:
            return {'success': False, 'message': duplicate_check['message']}
        
        # Process the scan
        timestamp = datetime.now()
        
        if operation_type == "kitchen":
            # Create new bowl for kitchen scan
            new_bowl = Bowl(
                vyt_url=vyt_url,
                user=user,
                status="active"
            )
            bowls.append(new_bowl)
            message = f"✅ Bowl {bowl_code} marked as ACTIVE by {user}"
            
        elif operation_type == "return":
            # For return scan, bowl must exist and be prepared
            existing_bowl = duplicate_check.get('bowl')
            if existing_bowl and existing_bowl.status == "prepared":
                existing_bowl.status = "returned"
                existing_bowl.updated_at = timestamp
                existing_bowl.user = user
                message = f"✅ Bowl {bowl_code} marked as RETURNED by {user}"
            else:
                return {'success': False, 'message': f"❌ Cannot return bowl {bowl_code} - not found in prepared bowls"}
        
        # Log the operation
        self.operations_log.append({
            'bowl_code': bowl_code,
            'operation': operation_type,
            'user': user,
            'timestamp': timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })
        
        return {'success': True, 'message': message, 'bowl_code': bowl_code}

# Test the file
if __name__ == "__main__":
    print("✅ scanner_operations.py loaded successfully!")
    scanner = ScannerOperations()
    test_code = scanner.extract_bowl_code("HTTP://VYT.TO/ABC123")
    print(f"Test code extraction: {test_code}")
