# Get All Token Accounts by Owner

Get all token accounts for a specified owner.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Get All Token Accounts by Owner
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey
from spl.token.constants import TOKEN_PROGRAM_ID
from solana.rpc.types import TokenAccountOpts

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example owner address
    owner = Pubkey.from_string("4kg8oh3jdNtn7j2wcS7TrUua31AgbLzDVkBZgTAe44aF")
    
    async with rpc:
        try:
            # Get all token accounts by owner
            response = await rpc.get_token_accounts_by_owner(
                owner,
                TokenAccountOpts(program_id=TOKEN_PROGRAM_ID)
            )
            
            print(f"Owner: {owner}")
            print(f"Found {len(response.value)} token accounts:\n")
            
            for account_info in response.value:
                print(f"Pubkey: {account_info.pubkey}")
                print(f"Owner: {account_info.account.owner}")
                print(f"Lamports: {account_info.account.lamports}")
                print(f"Data Length: {len(account_info.account.data)} bytes")
                print("=" * 50)
            
        except Exception as e:
            print(f"Error getting token accounts: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to get all token accounts for a specified owner:

1. **Set Owner**: Specify the wallet address to query
2. **Configure Query Parameters**: Use `TokenAccountOpts` to specify the Token program ID
3. **Execute Query**: Call the `get_token_accounts_by_owner()` method
4. **Process Results**: Iterate through and display information for each token account

## Key Concepts

- **Token Account Owner**: The owner of the token account, usually the user's wallet address
- **Token Program ID**: The identifier for the SPL Token program
- **Account Info**: Contains account public key, owner, balance, and other information
- **Lamports**: The SOL balance in the account (calculated in smallest units)

## Usage

1. Replace `owner` with the wallet address you want to query
2. Run the script to get all token accounts for that address
3. View the returned account information, including public key, owner, and balance

## Important Notes

- Returns all token accounts, regardless of token type
- The data length of each account can help determine the account type
- Empty token accounts are also included in the results
- Network connection exceptions will throw corresponding errors

## Extended Functionality

You can further parse account data to get more detailed information:

```python
# Parse token account data
from spl.token.layouts import ACCOUNT_LAYOUT

def parse_token_account(account_data):
    decoded = ACCOUNT_LAYOUT.parse(account_data)
    return {
        'mint': decoded.mint,
        'owner': decoded.owner,
        'amount': decoded.amount,
        'delegate': decoded.delegate,
        'state': decoded.state,
        'is_native': decoded.is_native,
        'delegated_amount': decoded.delegated_amount,
        'close_authority': decoded.close_authority
    }
```