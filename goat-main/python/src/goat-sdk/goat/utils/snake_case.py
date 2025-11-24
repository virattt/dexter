import re

def snake_case(string: str) -> str:
    """Convert a string from camelCase to snake_case."""
    return re.sub(r'([a-z])([A-Z])', r'\1_\2', string).lower() 