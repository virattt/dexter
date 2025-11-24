# Optimize Compute Requested

Learn how to optimize compute unit requests for Solana transactions to reduce costs and improve efficiency.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Optimize Compute Requested
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.compute_budget import set_compute_unit_limit, set_compute_unit_price

async def get_simulation_compute_units(rpc, instructions, payer_pubkey, lookup_tables=[]):
    """Simulate transaction to get actual compute units needed"""
    try:
        recent_blockhash = await rpc.get_latest_blockhash()
        
        message = MessageV0.try_compile(
            payer=payer_pubkey,
            instructions=instructions,
            address_lookup_table_accounts=lookup_tables,
            recent_blockhash=recent_blockhash.value.blockhash
        )
        
        transaction = VersionedTransaction(message, [])
        
        simulation_result = await rpc.simulate_transaction(transaction)
        
        if simulation_result.value.err:
            print(f"Simulation error: {simulation_result.value.err}")
            return 200000  # Fallback value
        
        units_consumed = simulation_result.value.units_consumed
        if units_consumed:
            return units_consumed
        else:
            return 200000  # Fallback value
            
    except Exception as e:
        print(f"Error during simulation: {e}")
        return 200000  # Fallback value

async def build_optimal_transaction(rpc, instructions, signer, lookup_tables=[]):
    """Build optimal transaction with precise compute unit limits"""
    micro_lamports = 100  # Priority fee per compute unit
    units = await get_simulation_compute_units(rpc, instructions, signer.pubkey(), lookup_tables)
    recent_blockhash = await rpc.get_latest_blockhash()
    
    # Add compute budget instructions
    compute_budget_instructions = [
        set_compute_unit_limit(units),
        set_compute_unit_price(micro_lamports)
    ]
    
    all_instructions = compute_budget_instructions + instructions
    
    message = MessageV0.try_compile(
        payer=signer.pubkey(),
        instructions=all_instructions,
        address_lookup_table_accounts=lookup_tables,
        recent_blockhash=recent_blockhash.value.blockhash
    )
    
    return VersionedTransaction(message, [signer])

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    amount = 1_000_000_000  # 1 SOL
    
    async with rpc:
        # Create transfer instruction
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient.pubkey(),
                lamports=amount
            )
        )
        
        # Build optimized transaction
        optimized_transaction = await build_optimal_transaction(
            rpc, 
            [transfer_instruction], 
            sender
        )
        
        print(f"Sender: {sender.pubkey()}")
        print(f"Recipient: {recipient.pubkey()}")
        print(f"Transfer Amount: {amount / 1_000_000_000} SOL")
        print(f"Optimized transaction created successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates how to optimize compute unit requests:

1. **Simulate Transaction**: Use `simulate_transaction()` to get actual compute units needed
2. **Get Optimal Units**: Determine the precise compute units required
3. **Set Compute Limits**: Use `set_compute_unit_limit()` to avoid overpaying
4. **Add Priority Fees**: Set compute unit price for priority processing
5. **Build Optimal Transaction**: Combine all instructions efficiently

## Key Concepts

- **Compute Units**: Measure of computational resources needed for transaction processing
- **Compute Budget Program**: System program for managing compute unit limits and pricing
- **Transaction Simulation**: Testing transaction execution without actually submitting it
- **Compute Unit Limit**: Maximum compute units a transaction can consume
- **Compute Unit Price**: Price per compute unit in micro-lamports

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders
   ```

2. Run the script:
   ```bash
   python optimize_compute_requested.py
   ```

## Benefits

- **Cost Reduction**: Pay only for actual compute units used
- **Efficiency**: Avoid over-allocating compute resources
- **Faster Processing**: Optimal compute budgets can improve transaction processing
- **Network Health**: Better resource utilization for the network

## Best Practices

1. **Always Simulate**: Use transaction simulation before submission
2. **Add Buffer**: Add small buffer (10-20%) to simulation results
3. **Monitor Usage**: Track compute unit consumption patterns
4. **Update Regularly**: Recheck compute requirements as programs change

Note: Compute unit optimization is especially important for complex transactions and during network congestion.