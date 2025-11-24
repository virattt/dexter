# Revoke Delegate

Revoke the delegation permissions of a token account.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Revoke a Token Delegate
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.system_program import create_account, CreateAccountParams
from spl.token.instructions import (
    initialize_mint, InitializeMintParams,
    create_associated_token_account, 
    mint_to_checked, MintToCheckedParams,
    revoke, RevokeParams,
    get_associated_token_address
)
from spl.token.constants import TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID

# Constants
DECIMALS = 9

async def setup(rpc, mint_authority, latest_blockhash):
    """
    The setup function initializes the mint and associated token accounts,
    and mints tokens to said associated token account
    """
    mint = Keypair()
    
    space = 82  # getMintSize() equivalent for SPL Token
    
    # Get minimum balance for rent exemption
    rent = await rpc.get_minimum_balance_for_rent_exemption(space)
    
    # Create & initialize mint account
    create_account_instruction = create_account(
        CreateAccountParams(
            from_pubkey=mint_authority.pubkey(),
            to_pubkey=mint.pubkey(),
            lamports=rent.value,
            space=space,
            owner=TOKEN_PROGRAM_ID
        )
    )
    
    initialize_mint_instruction = initialize_mint(
        InitializeMintParams(
            program_id=TOKEN_PROGRAM_ID,
            mint=mint.pubkey(),
            decimals=DECIMALS,
            mint_authority=mint_authority.pubkey(),
            freeze_authority=None
        )
    )
    
    # Create associated token account
    authority_ata = get_associated_token_address(
        owner=mint_authority.pubkey(),
        mint=mint.pubkey(),
        token_program_id=TOKEN_PROGRAM_ID
    )
    
    create_ata_instruction = create_associated_token_account(
        payer=mint_authority.pubkey(),
        owner=mint_authority.pubkey(),
        mint=mint.pubkey(),
        token_program_id=TOKEN_PROGRAM_ID,
        associated_token_program_id=ASSOCIATED_TOKEN_PROGRAM_ID
    )
    
    # Mint tokens to ATA
    mint_to_instruction = mint_to_checked(
        MintToCheckedParams(
            program_id=TOKEN_PROGRAM_ID,
            mint=mint.pubkey(),
            dest=authority_ata,
            mint_authority=mint_authority.pubkey(),
            amount=100 * (10 ** DECIMALS),  # 100 tokens
            decimals=DECIMALS
        )
    )
    
    # Create message
    message = MessageV0.try_compile(
        payer=mint_authority.pubkey(),
        instructions=[
            create_account_instruction,
            initialize_mint_instruction,
            create_ata_instruction,
            mint_to_instruction
        ],
        address_lookup_table_accounts=[],
        recent_blockhash=latest_blockhash
    )
    
    # Create transaction
    transaction = VersionedTransaction(message, [mint_authority, mint])
    
    # Send transaction
    result = await rpc.send_transaction(transaction)
    print(f"Setup transaction signature: {result.value}")
    
    return mint.pubkey(), authority_ata

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Create keypairs
    payer = Keypair()
    mint_authority = Keypair()
    
    async with rpc:
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Setup mint and token account
        mint_pubkey, token_account = await setup(rpc, mint_authority, recent_blockhash.value.blockhash)
        
        # Create revoke instruction
        revoke_instruction = revoke(
            RevokeParams(
                program_id=TOKEN_PROGRAM_ID,
                source=token_account,
                owner=mint_authority.pubkey()
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[revoke_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer, mint_authority])
        
        print(f"Token Account: {token_account}")
        print(f"Revoking delegate for account owner: {mint_authority.pubkey()}")
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Revoke transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to revoke the delegation permissions of a token account:

1. **Setup Phase**: Create token mint, associated token account, and mint tokens
2. **Revoke Operation**: Use the `revoke()` function to revoke previously granted delegation permissions
3. **Clear Delegation**: Clear the delegation information from the token account
4. **Send Transaction**: Send the revoke instruction to the network for execution

## Key Concepts

- **Revoke Delegate**: Revoke previously granted delegation permissions
- **Token Account Owner**: Only the token account owner can revoke delegation
- **Delegate Clearance**: After revocation, the delegated account can no longer operate tokens
- **Permission Restoration**: After revocation, all permissions return to the original owner

## Usage

1. Ensure you are the owner of the token account
2. Use the `revoke()` function to create a revoke instruction
3. Specify the token account to revoke delegation from
4. Sign and send the transaction
5. After confirming transaction success, the delegation permissions are cleared

## Important Notes

- Only the token account owner can revoke delegation
- The revoke operation clears all delegation information
- After revocation, the previously delegated account cannot perform any operations
- If re-delegation is needed, a new delegation operation must be executed
- Sufficient SOL is required to pay transaction fees

## Scenarios for Revoking Delegation

- **Security Considerations**: When discovering that a delegated account may be compromised
- **Permission Management**: Regularly cleaning up unnecessary delegation permissions
- **Protocol Upgrades**: Revoking old delegations during protocol upgrades
- **User Operations**: Users actively revoking permissions given to third parties

## Relationship with Delegation

Revoking delegation is the reverse operation of delegation:
- Delegation: Grant operation permissions to other accounts
- Revocation: Remove previously granted permissions

## Best Practices

- Regularly review and clean up delegation permissions
- Revoke delegation promptly when no longer needed
- Monitor the activity of delegated accounts
- Immediately revoke delegation when anomalies are detected