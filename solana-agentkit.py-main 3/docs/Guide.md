# Solana AgentKit Documentation

## Overview
Solana AgentKit is a Python package that enables developers to build AI-powered agents that can interact with the Solana blockchain. It combines the power of LangChain for AI capabilities with comprehensive Solana blockchain functionality.

## Installation

```bash
pip install solana-agentkit
```

## Quick Start

```python
from solana_agentkit import SolanaAgent
from solana_agentkit.tools import get_balance, transfer_tokens
from solana.keypair import Keypair

async def main():
    # Initialize agent
    agent = SolanaAgent(
        private_key="your_private_key",
        rpc_url="https://api.mainnet-beta.solana.com",
        openai_api_key="your_openai_key"  # Optional, for AI features
    )
    
    # Check balance
    balance = await agent.get_balance()
    print(f"Current balance: {balance} SOL")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Core Components

### 1. Agent Setup
The SolanaAgent class is the main interface for interacting with the blockchain:

```python
from solana_agentkit import SolanaAgent

agent = SolanaAgent(
    private_key="your_private_key",
    rpc_url="https://api.mainnet-beta.solana.com",
    config={
        "max_retries": 3,
        "commitment": "confirmed"
    }
)
```

### 2. Basic Operations

#### Check Balance
```python
# Get SOL balance
sol_balance = await agent.get_balance()

# Get token balance
token_balance = await agent.get_balance(token_address="token_mint_address")
```

#### Transfer Tokens
```python
from solana.publickey import PublicKey

# Transfer SOL
result = await agent.transfer(
    to=PublicKey("recipient_address"),
    amount=1.0  # in SOL
)

# Transfer SPL tokens
result = await agent.transfer(
    to=PublicKey("recipient_address"),
    amount=100.0,
    mint=PublicKey("token_mint_address")
)
```

### 3. NFT Operations

#### Deploy Collection
```python
result = await agent.deploy_collection({
    "name": "My Collection",
    "symbol": "MYCOL",
    "uri": "https://arweave.net/metadata.json",
    "seller_fee_basis_points": 500  # 5%
})
```

#### Mint NFT
```python
result = await agent.mint_nft(
    collection_mint="collection_address",
    metadata={
        "name": "My NFT",
        "symbol": "MNFT",
        "uri": "https://arweave.net/nft-metadata.json"
    }
)
```

### 4. DeFi Operations

#### Trading
```python
# Swap tokens using Jupiter
result = await agent.trade(
    output_mint=PublicKey("output_token_address"),
    input_amount=10.0,
    input_mint=PublicKey("input_token_address"),
    slippage_bps=50  # 0.5%
)
```

#### Lending
```python
# Lend tokens
result = await agent.lend_asset(
    asset=PublicKey("token_address"),
    amount=100.0
)
```

### 5. AI Features

#### Natural Language Processing
```python
# Process natural language commands
response = await agent.process_message(
    "Transfer 1 SOL to address ABC..."
)

# Generate NFT image
image_url = await agent.create_image(
    "A beautiful mountain landscape with sunset"
)
```

## Advanced Features

### 1. Wallet Management
```python
from solana_agentkit.utils import KeypairManager

# Create wallet manager
manager = KeypairManager()

# Add keypair
manager.add_keypair("main", keypair, save=True)

# Get wallet details
details = await agent.get_wallet_details()
print(f"SOL Balance: {details.sol_balance}")
print(f"Tokens: {len(details.token_balances)}")
```

### 2. Transaction Management
```python
from solana_agentkit.utils import TransactionBuilder

# Build complex transaction
builder = TransactionBuilder(agent)
builder.add_instruction(instruction1)
builder.add_instruction(instruction2)
signature = await builder.send()
```

### 3. Error Handling
```python
try:
    result = await agent.transfer(to=recipient, amount=amount)
except Exception as e:
    if "insufficient funds" in str(e):
        print("Not enough balance")
    else:
        print(f"Error: {e}")
```

## Best Practices

1. **RPC Node Selection**
   - Use reliable RPC nodes
   - Consider rate limits
   - Handle connection errors

```python
# Example with fallback RPC
agent = SolanaAgent(
    private_key=private_key,
    rpc_url=["https://rpc1.com", "https://rpc2.com"]
)
```

2. **Transaction Confirmation**
   - Always wait for confirmations
   - Use appropriate commitment levels

```python
result = await agent.transfer(
    to=recipient,
    amount=amount,
    opts={"commitment": "finalized"}
)
```

3. **Resource Management**
   - Close connections properly
   - Handle cleanup

```python
async with SolanaAgent(private_key, rpc_url) as agent:
    await agent.process_operations()
    # Automatic cleanup
```

## Development Tools

### Testing
```bash
# Run tests
pytest tests/

# With coverage
pytest --cov=solana_agentkit tests/
```

### Linting
```bash
# Format code
black src/ tests/

# Sort imports
isort src/ tests/
```

## Common Issues and Solutions

1. **Connection Issues**
   ```python
   # Retry logic
   from solana_agentkit.utils import retry_connection
   
   @retry_connection(max_attempts=3)
   async def get_data():
       return await agent.get_balance()
   ```

2. **Transaction Errors**
   ```python
   # Priority fee handling
   await agent.transfer(
       to=recipient,
       amount=amount,
       priority_fee={"compute_unit_price": 1000}
   )
   ```

## Support and Resources

- GitHub: [solana-agentkit](https://github.com/yourusername/solana-agentkit)
- Documentation: [Read the Docs](https://solana-agentkit.readthedocs.io/)
- Examples: Check the `examples/` directory in the repository

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.