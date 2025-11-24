# Restore Keypair

Learn how to restore a Solana keypair from existing private key bytes for wallet recovery operations.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Restore a Keypair
"""

from solders.keypair import Keypair

def main():
    keypair_bytes = bytes([
        174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56,
        222, 53, 138, 189, 224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246, 15,
        185, 186, 82, 177, 240, 148, 69, 241, 227, 167, 80, 141, 89, 240, 121, 121,
        35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109, 168, 89, 238, 135
    ])
    
    signer = Keypair.from_bytes(keypair_bytes)
    print(signer.pubkey())

if __name__ == "__main__":
    main()
```

## Explanation

This example demonstrates how to restore a keypair from existing private key bytes:

1. **Define Private Key**: Create a bytes array containing the 64-byte private key
2. **Restore Keypair**: Use `Keypair.from_bytes()` to reconstruct the keypair
3. **Access Public Key**: The restored keypair provides access to the public key
4. **Verify Restoration**: Print the public key to verify successful restoration

## Key Concepts

- **Keypair Restoration**: Rebuilding a keypair from stored private key bytes
- **Private Key Format**: Solana private keys are 64 bytes (32 bytes seed + 32 bytes public key)
- **Deterministic Recovery**: Same private key bytes always produce the same keypair
- **Wallet Recovery**: Essential for restoring access to existing accounts

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solders
   ```

2. Run the script:
   ```bash
   python restore_keypair.py
   ```

The output will show the public key address corresponding to the restored keypair.

## Common Use Cases

### From File Storage
```python
# Read private key from file
with open('private_key.txt', 'rb') as f:
    private_key_bytes = f.read()
    
keypair = Keypair.from_bytes(private_key_bytes)
```

### From Base58 String
```python
import base58

# Convert from base58 string format
private_key_string = "your_base58_private_key_here"
private_key_bytes = base58.b58decode(private_key_string)
keypair = Keypair.from_bytes(private_key_bytes)
```

### From Environment Variable
```python
import os
import base58

# Load from environment variable
private_key_env = os.getenv('SOLANA_PRIVATE_KEY')
if private_key_env:
    private_key_bytes = base58.b58decode(private_key_env)
    keypair = Keypair.from_bytes(private_key_bytes)
```

## Security Considerations

- **Secure Storage**: Never store private keys in plain text
- **Environment Variables**: Use secure environment variables for production
- **File Permissions**: Ensure private key files have restricted permissions
- **Backup Verification**: Always verify restored keypairs match expected addresses

## Error Handling

```python
try:
    keypair = Keypair.from_bytes(keypair_bytes)
    print(f"Successfully restored keypair: {keypair.pubkey()}")
except Exception as e:
    print(f"Failed to restore keypair: {e}")
```

Note: The example shows a sample private key for demonstration. Never use this key for actual transactions as it's publicly visible.