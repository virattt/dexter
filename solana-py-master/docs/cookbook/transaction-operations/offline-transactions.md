# Offline Transactions

Learn how to create, sign, and send Solana transactions in an offline environment, useful for security-sensitive operations.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - Offline Transactions

To complete an offline transaction:
1. Create Transaction
2. Sign Transaction  
3. Recover Transaction
4. Send Transaction
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.hash import Hash
import nacl.signing
import nacl.encoding
import base58

async def main():
    # Create connection
    connection = AsyncClient("http://localhost:8899")
    
    # Create an example tx, alice transfer to bob and feePayer is `fee_payer`
    # alice and fee_payer are signers in this tx
    fee_payer = Keypair()
    
    # Airdrop to fee_payer
    airdrop_resp = await connection.request_airdrop(fee_payer.pubkey(), 1_000_000_000)
    await connection.confirm_transaction(airdrop_resp.value)
    
    alice = Keypair()
    # Airdrop to alice
    airdrop_resp = await connection.request_airdrop(alice.pubkey(), 1_000_000_000)
    await connection.confirm_transaction(airdrop_resp.value)
    
    bob = Keypair()
    
    # 1. Create Transaction
    transfer_instruction = transfer(
        TransferParams(
            from_pubkey=alice.pubkey(),
            to_pubkey=bob.pubkey(),
            lamports=int(0.1 * 1_000_000_000)  # 0.1 SOL
        )
    )
    
    # Get recent blockhash
    recent_blockhash_resp = await connection.get_latest_blockhash()
    recent_blockhash = recent_blockhash_resp.value.blockhash
    
    # Create message
    message = MessageV0.try_compile(
        payer=fee_payer.pubkey(),
        instructions=[transfer_instruction],
        address_lookup_table_accounts=[],
        recent_blockhash=recent_blockhash
    )
    
    # 2. Sign Transaction (offline)
    # This can be done offline with saved private keys
    transaction = VersionedTransaction(message, [fee_payer, alice])
    
    # 3. Serialize transaction for offline storage/transmission
    serialized_tx = bytes(transaction)
    print(f"Serialized transaction length: {len(serialized_tx)} bytes")
    
    # 4. Recover Transaction (from serialized data)
    # This simulates loading a transaction from offline storage
    recovered_transaction = VersionedTransaction.from_bytes(serialized_tx)
    
    # 5. Send Transaction (online)
    async with connection:
        try:
            signature = await connection.send_transaction(recovered_transaction)
            print(f"Transaction sent with signature: {signature.value}")
            
            # Confirm transaction
            await connection.confirm_transaction(signature.value)
            print("Transaction confirmed")
            
        except Exception as e:
            print(f"Error sending transaction: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates the offline transaction workflow:

1. **Create Transaction**: Build the transaction with all necessary instructions
2. **Sign Transaction**: Sign with private keys (can be done offline)
3. **Serialize Transaction**: Convert to bytes for storage or transmission
4. **Recover Transaction**: Deserialize the transaction bytes
5. **Send Transaction**: Submit to the network when online

## Key Concepts

- **Offline Signing**: Signing transactions without network connectivity
- **Transaction Serialization**: Converting transactions to bytes for storage
- **Security Benefits**: Private keys never exposed to online environments
- **Cold Storage**: Keeping signing keys on offline devices
- **Transaction Recovery**: Reconstructing transactions from serialized data

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders nacl
   ```

2. Start a local Solana validator:
   ```bash
   solana-test-validator
   ```

3. Run the script:
   ```bash
   python offline_transactions.py
   ```

## Offline Workflow

### Step 1: Online (Preparation)
- Get recent blockhash
- Prepare transaction instructions
- Export transaction template

### Step 2: Offline (Signing)
- Load private keys from secure storage
- Sign the transaction
- Save signed transaction

### Step 3: Online (Broadcasting)
- Load signed transaction
- Send to network
- Confirm transaction

## Security Benefits

- **Air-gapped Signing**: Private keys never touch online systems
- **Reduced Attack Surface**: Minimize online exposure
- **Hardware Security**: Compatible with hardware wallets
- **Audit Trail**: Clear separation of signing and broadcasting

## Use Cases

- **High-value Transactions**: Large transfers requiring maximum security
- **Institutional Trading**: Enterprise-grade security requirements
- **Multi-signature Wallets**: Collecting signatures from multiple parties
- **Cold Storage Operations**: Managing funds in cold storage

Note: Recent blockhashes expire after about 2 minutes, so offline transactions must be submitted promptly after signing.