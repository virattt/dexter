# Burn Tokens

Burn a specified amount of SPL tokens, reducing the total supply.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Burn Tokens
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import burn, BurnParams
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example keypairs and addresses
    payer = Keypair()
    owner = Keypair()
    mint_address = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    token_account = Pubkey.from_string("GfVPzUxMDvhFJ1Xs6C9i47XQRSapTd8LHw5grGuTquyQ")
    
    # Amount to burn (in smallest unit)
    amount_to_burn = 500000000  # 0.5 tokens with 9 decimals
    
    async with rpc:
        # Create burn instruction
        burn_instruction = burn(
            BurnParams(
                program_id=TOKEN_PROGRAM_ID,
                account=token_account,
                mint=mint_address,
                owner=owner.pubkey(),
                amount=amount_to_burn
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[burn_instruction],
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

This example shows how to burn SPL tokens:

1. **Set Parameters**: Define the payer, token owner, mint address, and token account
2. **Create Burn Instruction**: Use the `burn()` function to create a burn instruction
3. **Build Transaction**: Create a message and build a signed transaction
4. **Send Transaction**: Send the transaction to the network for execution

## Key Concepts

- **Token Owner**: The owner of the token account, only the owner can burn their tokens
- **Token Account**: The account containing the tokens to be burned
- **Mint Address**: The mint address of the token, used to identify the token type
- **Burn Amount**: The amount of tokens to burn, calculated in the smallest unit

## Usage

1. Set the token account owner as `owner`
2. Specify the `token_account` containing tokens to burn
3. Specify the token's `mint_address`
4. Set the amount of tokens to burn (pay attention to decimal places)
5. Run the script to execute the burn operation

## Important Notes

- Only the token account owner can burn tokens
- The burn operation is irreversible, tokens are permanently removed from the total supply
- The burn amount cannot exceed the token balance in the account
- Sufficient SOL is required to pay transaction fees
- Burned tokens cannot be recovered