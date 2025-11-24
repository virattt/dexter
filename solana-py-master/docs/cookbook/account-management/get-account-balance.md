# Get Account Balance

This example shows how to retrieve an account's balance on the Solana blockchain.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Get Account Balance
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Example public key (you can replace with any valid public key)
    account_pubkey = Pubkey.from_string("11111111111111111111111111111111")
    
    async with rpc:
        # Get account balance
        balance = await rpc.get_balance(account_pubkey)
        
        print(f"Account: {account_pubkey}")
        print(f"Balance: {balance.value} lamports")
        print(f"Balance: {balance.value / 1_000_000_000} SOL")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Create RPC client**: Connect to the Solana devnet
2. **Parse public key**: Convert string representation to Pubkey object
3. **Get balance**: Use `get_balance()` to retrieve the account balance
4. **Display results**: Show balance in both lamports and SOL

## Key Concepts

- **Lamports**: The smallest unit of SOL (1 SOL = 1,000,000,000 lamports)
- **Account balance**: The amount of SOL held by an account
- **Public key**: The account's address on the blockchain

## Usage

```bash
python get_account_balance.py
```

This will output:
```
Account: 11111111111111111111111111111111
Balance: 1000000000 lamports
Balance: 1.0 SOL
```

## Error Handling

If the account doesn't exist, the balance will be 0:

```python
async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    # Non-existent account
    account_pubkey = Pubkey.from_string("22222222222222222222222222222222")
    
    async with rpc:
        try:
            balance = await rpc.get_balance(account_pubkey)
            print(f"Balance: {balance.value} lamports")
        except Exception as e:
            print(f"Error: {e}")
```

## Network Endpoints

- **Devnet**: https://api.devnet.solana.com
- **Testnet**: https://api.testnet.solana.com
- **Mainnet**: https://api.mainnet-beta.solana.com