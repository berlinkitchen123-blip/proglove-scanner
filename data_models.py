# data_models.py - Complete standalone file
from datetime import datetime
from typing import List, Optional

class Bowl:
    def __init__(self, vyt_url: str, dish_letter: str = "", user: str = "", 
                 company: str = "", customer: str = "", status: str = "active"):
        self.vyt_url = vyt_url.upper().strip()
        self.dish_letter = dish_letter.upper().strip()
        self.user = user.strip()
        self.company = company.strip()
        self.customer = customer.strip()
        self.status = status.lower().strip()
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.color = "black"
    
    def to_dict(self):
        return {
            'vyt_url': self.vyt_url,
            'dish_letter': self.dish_letter,
            'user': self.user,
            'company': self.company,
            'customer': self.customer,
            'status': self.status,
            'color': self.color,
            'created_at': self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            'updated_at': self.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        }

class ScannerSystem:
    def __init__(self):
        self.bowls: List[Bowl] = []
        self.scan_history = []
    
    def find_bowl_by_code(self, bowl_code: str) -> Optional[Bowl]:
        bowl_code = bowl_code.upper().strip()
        for bowl in self.bowls:
            if bowl.vyt_url.endswith(bowl_code):
                return bowl
        return None
    
    def get_bowls_by_status(self, status: str) -> List[Bowl]:
        return [bowl for bowl in self.bowls if bowl.status == status]
    
    def get_statistics(self) -> dict:
        active = len([b for b in self.bowls if b.status == 'active'])
        prepared = len([b for b in self.bowls if b.status == 'prepared'])
        returned = len([b for b in self.bowls if b.status == 'returned'])
        
        return {
            'total': len(self.bowls),
            'active': active,
            'prepared': prepared,
            'returned': returned
        }

# Test the file
if __name__ == "__main__":
    print("✅ data_models.py loaded successfully!")
    test_bowl = Bowl("HTTP://VYT.TO/ABC123", "A", "John", "CompanyA", "Customer1")
    print(f"Test bowl created: {test_bowl.vyt_url}")
