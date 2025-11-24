# Validate Public Key

Learn how to validate Solana public keys to ensure they are properly formatted and cryptographically valid.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Validate a Public Key
"""

from solders.pubkey import Pubkey

def main():
    # on curve address
    key = Pubkey.from_string("5oNDL3swdJJF1g9DzJiZ4ynHXgszjAEpUkxVYejchzrY")
    print(key.is_on_curve())
    
    off_curve_address = Pubkey.from_string("4BJXYkfvg37zEmBbsacZjeQDpTNx91KppxFJxRqrz48e")
    print(off_curve_address.is_on_curve())

if __name__ == "__main__":
    main()
```

## Explanation

This example demonstrates how to validate Solana public keys:

1. **Create Public Key**: Use `Pubkey.from_string()` to create a public key from a string
2. **Check Curve Validity**: Use `is_on_curve()` to verify if the key is on the Ed25519 curve
3. **Validate Different Keys**: Test both valid and invalid public keys
4. **Return Results**: The method returns `True` for valid keys, `False` for invalid ones

## Key Concepts

- **Ed25519 Curve**: Solana uses Ed25519 elliptic curve cryptography
- **On-Curve Validation**: Public keys must be valid points on the Ed25519 curve
- **Off-Curve Keys**: Some addresses may be valid base58 strings but not valid curve points
- **Cryptographic Validity**: Different from format validation - checks mathematical validity

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solders
   ```

2. Run the script:
   ```bash
   python validate_public_key.py
   ```

The output will show:
- `True` for the first key (valid curve point)
- `False` for the second key (off-curve address)

## Extended Validation Function

```python
def validate_public_key_comprehensive(address: str) -> dict:
    """Comprehensive public key validation with detailed results"""
    result = {
        "address": address,
        "is_valid_format": False,
        "is_on_curve": False,
        "validation_error": None
    }
    
    try:
        # Check if the address can be parsed as a public key
        pubkey = Pubkey.from_string(address)
        result["is_valid_format"] = True
        
        # Check if it's on the Ed25519 curve
        result["is_on_curve"] = pubkey.is_on_curve()
        
    except ValueError as e:
        result["validation_error"] = f"Invalid format: {e}"
    except Exception as e:
        result["validation_error"] = f"Validation error: {e}"
    
    return result

# Usage example
addresses_to_test = [
    "5oNDL3swdJJF1g9DzJiZ4ynHXgszjAEpUkxVYejchzrY",  # Valid on-curve
    "4BJXYkfvg37zEmBbsacZjeQDpTNx91KppxFJxRqrz48e",  # Valid format, off-curve
    "invalid_address",  # Invalid format
    "11111111111111111111111111111111"  # System program (on-curve)
]

for address in addresses_to_test:
    result = validate_public_key_comprehensive(address)
    print(f"Address: {address[:20]}...")
    print(f"  Valid format: {result['is_valid_format']}")
    print(f"  On curve: {result['is_on_curve']}")
    if result['validation_error']:
        print(f"  Error: {result['validation_error']}")
    print()
```

## Common Use Cases

### Input Validation
```python
def is_valid_solana_address(address: str) -> bool:
    """Check if a string is a valid Solana address"""
    try:
        pubkey = Pubkey.from_string(address)
        return pubkey.is_on_curve()
    except:
        return False
```

### Program Derived Address (PDA) Validation
```python
def validate_pda(address: str) -> bool:
    """Validate Program Derived Address (should be off-curve)"""
    try:
        pubkey = Pubkey.from_string(address)
        return not pubkey.is_on_curve()  # PDAs are off-curve
    except:
        return False
```

### Batch Validation
```python
def validate_multiple_addresses(addresses: list) -> dict:
    """Validate multiple addresses at once"""
    results = {}
    
    for address in addresses:
        try:
            pubkey = Pubkey.from_string(address)
            results[address] = {
                "valid": True,
                "on_curve": pubkey.is_on_curve()
            }
        except Exception as e:
            results[address] = {
                "valid": False,
                "error": str(e)
            }
    
    return results
```

## Key Differences

- **On-Curve Keys**: Can be used for signing transactions (normal wallet addresses)
- **Off-Curve Keys**: Cannot sign but can receive tokens (Program Derived Addresses)
- **Format Validation**: Checks if the string is valid base58 and correct length
- **Cryptographic Validation**: Checks if the key is a valid point on the Ed25519 curve

## Security Considerations

1. **Always Validate**: Validate public keys before using them in transactions
2. **Handle Errors**: Wrap validation in try-catch blocks
3. **User Input**: Validate all user-provided addresses
4. **PDA Handling**: Remember that PDAs are intentionally off-curve

## Error Types

- **Format Errors**: Invalid base58 encoding or incorrect length
- **Curve Validation**: Valid format but not on the Ed25519 curve
- **Parsing Errors**: Cannot be converted to a `Pubkey` object

Note: Off-curve addresses are not necessarily invalid - they may be Program Derived Addresses that are intentionally off-curve for security reasons.