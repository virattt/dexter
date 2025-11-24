# Mint Tokens

Mint new SPL tokens to a specified token account.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Mint Tokens
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import mint_to, MintToParams
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example keypairs and addresses
    payer = Keypair()
    mint_authority = Keypair()
    mint_address = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    destination_token_account = Pubkey.from_string("GfVPzUxMDvhFJ1Xs6C9i47XQRSapTd8LHw5grGuTquyQ")
    
    # Amount to mint (in smallest unit)
    amount_to_mint = 1000000000  # 1 token with 9 decimals
    
    async with rpc:
        # Create mint instruction
        mint_instruction = mint_to(
            MintToParams(
                program_id=TOKEN_PROGRAM_ID,
                mint=mint_address,
                dest=destination_token_account,
                mint_authority=mint_authority.pubkey(),
                amount=amount_to_mint
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[mint_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash,
        )
        
        # Create and sign transaction
        transaction = VersionedTransaction(message, [payer, mint_authority])
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to mint new SPL tokens:

1. **Set Parameters**: Define the payer, mint authority, mint address, and destination token account
2. **Create Mint Instruction**: Use the `mint_to()` function to create a mint instruction
3. **Build Transaction**: Create a message and build a signed transaction
4. **Send Transaction**: Send the transaction to the network for execution

## Key Concepts

- **Mint Authority**: The account with minting permissions, only this account can mint new tokens
- **Mint Address**: The mint address of the token, identifying a specific token type
- **Token Account**: The destination account to receive the minted tokens
- **Amount**: The mint amount, calculated in the token's smallest unit

## Usage

1. Set the account with minting permissions as `mint_authority`
2. Specify the `mint_address` of the token to be minted
3. Specify the `destination_token_account` to receive the tokens
4. Set the amount of tokens to mint (pay attention to decimal places)
5. Run the script to execute the mint operation

## Important Notes

- Only accounts with minting permissions can execute mint operations
- The mint amount needs to consider the token's decimal places
- The destination account must be a token account for the corresponding token type
- Sufficient SOL is required to pay transaction fees