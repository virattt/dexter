# Get Token Balance

Get the balance information for a specified token account.

## Code Implementation

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Get a Token Account's Balance
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey

async def main():
    rpc = AsyncClient("https://api.mainnet-beta.solana.com")
    
    # Use a real token account address from mainnet
    token_account_address = Pubkey.from_string("GfVPzUxMDvhFJ1Xs6C9i47XQRSapTd8LHw5grGuTquyQ")
    
    async with rpc:
        try:
            balance = await rpc.get_token_account_balance(token_account_address)
            print(balance)
        except Exception as e:
            print(f"Error getting token balance: {e}")
            print("This might be because the account doesn't exist or isn't a token account")

if __name__ == "__main__":
    asyncio.run(main())
```

## Code Explanation

This example shows how to get the balance of a token account:

1. **Connect to RPC**: Use `AsyncClient` to connect to the Solana network
2. **Specify Token Account**: Use `Pubkey.from_string()` to create the token account public key
3. **Get Balance**: Call the `get_token_account_balance()` method to get balance information
4. **Error Handling**: Catch possible exceptions, such as account not existing or not being a token account

## Key Concepts

- **Token Account**: An account that stores a specific SPL token
- **Balance**: Contains information such as token amount and decimal places
- **RPC Method**: `get_token_account_balance` is used to query token account balance

## Usage

1. Replace `token_account_address` with the token account address you want to query
2. Run the script to get the balance information for that account
3. The returned result contains detailed information such as token amount and decimal places

## Important Notes

- Ensure the provided address is a valid token account address
- The account must exist and contain token data
- Network connection exceptions will throw corresponding errors