# src/solana_agentkit/utils/json_utils.py

from typing import Any, Dict, Union
import json
import re

def to_json(input_str: str) -> Dict[str, Any]:
    """
    Convert a string representation of key-value pairs to a JSON object.
    
    Args:
        input_str: String containing key-value pairs in format "{key: value, key2: value2}"
        
    Returns:
        Dictionary of parsed values
        
    Raises:
        ValueError: If string cannot be parsed
    """
    try:
        # Clean and validate input
        input_str = input_str.strip()
        if not (input_str.startswith('{') and input_str.endswith('}')):
            raise ValueError("Input must be enclosed in curly braces")
            
        # Remove outer braces and split by comma
        content = input_str[1:-1].strip()
        if not content:
            return {}
            
        # Split into pairs while handling potential commas within values
        pairs = []
        current_pair = []
        in_quotes = False
        quote_char = None
        
        for char in content + ',':
            if char in '"\'':
                if not in_quotes:
                    in_quotes = True
                    quote_char = char
                elif char == quote_char:
                    in_quotes = False
            elif char == ',' and not in_quotes:
                if current_pair:
                    pairs.append(''.join(current_pair).strip())
                    current_pair = []
                continue
            current_pair.append(char)
        
        # Process each key-value pair
        result = {}
        for pair in pairs:
            # Split by first colon
            key_value = pair.split(':', 1)
            if len(key_value) != 2:
                raise ValueError(f"Invalid key-value pair: {pair}")
                
            key = key_value[0].strip().strip('"\'')
            value = key_value[1].strip().strip('"\'')
            
            # Convert value to appropriate type
            try:
                # Try to convert to number if possible
                if '.' in value:
                    value = float(value)
                else:
                    value = int(value)
            except ValueError:
                # If not a number, keep as string but handle special values
                value = value.lower()
                if value == 'true':
                    value = True
                elif value == 'false':
                    value = False
                elif value == 'null':
                    value = None
            
            result[key] = value
            
        return result
        
    except Exception as error:
        raise ValueError(f"Failed to parse string to JSON: {str(error)}") from error

def parse_json_safely(input_str: Union[str, Dict]) -> Dict[str, Any]:
    """
    Safely parse a string that might be either JSON or key-value pairs.
    
    Args:
        input_str: String to parse or dictionary to validate
        
    Returns:
        Parsed dictionary
        
    Raises:
        ValueError: If input cannot be parsed
    """
    if isinstance(input_str, dict):
        return input_str
        
    try:
        # First try standard JSON parsing
        return json.loads(input_str)
    except json.JSONDecodeError:
        # If that fails, try our custom parser
        return to_json(input_str)

def is_valid_json_string(input_str: str) -> bool:
    """
    Check if a string is valid JSON or key-value pairs.
    
    Args:
        input_str: String to validate
        
    Returns:
        True if valid, False otherwise
    """
    try:
        parse_json_safely(input_str)
        return True
    except Exception:
        return False

# Example usage and test cases
def _run_tests():
    """Run test cases for JSON parsing."""
    test_cases = [
        '{key: 123, name: "test"}',
        '{count: 42.5, active: true}',
        '{items: null, enabled: false}',
        '{"quoted": "value", unquoted: 123}',
        '{nested: {key: "value"}}',
        '{}'  # Empty object
    ]
    
    for test in test_cases:
        try:
            result = to_json(test)
            print(f"Input: {test}")
            print(f"Output: {result}\n")
        except ValueError as e:
            print(f"Error parsing {test}: {e}\n")

if __name__ == "__main__":
    _run_tests()