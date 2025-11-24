# Create Token Account

This example shows how to create an associated token account for a specific token mint.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Create a Token Account
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import create_associated_token_account, get_associated_token_address
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    payer = Keypair()
    owner = Keypair()
    
    # Example mint address
    mint_address = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    
    # Get associated token account address
    associated_token_account = get_associated_token_address(owner.pubkey(), mint_address)
    
    async with rpc:
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create associated token account instruction
        create_token_account_instruction = create_associated_token_account(
            payer=payer.pubkey(),
            owner=owner.pubkey(),
            mint=mint_address,
            token_program_id=TOKEN_PROGRAM_ID
        )
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[create_token_account_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer])
        
        print(f"Payer: {payer.pubkey()}")
        print(f"Owner: {owner.pubkey()}")
        print(f"Mint: {mint_address}")
        print(f"Associated Token Account: {associated_token_account}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Get ATA address**: Use `get_associated_token_address()` to find the associated token account address
2. **Create instruction**: Build the instruction to create the associated token account
3. **Build transaction**: Compile the instruction into a transaction
4. **Sign transaction**: Sign with the payer keypair

## Key Concepts

- **Associated Token Account (ATA)**: A deterministic token account address for each owner-mint pair
- **Payer**: The account that pays for the transaction and rent
- **Owner**: The account that owns the token account
- **Mint**: The token type this account will hold

## Usage

```bash
python create_token_account.py
```

This will output:
```
Payer: 5J8...abc
Owner: 3Kd...def
Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
Associated Token Account: 7Nm...xyz
```