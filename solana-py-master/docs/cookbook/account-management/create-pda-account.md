# Create PDA Account

This example shows how to create a Program Derived Address (PDA) account on Solana.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Create a PDA's Account
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import create_account_with_seed, CreateAccountWithSeedParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    payer = Keypair()
    program_id = Pubkey.from_string("11111111111111111111111111111111")
    
    # Create PDA (Program Derived Address)
    seed = "hello"
    pda, bump = Pubkey.find_program_address([seed.encode()], program_id)
    
    space = 100  # Account data space
    
    async with rpc:
        # Get minimum balance for rent exemption
        rent_lamports = await rpc.get_minimum_balance_for_rent_exemption(space)
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Use the payer as base for seed derivation
        create_account_instruction = create_account_with_seed(
            CreateAccountWithSeedParams(
                from_pubkey=payer.pubkey(),
                to_pubkey=pda,
                base=payer.pubkey(),
                seed=seed,
                lamports=rent_lamports.value,
                space=space,
                owner=program_id
            )
        )
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[create_account_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer])
        
        print(f"Payer: {payer.pubkey()}")
        print(f"PDA: {pda}")
        print(f"Seed: {seed}")
        print(f"Bump: {bump}")
        print(f"Space: {space} bytes")
        print(f"Rent Lamports: {rent_lamports.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Find PDA**: Use `find_program_address()` to derive the PDA from a seed and program ID
2. **Calculate rent**: Get the minimum balance required for the account size
3. **Create instruction**: Build the account creation instruction using the PDA
4. **Build transaction**: Compile the instruction into a transaction

## Key Concepts

- **PDA**: Program Derived Address - a deterministic address derived from seeds
- **Seed**: A string used to derive the PDA address
- **Bump**: A value that ensures the PDA is not on the ed25519 curve
- **Program ID**: The program that will own the PDA account
- **Deterministic**: The same seed always produces the same PDA

## Usage

```bash
python create_pda_account.py
```

This will output:
```
Payer: 5J8...abc
PDA: 3Kd...def
Seed: hello
Bump: 254
Space: 100 bytes
Rent Lamports: 1461600
```

## Use Cases

- **Program state**: Store program-specific data
- **Token accounts**: Create token accounts owned by programs
- **Cross-program invocation**: Allow programs to sign transactions