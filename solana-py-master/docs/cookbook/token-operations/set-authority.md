# Set Authority

Set the authority for token accounts or token mints.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Set Authority on Token Accounts or Mints
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import set_authority, SetAuthorityParams
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import AuthorityType

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example keypairs and addresses
    payer = Keypair()
    current_authority = Keypair()
    new_authority = Keypair()
    mint_or_account = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    
    async with rpc:
        # Set new mint authority
        set_mint_authority_instruction = set_authority(
            SetAuthorityParams(
                program_id=TOKEN_PROGRAM_ID,
                account=mint_or_account,
                authority=AuthorityType.MINT_TOKENS,
                current_authority=current_authority.pubkey(),
                new_authority=new_authority.pubkey()
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[set_mint_authority_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer, current_authority])
        
        print(f"Account/Mint: {mint_or_account}")
        print(f"Current Authority: {current_authority.pubkey()}")
        print(f"New Authority: {new_authority.pubkey()}")
        print(f"Authority Type: {AuthorityType.MINT_TOKENS}")
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to set the authority for token accounts or token mints:

1. **Set Parameters**: Define the current authority holder, new authority holder, and target account
2. **Select Authority Type**: Use `AuthorityType` to specify the type of authority to set
3. **Create Set Instruction**: Use `set_authority()` to create an authority setting instruction
4. **Build Transaction**: Create a message and build a signed transaction
5. **Send Transaction**: Send the transaction to the network for execution

## Key Concepts

- **Authority Types**: Different types of authorities
  - `MINT_TOKENS`: Permission to mint tokens
  - `FREEZE_ACCOUNT`: Permission to freeze accounts
  - `ACCOUNT_OWNER`: Account owner authority
  - `CLOSE_ACCOUNT`: Permission to close accounts
- **Current Authority**: The current authority holder
- **New Authority**: The new authority holder

## Authority Types Details

### For Token Mint:
- `MINT_TOKENS`: Permission to mint new tokens
- `FREEZE_ACCOUNT`: Permission to freeze token accounts

### For Token Account:
- `ACCOUNT_OWNER`: Account owner authority
- `CLOSE_ACCOUNT`: Permission to close accounts

## Usage

1. Set the current authority holder as `current_authority`
2. Set the new authority holder as `new_authority`
3. Specify the account or mint address to operate on
4. Choose the appropriate authority type
5. Run the script to execute the authority transfer

## Important Notes

- Only the current authority holder can transfer authority
- Authority transfer is an irreversible operation
- Authority can be set to `None` to permanently relinquish authority
- Different authority types apply to different account types
- Sufficient SOL is required to pay transaction fees

## Authority Management Best Practices

- Carefully manage mint authority, consider relinquishing it when appropriate
- Set up multi-signature for important operations
- Regularly review and update authority settings
- Use hardware wallets to manage authority in production environments