# Delegate Token Account

Delegate a token account to another account, allowing it to operate tokens within a specified amount range.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Delegate Token Accounts
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
    approve_checked, ApproveCheckedParams,
    get_associated_token_address
)
from spl.token.constants import TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID

# Constants
DECIMALS = 9

async def setup(rpc, mint_authority):
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
    
    # Get latest blockhash
    recent_blockhash = await rpc.get_latest_blockhash()
    
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
        recent_blockhash=recent_blockhash.value.blockhash
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
    delegate = Keypair()
    
    async with rpc:
        # Setup mint and token account
        mint_pubkey, token_account = await setup(rpc, mint_authority)
        
        # Delegate amount (50 tokens)
        delegate_amount = 50 * (10 ** DECIMALS)
        
        # Create approval instruction
        approve_instruction = approve_checked(
            ApproveCheckedParams(
                program_id=TOKEN_PROGRAM_ID,
                source=token_account,
                mint=mint_pubkey,
                delegate=delegate.pubkey(),
                owner=mint_authority.pubkey(),
                amount=delegate_amount,
                decimals=DECIMALS
            )
        )
        
        # Get latest blockhash
        recent_blockhash = await rpc.get_latest_blockhash()
        
        # Create message
        message = MessageV0.try_compile(
            payer=payer.pubkey(),
            instructions=[approve_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [payer, mint_authority])
        
        print(f"Token Account: {token_account}")
        print(f"Delegate: {delegate.pubkey()}")
        print(f"Delegated Amount: {delegate_amount / (10 ** DECIMALS)} tokens")
        
        # Send transaction
        result = await rpc.send_transaction(transaction)
        print(f"Delegate transaction signature: {result.value}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to delegate a token account:

1. **Setup Phase**: Create token mint, associated token account, and mint tokens
2. **Delegation Operation**: Use `approve_checked()` to delegate permissions to a specified account
3. **Permission Scope**: Delegate token operation permissions for a specified amount
4. **Send Transaction**: Send the delegation instruction to the network for execution

## Key Concepts

- **Token Delegation**: Allows other accounts to operate tokens within a specified amount range
- **Delegate**: The delegated account that can transfer or operate the delegated tokens
- **Approved Amount**: The upper limit of delegated token amount
- **Approve Checked**: A safer delegation method that verifies token type and decimal places

## Usage

1. Set the token account owner as the delegator
2. Specify the `delegate` account to receive permissions
3. Set the token amount limit for delegation
4. Use `approve_checked()` to create the delegation instruction
5. Run the script to execute the delegation operation

## Important Notes

- Delegation does not transfer token ownership, it only authorizes operations
- Delegation has amount limits, operations exceeding the limit will fail
- Delegation can be revoked or reset
- The delegated account can perform operations like transfers
- Sufficient SOL is required to pay transaction fees

## Use Cases for Delegation

- **DeFi Protocols**: Allow protocols to operate tokens under user authorization
- **Automated Trading**: Delegate to trading bots for automatic trading
- **Payment Gateways**: Allow third parties to process payments
- **Multi-signature**: Use in multi-signature schemes

## Security Considerations

- Only delegate to trusted accounts or programs
- Set appropriate delegation amount limits
- Regularly check and manage delegation permissions
- Revoke delegation promptly when no longer needed