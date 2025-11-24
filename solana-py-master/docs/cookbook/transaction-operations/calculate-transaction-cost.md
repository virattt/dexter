# Calculate Transaction Cost

Learn how to calculate the cost of a Solana transaction before sending it, including both transfer amount and network fees.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Calculate Transaction Cost
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    amount = 1_000_000_000  # 1 SOL
    
    async with rpc:
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create transfer instruction
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient.pubkey(),
                lamports=amount
            )
        )
        
        # Create message
        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[transfer_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [sender])
        
        # Get fee for transaction
        fee_response = await rpc.get_fee_for_message(message)
        
        print(f"Transaction fee: {fee_response.value} lamports")
        print(f"Transaction fee: {fee_response.value / 1_000_000_000} SOL")
        
        # Calculate total cost (amount + fee)
        total_cost = amount + fee_response.value
        print(f"Total cost: {total_cost} lamports")
        print(f"Total cost: {total_cost / 1_000_000_000} SOL")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates how to calculate the total cost of a transaction:

1. **Create Transaction**: Build a standard transfer transaction
2. **Get Fee Estimate**: Use `get_fee_for_message()` to calculate the network fee
3. **Calculate Total Cost**: Add the transfer amount and the network fee
4. **Display Results**: Show fees in both lamports and SOL

## Key Concepts

- **Transaction Fees**: Network fees paid to validators for processing transactions
- **Fee Calculation**: Fees are calculated based on the transaction's computational requirements
- **Total Cost**: The sum of the transfer amount and network fees
- **Fee Estimation**: Getting fee estimates before sending transactions

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders
   ```

2. Run the script:
   ```bash
   python calculate_transaction_cost.py
   ```

The script will output:
- Transaction fee in lamports and SOL
- Total cost including transfer amount and fees

This is useful for budgeting and ensuring accounts have sufficient balance to cover both the transfer amount and network fees.