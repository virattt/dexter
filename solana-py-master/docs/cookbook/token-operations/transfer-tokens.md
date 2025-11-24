# Transfer Tokens

Transfer SPL tokens between two token accounts.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Transfer Tokens (SPL Token Transfer Checked)
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import transfer_checked, TransferCheckedParams
from spl.token.instructions import get_associated_token_address
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example keypairs and addresses
    payer = Keypair()
    owner = Keypair()
    receiver = Keypair()
    mint_address = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    
    # Token decimals (usually 9 for most tokens)
    decimals = 9
    
    # Amount to transfer (in smallest unit)
    amount_to_transfer = 10_000_000_000  # 10 tokens with 9 decimals
    
    async with rpc:
        # Get associated token addresses
        source_token_account = get_associated_token_address(
            owner=owner.pubkey(),
            mint=mint_address,
            token_program_id=TOKEN_PROGRAM_ID
        )
        
        destination_token_account = get_associated_token_address(
            owner=receiver.pubkey(),
            mint=mint_address,
            token_program_id=TOKEN_PROGRAM_ID
        )
        
        # Create transfer checked instruction
        transfer_instruction = transfer_checked(
            TransferCheckedParams(
                program_id=TOKEN_PROGRAM_ID,
                source=source_token_account,
                mint=mint_address,
                dest=destination_token_account,
                owner=owner.pubkey(),
                amount=amount_to_transfer,
                decimals=decimals
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[transfer_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash,
        )
        
        # Create and sign transaction
        transaction = VersionedTransaction(message, [payer, owner])
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to transfer SPL tokens between two token accounts:

1. **Set Parameters**: Define the payer, token owner, receiver, and mint address
2. **Get Associated Token Accounts**: Use `get_associated_token_address()` to get source and destination token account addresses
3. **Create Transfer Instruction**: Use `transfer_checked()` to create a secure transfer instruction
4. **Build Transaction**: Create a message and build a signed transaction
5. **Send Transaction**: Send the transaction to the network for execution

## Key Concepts

- **Transfer Checked**: Safer than regular transfer, verifies token type and decimal places
- **Associated Token Account**: Standard token account associated with a specific wallet and token type
- **Source Account**: The source account sending tokens
- **Destination Account**: The destination account receiving tokens
- **Decimals**: The decimal places of the token, used to verify transfer correctness

## Usage

1. Set the token owner as `owner`
2. Set the token receiver as `receiver`
3. Specify the `mint_address` of the token to transfer
4. Set the token's decimal places
5. Set the amount of tokens to transfer (pay attention to decimal places)
6. Run the script to execute the transfer operation

## Important Notes

- The source account must have sufficient token balance
- The destination account must be an account for the same token type
- Using `transfer_checked` is safer than regular `transfer`
- Sufficient SOL is required to pay transaction fees
- If the destination account doesn't exist, it may need to be created first