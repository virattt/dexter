# Verify Keypair

Learn how to verify that a private key corresponds to a specific public key address in Solana.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Verify a Keypair
"""

from solders.keypair import Keypair
from solders.pubkey import Pubkey

def main():
    public_key = Pubkey.from_string("24PNhTaNtomHhoy3fTRaMhAFCRj4uHqhZEEoWrKDbR5p")
    
    keypair_bytes = bytes([
        174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56,
        222, 53, 138, 189, 224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246, 15,
        185, 186, 82, 177, 240, 148, 69, 241, 227, 167, 80, 141, 89, 240, 121, 121,
        35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109, 168, 89, 238, 135
    ])
    
    signer = Keypair.from_bytes(keypair_bytes)
    
    print(signer.pubkey() == public_key)

if __name__ == "__main__":
    main()
```

## Explanation

This example demonstrates how to verify that a private key matches a specific public key:

1. **Define Expected Public Key**: Create a `Pubkey` object from the expected address string
2. **Restore Keypair**: Reconstruct the keypair from the private key bytes
3. **Compare Public Keys**: Compare the derived public key with the expected one
4. **Return Result**: The comparison returns `True` if they match, `False` otherwise

## Key Concepts

- **Keypair Verification**: Confirming that a private key generates a specific public key
- **Public Key Derivation**: Every private key deterministically produces one public key
- **Address Validation**: Ensuring private keys match expected wallet addresses
- **Security Verification**: Confirming key integrity before use

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solders
   ```

2. Run the script:
   ```bash
   python verify_keypair.py
   ```

The output will be `True` if the private key matches the public key, `False` otherwise.

## Practical Applications

### Wallet Verification
```python
def verify_wallet_keypair(expected_address: str, private_key_bytes: bytes) -> bool:
    """Verify that a private key corresponds to an expected wallet address"""
    try:
        expected_pubkey = Pubkey.from_string(expected_address)
        keypair = Keypair.from_bytes(private_key_bytes)
        return keypair.pubkey() == expected_pubkey
    except Exception as e:
        print(f"Verification failed: {e}")
        return False
```

### Backup Verification
```python
def verify_backup_integrity(original_pubkey: Pubkey, backup_private_key: bytes) -> bool:
    """Verify that a backup private key can restore the original keypair"""
    try:
        restored_keypair = Keypair.from_bytes(backup_private_key)
        return restored_keypair.pubkey() == original_pubkey
    except Exception:
        return False
```

### Multi-Key Verification
```python
def verify_multiple_keypairs(key_pairs: list) -> dict:
    """Verify multiple keypair combinations"""
    results = {}
    
    for i, (address, private_key) in enumerate(key_pairs):
        try:
            expected_pubkey = Pubkey.from_string(address)
            keypair = Keypair.from_bytes(private_key)
            results[f"keypair_{i}"] = keypair.pubkey() == expected_pubkey
        except Exception as e:
            results[f"keypair_{i}"] = f"Error: {e}"
    
    return results
```

## Security Use Cases

- **Wallet Import**: Verify imported private keys match expected addresses
- **Backup Validation**: Confirm backup files contain correct private keys
- **Key Migration**: Ensure keys are correctly transferred between systems
- **Multi-signature Setup**: Verify all participant keys are correct

## Error Handling

```python
def safe_verify_keypair(public_key_str: str, private_key_bytes: bytes) -> bool:
    """Safely verify keypair with proper error handling"""
    try:
        public_key = Pubkey.from_string(public_key_str)
        keypair = Keypair.from_bytes(private_key_bytes)
        return keypair.pubkey() == public_key
    except ValueError as e:
        print(f"Invalid public key format: {e}")
        return False
    except Exception as e:
        print(f"Keypair verification failed: {e}")
        return False
```

## Best Practices

1. **Always Verify**: Verify keypairs before using them in transactions
2. **Handle Errors**: Use try-catch blocks for robust error handling
3. **Validate Input**: Ensure public key strings and private key bytes are valid
4. **Log Results**: Log verification results for debugging and auditing

Note: This example uses sample keys for demonstration. In production, use your actual private keys and expected addresses.