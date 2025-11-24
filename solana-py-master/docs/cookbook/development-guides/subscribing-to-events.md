# Subscribing to Events

This example demonstrates how to subscribe to Solana blockchain events using WebSocket connections.

## Code

```python
#!/usr/bin/env python3
"""
Solana Cookbook - Subscribing to Events
"""

import asyncio
from solana.rpc.websocket_api import connect
from solders.keypair import Keypair

async def main():
    keypair = Keypair()
    
    async with connect("wss://api.devnet.solana.com") as websocket:
        # Subscribe to account changes
        await websocket.account_subscribe(keypair.pubkey())
        
        # Subscribe to logs
        await websocket.logs_subscribe()
        
        # Listen for messages
        async for message in websocket:
            print(f"Received: {message}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Explanation

1. **Create WebSocket connection**: Connect to the Solana WebSocket endpoint
2. **Subscribe to account changes**: Monitor changes to a specific account
3. **Subscribe to logs**: Listen to transaction logs
4. **Process messages**: Handle incoming event messages

## Subscription Types

- **account_subscribe**: Monitor account data changes
- **logs_subscribe**: Listen to transaction logs
- **program_subscribe**: Monitor program account changes
- **signature_subscribe**: Track transaction confirmations
- **slot_subscribe**: Monitor slot changes

## Key Concepts

- **Real-time updates**: WebSocket provides real-time blockchain data
- **Event-driven**: React to blockchain events as they happen
- **Asynchronous**: Use async/await for non-blocking operations

## Usage

```bash
python subscribing_to_events.py
```

The script will run continuously, printing events as they occur.

## Network Endpoints

- **Devnet**: wss://api.devnet.solana.com
- **Testnet**: wss://api.testnet.solana.com  
- **Mainnet**: wss://api.mainnet-beta.solana.com