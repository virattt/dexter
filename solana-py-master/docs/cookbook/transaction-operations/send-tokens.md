# Send Tokens

Learn how to send SPL tokens between accounts using the Solana Python library.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Send Tokens
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import transfer_checked, TransferCheckedParams
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    # Example token mint (USDC devnet)
    token_mint = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    
    # Example token accounts (would need to be created first)
    sender_token_account = Pubkey.from_string("11111111111111111111111111111111")
    recipient_token_account = Pubkey.from_string("11111111111111111111111111111111")
    
    amount = 1_000_000  # 1 token (6 decimals)
    decimals = 6
    
    async with rpc:
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create transfer instruction
        transfer_instruction = transfer_checked(
            TransferCheckedParams(
                program_id=TOKEN_PROGRAM_ID,
                source=sender_token_account,
                mint=token_mint,
                dest=recipient_token_account,
                owner=sender.pubkey(),
                amount=amount,
                decimals=decimals
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
        print(f"Token Mint: {token_mint}")
        print(f"Transfer Amount: {amount / (10 ** decimals)} tokens")
        print(f"Transaction created successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates how to send SPL tokens between accounts:

1. **Create RPC Client**: Connect to the Solana devnet
2. **Setup Accounts**: Define sender, recipient, and token mint
3. **Token Accounts**: Specify source and destination token accounts
4. **Transfer Parameters**: Set amount and decimals for the token
5. **Create Transfer Instruction**: Use `transfer_checked` for secure transfers
6. **Compile Message**: Create a message with the transfer instruction
7. **Create Transaction**: Build a versioned transaction

## Key Concepts

- **SPL Tokens**: Standard tokens on Solana (like ERC-20 on Ethereum)
- **Token Mint**: The address that identifies the token type
- **Token Accounts**: Accounts that hold tokens for a specific mint
- **Transfer Checked**: Safer transfer method that verifies mint and decimals
- **Decimals**: Number of decimal places for the token (e.g., 6 for USDC)

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders spl-token
   ```

2. Ensure you have:
   - Valid token accounts for sender and recipient
   - Sufficient token balance in the sender's account
   - The correct token mint address

3. Run the script:
   ```bash
   python send_tokens.py
   ```

Note: This example creates the transaction but doesn't submit it. You'll need to create actual token accounts and call `rpc.send_transaction(transaction)` to execute the transfer.