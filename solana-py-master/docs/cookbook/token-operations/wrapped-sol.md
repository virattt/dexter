# Wrapped SOL

使用 Wrapped SOL (wSOL)，将原生 SOL 转换为 SPL Token 格式。

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Use Wrapped SOL
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.system_program import transfer, TransferParams
from spl.token.instructions import (
    create_associated_token_account,
    sync_native, SyncNativeParams,
    close_account, CloseAccountParams,
    get_associated_token_address
)
from spl.token.constants import TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
from solders.pubkey import Pubkey

# Native mint address for wrapped SOL
NATIVE_MINT = Pubkey.from_string("So11111111111111111111111111111111111111112")

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")

    # Example keypairs
    payer = Keypair()
    owner = Keypair()

    # Amount to wrap (in lamports)
    amount_to_wrap = 1000000000  # 1 SOL

    async with rpc:
        # Get associated token address for wrapped SOL
        wrapped_sol_account = get_associated_token_address(
            owner=owner.pubkey(),
            mint=NATIVE_MINT,
            token_program_id=TOKEN_PROGRAM_ID
        )

        # Create associated token account for wrapped SOL
        create_ata_instruction = create_associated_token_account(
            payer=payer.pubkey(),
            owner=owner.pubkey(),
            mint=NATIVE_MINT,
            token_program_id=TOKEN_PROGRAM_ID,
            associated_token_program_id=ASSOCIATED_TOKEN_PROGRAM_ID
        )

        # Transfer SOL to the wrapped SOL account
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=payer.pubkey(),
                to_pubkey=wrapped_sol_account,
                lamports=amount_to_wrap
            )
        )

        # Sync native instruction to update the wrapped SOL balance
        sync_native_instruction = sync_native(
            SyncNativeParams(
                program_id=TOKEN_PROGRAM_ID,
                account=wrapped_sol_account
            )
        )

        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()

        # Create message for wrapping SOL
        wrap_message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[
                create_ata_instruction,
                transfer_instruction,
                sync_native_instruction
            ],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )

        # Create transaction
        wrap_transaction = VersionedTransaction(wrap_message, [payer, owner])

        print(f"Wrapped SOL Account: {wrapped_sol_account}")
        print(f"Amount to wrap: {amount_to_wrap / 1000000000} SOL")

        # Send wrapping transaction
        result = await rpc.send_transaction(wrap_transaction)
        print(f"Wrap transaction signature: {result.value}")

        # Unwrap SOL by closing the account
        print("\nUnwrapping SOL...")

        # Close account instruction to unwrap SOL
        close_instruction = close_account(
            CloseAccountParams(
                program_id=TOKEN_PROGRAM_ID,
                account=wrapped_sol_account,
                dest=owner.pubkey(),
                owner=owner.pubkey()
            )
        )

        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()

        # Create message for unwrapping SOL
        unwrap_message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[close_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )

        # Create transaction
        unwrap_transaction = VersionedTransaction(unwrap_message, [payer, owner])

        # Send unwrapping transaction
        result = await rpc.send_transaction(unwrap_transaction)
        print(f"Unwrap transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example demonstrates how to use Wrapped SOL:

1. **Create a wSOL account**: Create an associated token account for native SOL
2. **Transfer SOL**: Transfer SOL into the wSOL account
3. **Sync balance**: Use `sync_native()` to sync the wSOL account balance
4. **Unwrap SOL**: Convert wSOL back to native SOL by closing the account

## Key Concepts

- **Wrapped SOL (wSOL)**: Wraps native SOL into SPL Token format
- **Native Mint**: The special token mint address for native SOL
- **Sync Native**: Synchronizes the balance of native token accounts
- **Unwrapping**: Converts wSOL back to native SOL by closing the account

## Usage

### Wrapping SOL

1. Create an associated token account for wSOL
2. Transfer SOL to that account
3. Call `sync_native()` to synchronize the balance

### Unwrapping SOL

1. Use `close_account()` to close the wSOL account
2. SOL in the account will be returned to the specified destination account

## Why Use Wrapped SOL

- **Unified Interface**: Allows SOL to be operated like other SPL tokens
- **DeFi Protocols**: Use SOL in protocols that require token interfaces
- **Trading Pairs**: Create SOL trading pairs in decentralized exchanges
- **Program Compatibility**: Enables programs that only support SPL tokens to handle SOL

## Important Notes

- The wSOL account balance equals the amount of SOL in it
- Creating a wSOL account requires rent, which can be recovered when closing
- `sync_native()` must be called after transferring SOL to correctly update the balance
- When unwrapping, the account must have no delegation permissions
- Sufficient SOL is required to pay transaction fees
