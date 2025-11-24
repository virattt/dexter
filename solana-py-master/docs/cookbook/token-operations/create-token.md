# Create Token

This example demonstrates how to create a new SPL token on the Solana blockchain.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Create a Token
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import initialize_mint, InitializeMintParams
from spl.token.constants import TOKEN_PROGRAM_ID
from solders.system_program import create_account, CreateAccountParams

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    fee_payer = Keypair()
    mint = Keypair()
    
    space = 82  # getMintSize() equivalent
    decimals = 9
    
    async with rpc:
        # Get minimum balance for rent exemption
        rent = await rpc.get_minimum_balance_for_rent_exemption(space)
        
        # Create account instruction
        create_account_instruction = create_account(
            CreateAccountParams(
                from_pubkey=fee_payer.pubkey(),
                to_pubkey=mint.pubkey(),
                lamports=rent.value,
                space=space,
                owner=TOKEN_PROGRAM_ID
            )
        )
        
        # Initialize mint instruction
        initialize_mint_instruction = initialize_mint(
            InitializeMintParams(
                program_id=TOKEN_PROGRAM_ID,
                mint=mint.pubkey(),
                decimals=decimals,
                mint_authority=fee_payer.pubkey(),
                freeze_authority=None  # No freeze authority
            )
        )
        
        instructions = [create_account_instruction, initialize_mint_instruction]
        
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        transaction_message = MessageV0.try_compile(
            payer=fee_payer.pubkey(),
            instructions=instructions,
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash,
        )
        
        # Create versioned transaction
        transaction = VersionedTransaction(transaction_message, [fee_payer, mint])
        
        print(f"Mint address: {mint.pubkey()}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Set up keypairs**: Create keypairs for the fee payer and the mint account
2. **Define parameters**: Set the account space (82 bytes for a mint) and decimals (9 for standard tokens)
3. **Calculate rent**: Get the minimum balance required for rent exemption
4. **Create account**: Create the account instruction to allocate space for the mint
5. **Initialize mint**: Initialize the mint with the specified parameters
6. **Build transaction**: Compile the instructions into a versioned transaction
7. **Sign transaction**: Sign with both the fee payer and mint keypairs

## Key Concepts

- **Mint Account**: The account that defines a token type and controls token supply
- **Decimals**: Number of decimal places for the token (9 is standard for most tokens)
- **Rent Exemption**: Accounts must hold enough SOL to be exempt from rent collection
- **Authority**: The account that has permission to mint tokens

## Usage

```bash
python create_token.py
```

This will output the mint address of your newly created token.

## Prerequisites

- You'll need SOL in your fee payer account to pay for transaction fees
- Make sure you're connected to devnet for testing