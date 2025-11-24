# Getting Test SOL

This example shows how to request an airdrop of SOL on the Solana devnet for testing purposes.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - Getting Test SOL
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair

async def main():
    keypair = Keypair()
    
    async with AsyncClient("https://api.devnet.solana.com") as client:
        # Request airdrop (1 SOL = 1_000_000_000 lamports)
        res = await client.request_airdrop(keypair.pubkey(), 1_000_000_000)
        print(f"Airdrop signature: {res.value}")
        
        # Check balance
        balance = await client.get_balance(keypair.pubkey())
        print(f"Balance: {balance.value} lamports")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Create a keypair**: Generate a new keypair for testing
2. **Request airdrop**: Use `request_airdrop()` to get 1 SOL from the devnet faucet
3. **Check balance**: Verify the airdrop was successful by checking the account balance

## Key Points

- **Devnet only**: Airdrops are only available on devnet and testnet, not mainnet
- **Amount limits**: Each airdrop request is limited to 1 SOL
- **Rate limits**: There are rate limits on airdrop requests per account
- **Lamports**: 1 SOL = 1,000,000,000 lamports

## Usage

```bash
python getting_test_sol.py
```

This will output:
```
Airdrop signature: 5J8...abc
Balance: 1000000000 lamports
```

## Alternative Methods

You can also get test SOL from:
- [Solana Faucet](https://faucet.solana.com/) - Web interface
- `solana airdrop` CLI command