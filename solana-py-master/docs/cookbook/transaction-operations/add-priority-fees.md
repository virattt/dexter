# Add Priority Fees

Learn how to add priority fees to Solana transactions to increase the likelihood of faster processing during network congestion.

## Code Example

```python
#!/usr/bin/env python3
"""
Solana Cookbook - How to Add Priority Fees to a Transaction
"""

import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction
from solders.pubkey import Pubkey
from solders.compute_budget import set_compute_unit_price

# Compute Budget Program ID
COMPUTE_BUDGET_PROGRAM_ID = Pubkey.from_string("ComputeBudget111111111111111111111111111111")

async def main():
    rpc = AsyncClient("https://api.devnet.solana.com")
    
    sender = Keypair()
    recipient = Keypair()
    
    amount = 1_000_000_000  # 1 SOL
    priority_fee_lamports = 5000  # 5000 lamports priority fee
    
    async with rpc:
        # Get latest blockhash
        latest_blockhash = await rpc.get_latest_blockhash()
        
        # Create priority fee instruction
        priority_fee_instruction = set_compute_unit_price(priority_fee_lamports)
        
        # Create transfer instruction
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient.pubkey(),
                lamports=amount
            )
        )
        
        # Create message with priority fee instruction first
        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[priority_fee_instruction, transfer_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash
        )
        
        # Create transaction
        transaction = VersionedTransaction(message, [sender])
        
        print(f"Sender: {sender.pubkey()}")
        print(f"Recipient: {recipient.pubkey()}")
        print(f"Transfer Amount: {amount / 1_000_000_000} SOL")
        print(f"Priority Fee: {priority_fee_lamports} lamports")
        print(f"Transaction with priority fee created successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

This example demonstrates how to add priority fees to transactions:

1. **Import Compute Budget**: Use the compute budget program for priority fees
2. **Set Priority Fee**: Define the priority fee amount in lamports
3. **Create Priority Fee Instruction**: Use `set_compute_unit_price()` to create the instruction
4. **Combine Instructions**: Include priority fee instruction before the main instruction
5. **Create Transaction**: Build the transaction with both instructions

## Key Concepts

- **Priority Fees**: Additional fees paid to validators for faster transaction processing
- **Compute Budget Program**: System program that manages compute unit pricing
- **Compute Unit Price**: The price per compute unit in micro-lamports
- **Instruction Ordering**: Priority fee instructions should come first in the transaction
- **Network Congestion**: Priority fees are most effective during high network usage

## Usage

To run this example:

1. Install required dependencies:
   ```bash
   pip install solana-py solders
   ```

2. Run the script:
   ```bash
   python add_priority_fees.py
   ```

## Priority Fee Strategies

Different scenarios for priority fees:

- **Low Priority**: 0-1000 lamports for standard transactions
- **Medium Priority**: 1000-5000 lamports for time-sensitive transactions
- **High Priority**: 5000+ lamports for urgent transactions during congestion

## Benefits

- **Faster Processing**: Higher priority fees increase chances of faster inclusion
- **Congestion Management**: Helps during network congestion periods
- **MEV Protection**: Can help protect against MEV (Maximal Extractable Value) attacks
- **Predictable Costs**: Set known additional cost for transaction priority

Note: Priority fees are burned (destroyed) rather than going to validators, making them a deflationary mechanism.