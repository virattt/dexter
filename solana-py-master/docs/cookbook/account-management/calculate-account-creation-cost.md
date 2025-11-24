# Calculate Account Creation Cost

This example demonstrates how to calculate the minimum balance required for rent exemption for a Solana account.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Calculate Account Creation Cost
"""

import asyncio
from solana.rpc.async_api import AsyncClient

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    space = 1500  # bytes
    
    async with rpc:
        lamports = await rpc.get_minimum_balance_for_rent_exemption(space)
        print(f"Minimum balance for rent exemption: {lamports.value}")
        print(f"For account size: {space} bytes")
        print(f"Cost in SOL: {lamports.value / 1_000_000_000}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Set account size**: Define the account size in bytes (1500 bytes in this example)
2. **Get minimum balance**: Use `get_minimum_balance_for_rent_exemption()` to calculate the required lamports
3. **Display results**: Show the cost in lamports and convert to SOL for easier understanding

## Key Concepts

- **Rent exemption**: Accounts with sufficient balance are exempt from rent payments
- **Lamports**: The smallest unit of SOL (1 SOL = 1,000,000,000 lamports)
- **Account size**: Determines the minimum balance required for rent exemption

## Usage

```bash
python calculate_account_creation_cost.py
```

This will output something like:
```
Minimum balance for rent exemption: 10616160
For account size: 1500 bytes
Cost in SOL: 0.01061616
```