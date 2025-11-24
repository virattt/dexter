# Get Token Mint

This example shows how to retrieve token mint information from a Solana token.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Get a Token Mint
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey
from spl.token._layouts import MINT_LAYOUT
from spl.token.core import MintInfo

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    mint_address = Pubkey.from_string("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    
    async with rpc:
        # Get account info
        account_info = await rpc.get_account_info(mint_address)
        
        # Parse mint data using layout
        mint_data = MINT_LAYOUT.parse(account_info.value.data)
        
        # Create MintInfo object
        mint_info = MintInfo(
            mint_authority=mint_data.mint_authority,
            supply=mint_data.supply,
            decimals=mint_data.decimals,
            is_initialized=mint_data.is_initialized,
            freeze_authority=mint_data.freeze_authority
        )
        
        print(f"Mint Address: {mint_address}")
        print(f"Decimals: {mint_info.decimals}")
        print(f"Supply: {mint_info.supply}")
        print(f"Is Initialized: {mint_info.is_initialized}")
        print(f"Freeze Authority: {mint_info.freeze_authority}")
        print(f"Mint Authority: {mint_info.mint_authority}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Get account info**: Retrieve the raw account data for the mint
2. **Parse mint data**: Use the MINT_LAYOUT to parse the binary data
3. **Create MintInfo**: Convert parsed data into a structured MintInfo object
4. **Display information**: Show all the mint properties

## Key Concepts

- **Mint account**: Contains metadata about a token type
- **Decimals**: Number of decimal places for the token
- **Supply**: Total number of tokens in circulation
- **Authorities**: Accounts that can mint tokens or freeze accounts
- **Initialization**: Whether the mint has been properly set up

## Usage

```bash
python get_token_mint.py
```

This will output:
```
Mint Address: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
Decimals: 6
Supply: 1000000000
Is Initialized: True
Freeze Authority: None
Mint Authority: AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2
```