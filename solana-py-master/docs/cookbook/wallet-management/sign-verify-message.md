# Sign and Verify Message

Learn how to sign messages with a Solana keypair and verify message signatures for authentication and integrity verification.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Sign and Verify a Message
"""

from solders.keypair import Keypair
from solders.pubkey import Pubkey
import nacl.signing
import nacl.encoding

def main():
    # Create a keypair
    keypair = Keypair()
    message = b"Hello, Solana!"
    
    # Sign the message
    signature = keypair.sign_message(message)
    
    print(f"Message: {message}")
    print(f"Signature: {signature}")
    print(f"Public Key: {keypair.pubkey()}")
    
    # Verify the signature
    try:
        # Use nacl to verify the signature
        verify_key = nacl.signing.VerifyKey(keypair.pubkey().__bytes__())
        verify_key.verify(message, signature.__bytes__())
        print("Signature is valid: True")
    except Exception as e:
        print(f"Signature is valid: False - {e}")

if __name__ == "__main__":
    main()
```

## Explanation

This example demonstrates message signing and verification:

1. **Create Keypair**: Generate a new keypair for signing
2. **Define Message**: Create a message to sign (as bytes)
3. **Sign Message**: Use `keypair.sign_message()` to create a signature
4. **Verify Signature**: Use NaCl library to verify the signature's authenticity
5. **Handle Verification**: Catch exceptions if signature verification fails

## Key Concepts

- **Digital Signatures**: Cryptographic proof that a message was signed by a specific private key
- **Message Signing**: Creating a signature that proves ownership of a private key
- **Signature Verification**: Confirming that a signature was created by the holder of a private key
- **Ed25519 Signatures**: Solana uses Ed25519 elliptic curve signatures
- **Non-repudiation**: Signed messages provide proof of authenticity

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solders pynacl
   ```

2. Run the script:
   ```bash
   python sign_verify_message.py
   ```

The output will show the message, signature, public key, and verification result.

## Extended Examples

### Sign and Verify with Different Keys
```python
def demonstrate_signature_verification():
    """Demonstrate signature verification with different keypairs"""
    # Create signer keypair
    signer = Keypair()
    message = b"This is a test message"
    
    # Sign the message
    signature = signer.sign_message(message)
    
    # Verify with correct public key
    try:
        verify_key = nacl.signing.VerifyKey(signer.pubkey().__bytes__())
        verify_key.verify(message, signature.__bytes__())
        print("✓ Signature verified with correct public key")
    except:
        print("✗ Signature verification failed")
    
    # Try to verify with wrong public key
    wrong_keypair = Keypair()
    try:
        wrong_verify_key = nacl.signing.VerifyKey(wrong_keypair.pubkey().__bytes__())
        wrong_verify_key.verify(message, signature.__bytes__())
        print("✗ This should not happen - wrong key verified!")
    except:
        print("✓ Signature correctly rejected with wrong public key")
```

### Message Authentication Function
```python
def authenticate_message(message: bytes, signature: bytes, public_key: Pubkey) -> bool:
    """Authenticate a message with its signature and public key"""
    try:
        verify_key = nacl.signing.VerifyKey(public_key.__bytes__())
        verify_key.verify(message, signature)
        return True
    except Exception:
        return False

# Usage
keypair = Keypair()
message = b"Authenticate this message"
signature = keypair.sign_message(message)

is_authentic = authenticate_message(message, signature.__bytes__(), keypair.pubkey())
print(f"Message is authentic: {is_authentic}")
```

### Batch Message Verification
```python
def verify_multiple_messages(messages_and_signatures: list) -> dict:
    """Verify multiple message-signature pairs"""
    results = {}
    
    for i, (message, signature, public_key) in enumerate(messages_and_signatures):
        try:
            verify_key = nacl.signing.VerifyKey(public_key.__bytes__())
            verify_key.verify(message, signature)
            results[f"message_{i}"] = True
        except Exception as e:
            results[f"message_{i}"] = False
    
    return results
```

## Practical Applications

### User Authentication
```python
def authenticate_user(user_address: str, challenge: bytes, signature: bytes) -> bool:
    """Authenticate a user by verifying they signed a challenge"""
    try:
        public_key = Pubkey.from_string(user_address)
        verify_key = nacl.signing.VerifyKey(public_key.__bytes__())
        verify_key.verify(challenge, signature)
        return True
    except:
        return False
```

### Message Integrity
```python
def create_signed_message(keypair: Keypair, message: str) -> dict:
    """Create a signed message with metadata"""
    message_bytes = message.encode('utf-8')
    signature = keypair.sign_message(message_bytes)
    
    return {
        "message": message,
        "signature": signature.__bytes__().hex(),
        "public_key": str(keypair.pubkey()),
        "timestamp": int(time.time())
    }

def verify_signed_message(signed_message: dict) -> bool:
    """Verify a signed message with metadata"""
    try:
        message_bytes = signed_message["message"].encode('utf-8')
        signature = bytes.fromhex(signed_message["signature"])
        public_key = Pubkey.from_string(signed_message["public_key"])
        
        verify_key = nacl.signing.VerifyKey(public_key.__bytes__())
        verify_key.verify(message_bytes, signature)
        return True
    except:
        return False
```

## Security Considerations

1. **Message Format**: Always use bytes for message signing
2. **Signature Storage**: Store signatures securely and never reuse them
3. **Public Key Validation**: Always validate public keys before verification
4. **Replay Protection**: Include timestamps or nonces in messages
5. **Error Handling**: Properly handle verification failures

## Common Use Cases

- **Wallet Authentication**: Prove ownership of a wallet address
- **Message Integrity**: Ensure messages haven't been tampered with
- **API Authentication**: Authenticate API requests with signatures
- **Decentralized Identity**: Create cryptographic proof of identity
- **Smart Contract Interactions**: Sign off-chain messages for on-chain verification

## Error Handling

```python
def safe_sign_and_verify(keypair: Keypair, message: bytes) -> tuple:
    """Safely sign and verify a message with error handling"""
    try:
        signature = keypair.sign_message(message)
        
        verify_key = nacl.signing.VerifyKey(keypair.pubkey().__bytes__())
        verify_key.verify(message, signature.__bytes__())
        
        return True, signature
    except Exception as e:
        return False, f"Error: {e}"
```

Note: Message signing is different from transaction signing - it's used for authentication and integrity verification rather than blockchain transactions.