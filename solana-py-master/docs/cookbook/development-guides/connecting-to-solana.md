# Connecting to Solana

This example shows how to connect to a Solana environment and check the connection status.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - Connecting to a Solana Environment
"""

import asyncio
from solana.rpc.async_api import AsyncClient

async def main():
    async with AsyncClient("https://api.devnet.solana.com") as client:
        res = await client.is_connected()
    print(res)  # True

asyncio.run(main())
```

## Explanation

1. **Import required modules**: We import `asyncio` for async operations and `AsyncClient` from solana.rpc.async_api
2. **Create async client**: Initialize an async client with the Solana devnet RPC endpoint
3. **Check connection**: Use `is_connected()` to verify the connection status
4. **Print result**: The result should be `True` if connected successfully

## Usage

Run this script to test your connection to the Solana devnet:

```bash
python connecting_to_solana.py
```

## Network Endpoints

- **Devnet**: https://api.devnet.solana.com
- **Testnet**: https://api.testnet.solana.com  
- **Mainnet**: https://api.mainnet-beta.solana.com