import csv
import json
from pathlib import Path
from typing import Dict, List, Any


class DataLoader:
    """Loads CSV data and returns it as a list of objects (one per row)."""
    
    def __init__(self, csv_path: str | Path):
        """
        Initialize the DataLoader with a path to the CSV file.
        
        Args:
            csv_path: Path to the CSV file to load
        """
        self.csv_path = Path(csv_path)
    
    def load(self) -> List[Dict[str, Any]]:
        """
        Load the CSV file and return it as a list of dictionaries, where each
        dictionary represents a row with column names as keys.
        
        Returns:
            List of dictionaries, each representing a row from the CSV
            
        Raises:
            FileNotFoundError: If the CSV file doesn't exist
            ValueError: If the CSV file is empty or malformed
        """
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {self.csv_path}")
        
        data: List[Dict[str, Any]] = []
        
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Get column names from the header
            if not reader.fieldnames:
                raise ValueError("CSV file appears to be empty or has no header row")
            
            # Read rows and append each row as a dictionary
            for row in reader:
                data.append(dict(row))
        
        return data
    
    def load_json(self) -> str:
        """
        Load the CSV file and return it as a JSON string.
        
        Returns:
            JSON string representation of the CSV data
        """
        data = self.load()
        return json.dumps(data, indent=2, ensure_ascii=False)


if __name__ == "__main__":
  # 
  loader = DataLoader("src/dexter/evals/data/vals-finance-agent-50.csv")
  data = loader.load()
  print(data)