# Create Keypair

Learn how to create a new Solana keypair for wallet management and account operations.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Create a Keypair
"""

from solders.keypair import Keypair

def main():
    # Generate a new keypair
    keypair = Keypair()
    
    print(f"address: {keypair.pubkey()}")
    print(f"secret: {keypair.secret()}")

if __name__ == "__main__":
    main()
```

## Explanation

This example demonstrates the simplest way to create a new Solana keypair:

1. **Import Keypair**: Import the `Keypair` class from the `solders` library
2. **Generate Keypair**: Call `Keypair()` to create a new random keypair
3. **Access Public Key**: Use `keypair.pubkey()` to get the public address
4. **Access Secret Key**: Use `keypair.secret()` to get the private key bytes

## Key Concepts

- **Keypair**: A public-private key pair used for Solana account operations
- **Public Key**: The account address that can be safely shared
- **Private Key**: The secret key that must be kept secure and never shared
- **Cryptographic Security**: Uses Ed25519 elliptic curve cryptography
- **Random Generation**: Each keypair is cryptographically randomly generated

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solders
   ```

2. Run the script:
   ```bash
   python create_keypair.py
   ```

The output will show:
- **address**: The public key (account address)
- **secret**: The private key as bytes (keep this secure!)

## Security Considerations

- **Never share your private key**: Anyone with the private key has full control of the account
- **Store securely**: Save private keys in encrypted storage or hardware wallets
- **Backup safely**: Create secure backups of your keypairs
- **Generate offline**: For maximum security, generate keypairs on offline systems

## Use Cases

- **New Wallet Creation**: Generate fresh wallets for users
- **Testing**: Create temporary keypairs for development and testing
- **Account Management**: Generate keypairs for different purposes (trading, staking, etc.)
- **Multi-signature Setup**: Create multiple keypairs for multi-sig wallets

Note: This example generates a completely random keypair. For production use, ensure you have proper backup and recovery mechanisms in place.