# Solana AgentKit Documentation

Welcome to the Solana AgentKit documentation! This Python package provides tools and utilities for building AI agents that can interact with the Solana blockchain.

## Quick Start

### Installation

```bash
# Basic installation
pip install solana-agentkit

# With development tools
pip install solana-agentkit[dev]

# With documentation tools
pip install solana-agentkit[docs]
```

### Basic Usage

```python
from solana_agentkit import SolanaAgent
from solana_agentkit.tools import transfer_tokens, get_balance

# Initialize agent
agent = SolanaAgent(
    private_key="your_private_key",
    rpc_url="https://api.mainnet-beta.solana.com"
)

# Check balance
balance = await agent.get_balance()
print(f"Current balance: {balance} SOL")

# Transfer tokens
result = await agent.transfer(
    to="recipient_address",
    amount=1.0
)
print(f"Transfer successful: {result.signature}")
```

## Features

### Core Components

- **Agent Framework**: Build and deploy AI agents on Solana
- **Transaction Tools**: Simplified transaction creation and management
- **NFT Utilities**: Create and manage NFT collections
- **Token Tools**: Deploy and manage SPL tokens
- **Domain Management**: Register and manage .sol domains

### AI Integration

- LangChain integration for AI capabilities
- OpenAI integration for image generation
- Custom agent behaviors and personalities
- Natural language processing for commands

### Blockchain Features

- Wallet management
- Transaction building
- Priority fee handling
- Multi-signature support

## Development

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/arhansuba/solana-agentkit
cd solana-agentkit

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Unix
# or
.\venv\Scripts\activate  # Windows

# Install development dependencies
pip install -r requirements.txt
```

### Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest --cov=solana_agentkit tests/
```

### Code Style

We use Black for code formatting and isort for import sorting:

```bash
# Format code
black src/ tests/

# Sort imports
isort src/ tests/
```

## Project Structure

```
solana-agentkit/
├── docs/               # Documentation
├── src/               # Source code
│   └── solana_agentkit/
│       ├── agent/     # Agent implementations
│       ├── tools/     # Blockchain tools
│       └── utils/     # Utility functions
├── tests/             # Test suite
└── examples/          # Usage examples
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- GitHub Issues: [Report bugs](https://github.com/arhansuba/solana-agentkit/issues)
- Documentation: [Read the docs](https://solana-agentkit.readthedocs.io/)
- Discord: [Join our community](#)

## Acknowledgments

- Solana Foundation
- LangChain team
- All contributors