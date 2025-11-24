# Close Token Account

Close a token account and recover the rent.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Close Token Accounts
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from spl.token.instructions import close_account, CloseAccountParams
from spl.token.constants import TOKEN_PROGRAM_ID

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example keypairs and addresses
    payer = Keypair()
    owner = Keypair()
    token_account = Pubkey.from_string("GfVPzUxMDvhFJ1Xs6C9i47XQRSapTd8LHw5grGuTquyQ")
    
    # Account to receive the remaining lamports (usually the owner)
    destination = owner.pubkey()
    
    async with rpc:
        # Create close account instruction
        close_instruction = close_account(
            CloseAccountParams(
                program_id=TOKEN_PROGRAM_ID,
                account=token_account,
                dest=destination,
                owner=owner.pubkey()
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[close_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer, owner])
        
        print(f"Token Account: {token_account}")
        print(f"Owner: {owner.pubkey()}")
        print(f"Destination: {destination}")
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to close a token account:

1. **Set Parameters**: Define the payer, token account owner, and token account to close
2. **Specify Destination**: Set the destination account to receive the rent (usually the owner)
3. **Create Close Instruction**: Use `close_account()` to create the close account instruction
4. **Build Transaction**: Create a message and build a signed transaction
5. **Send Transaction**: Send the transaction to the network for execution

## Key Concepts

- **Token Account**: The token account to be closed
- **Owner**: The owner of the token account, only the owner can close the account
- **Destination**: The destination account to receive the account rent
- **Rent**: The rent paid when creating the account, which can be recovered when closing the account

## Usage

1. Ensure the token account has zero balance (transfer any balance first if needed)
2. Set the token account owner as `owner`
3. Specify the `token_account` to close
4. Set the `destination` account to receive the rent
5. Run the script to execute the close operation

## Important Notes

- Only the token account owner can close the account
- The token account must have zero balance to be closed
- After closing the account, the rent stored in the account is returned to the specified destination account
- The closed account address can be reused
- Sufficient SOL is required to pay transaction fees