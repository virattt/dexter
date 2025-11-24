# Add Memo to Transaction

Learn how to add a memo to a Solana transaction to include additional information or comments.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Add a Memo to a Transaction
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.memo.instructions import create_memo, MemoParams
from solders.pubkey import Pubkey

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    amount = 1_000_000_000  # 1 SOL
    memo_text = "Hello, Solana! This is a memo."
    
    async with rpc:
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create transfer instruction
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient.pubkey(),
                lamports=amount
            )
        )
        
        # Create memo instruction
        memo_instruction = create_memo(
            MemoParams(
                program_id=Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                signer=sender.pubkey(),
                message=memo_text.encode('utf-8')
            )
        )
        
        # Create message with both instructions
        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[transfer_instruction, memo_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [sender])
        
        print(f"Sender: {sender.pubkey()}")
        print(f"Recipient: {recipient.pubkey()}")
        print(f"Transfer Amount: {amount / 1_000_000_000} SOL")
        print(f"Memo: {memo_text}")
        print(f"Transaction with memo created successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates how to add a memo to a Solana transaction:

1. **Create Standard Transaction**: Build a regular transfer transaction
2. **Create Memo Instruction**: Use the SPL Memo program to create a memo instruction
3. **Combine Instructions**: Include both transfer and memo instructions in the same transaction
4. **Encode Message**: Convert the memo text to bytes for the instruction
5. **Create Transaction**: Build a versioned transaction with both instructions

## Key Concepts

- **SPL Memo Program**: Official program for adding text memos to transactions
- **Multiple Instructions**: A single transaction can contain multiple instructions
- **Memo Program ID**: The fixed program ID for the memo program
- **UTF-8 Encoding**: Memo text must be encoded as bytes
- **Transaction Ordering**: Instructions are executed in the order they appear

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders spl-token
   ```

2. Run the script:
   ```bash
   python add_memo_to_transaction.py
   ```

## Use Cases

Memos are useful for:
- Adding payment references or invoice numbers
- Including transaction descriptions
- Storing metadata on-chain
- Creating audit trails
- Adding context to transfers

Note: Memos are publicly visible on the blockchain and increase transaction size and fees slightly.