# Send SOL

Learn how to send SOL (Solana's native cryptocurrency) between accounts using the Solana Python library.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Send SOL
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    LAMPORTS_PER_SOL = 1_000_000_000
    transfer_amount = LAMPORTS_PER_SOL // 100  # 0.01 SOL
    
    async with rpc:
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create transfer instruction
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient.pubkey(),
                lamports=transfer_amount
            )
        )
        
        # Create message
        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[transfer_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [sender])
        
        print(f"Sender: {sender.pubkey()}")
        print(f"Recipient: {recipient.pubkey()}")
        print(f"Transfer Amount: {transfer_amount / LAMPORTS_PER_SOL} SOL")
        print(f"Transaction created successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates the basic process of sending SOL from one account to another:

1. **Create RPC Client**: Connect to the Solana devnet using `AsyncClient`
2. **Generate Keypairs**: Create sender and recipient keypairs (in practice, you would use existing keypairs)
3. **Set Transfer Amount**: Define the amount to transfer in lamports (1 SOL = 1,000,000,000 lamports)
4. **Get Latest Blockhash**: Required for transaction validity
5. **Create Transfer Instruction**: Use the system program's transfer function
6. **Compile Message**: Create a message with the transfer instruction
7. **Create Transaction**: Build a versioned transaction with the message and signatures

## Key Concepts

- **Lamports**: The smallest unit of SOL (1 SOL = 1,000,000,000 lamports)
- **System Program**: Built-in program that handles basic operations like transfers
- **Versioned Transactions**: Modern transaction format supporting lookup tables
- **Blockhash**: Recent blockhash ensures transaction validity and prevents replay attacks

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders
   ```

2. Ensure the sender account has sufficient SOL balance on devnet

3. Run the script:
   ```bash
   python send_sol.py
   ```

Note: This example creates the transaction but doesn't submit it to the network. To actually send the transaction, you would need to call `rpc.send_transaction(transaction)`.