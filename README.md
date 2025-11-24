# Dexter 🤖 & Dark Dexter 🌑

Dexter is an autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for financial research.

**Dark Dexter** is the next evolution - a Solana-native AI agent with its own smart wallet, real-time blockchain data access, and 200+ DeFi tools powered by GOAT SDK. It combines traditional financial research with on-chain analytics, token trading, and autonomous wallet operations.

<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Dexter takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

**Dexter Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

**Dark Dexter Key Capabilities:**
- **Autonomous Solana Wallet**: Automatically creates and manages Crossmint smart wallets with MPC custody
- **Real-Time Blockchain Data**: Helius DAS API for NFTs, compressed NFTs, and on-chain asset data
- **Live Token Analytics**: BirdEye integration for trending tokens, prices, and portfolio tracking
- **200+ DeFi Tools**: Full GOAT SDK integration with Jupiter DEX, Lulo Finance, CoinGecko, DexScreener, RugCheck, and Nansen
- **On-Chain Trading**: Execute token swaps, manage liquidity, and earn yield on Solana
- **Security Analysis**: Built-in rug pull detection and token security scoring
- **Wallet Intelligence**: Multi-source balance checking and portfolio analytics
- **AI-Powered Trading**: LangChain integration for autonomous DeFi operations

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

<img width="996" height="639" alt="Screenshot 2025-11-22 at 1 45 07 PM" src="https://github.com/user-attachments/assets/8915fd70-82c9-4775-bdf9-78d5baf28a8a" />


### Prerequisites

**For Dexter:**
- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- Financial Datasets API key (get [here](https://financialdatasets.ai))

**Additional for Dark Dexter:**
- Helius API key (get [here](https://www.helius.dev/))
- BirdEye API key (get [here](https://birdeye.so/))
- Crossmint API key (get [here](https://www.crossmint.com/))
- Optional: CoinGecko API key for enhanced data (get [here](https://www.coingecko.com/en/api))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. Install dependencies with uv:
```bash
uv sync
```

3. Set up your environment variables:
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your API keys:

# Core Dexter APIs
OPENAI_API_KEY=your-openai-api-key
FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# Dark Dexter - Blockchain APIs
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=your-helius-api-key
BIRDEYE_API_KEY=your-birdeye-api-key

# Dark Dexter - Wallet & DeFi
CROSSMINT_API_KEY=your-crossmint-api-key
COINGECKO_API_KEY=your-coingecko-api-key  # Optional

# Dark Dexter - Wallet Configuration
WALLET_TYPE=fireblocks  # or 'keypair'
FIREBLOCKS_API_KEY=your-fireblocks-key  # If using Fireblocks
```

### Usage

**Run Dexter in interactive mode:**
```bash
uv run dexter-agent
```

**Run Dark Dexter with autonomous wallet and DeFi capabilities:**
```bash
python dark_dexter.py
```

Dark Dexter will automatically:
1. Display awesome ASCII art banner
2. Create a Crossmint smart wallet (if not exists)
3. Show trending Solana tokens from BirdEye
4. Display wallet balances from multiple sources (Helius DAS, BirdEye, Jupiter)
5. Provide full access to 200+ GOAT SDK DeFi tools

### Example Queries

Try asking Dexter questions like:
- "What was Apple's revenue growth over the last 4 quarters?"
- "Compare Microsoft and Google's operating margins for 2023"
- "Analyze Tesla's cash flow trends over the past year"
- "What is Amazon's debt-to-equity ratio based on recent financials?"

Dexter will automatically:
1. Break down your question into research tasks
2. Fetch the necessary financial data
3. Perform calculations and analysis
4. Provide a comprehensive, data-rich answer

## Architecture

Dexter uses a multi-agent architecture with specialized components:

- **Planning Agent**: Analyzes queries and creates structured task lists
- **Action Agent**: Selects appropriate tools and executes research steps
- **Validation Agent**: Verifies task completion and data sufficiency
- **Answer Agent**: Synthesizes findings into comprehensive responses

## Project Structure

```
dexter/
├── dark_dexter.py                    # Dark Dexter startup script
├── src/
│   ├── dexter/
│   │   ├── agent.py                  # Main agent orchestration logic
│   │   ├── model.py                  # LLM interface
│   │   ├── tools/                    # Tool integrations
│   │   │   ├── finance/              # Traditional finance APIs
│   │   │   ├── helius/               # Helius DAS API (NFTs, cNFTs)
│   │   │   ├── birdeye/              # BirdEye token analytics
│   │   │   ├── crossmint/            # Crossmint smart wallets
│   │   │   └── goat_plugins/         # GOAT SDK plugin wrappers
│   │   ├── prompts.py                # System prompts
│   │   ├── schemas.py                # Pydantic models
│   │   ├── utils/                    # Utility functions
│   │   └── cli.py                    # CLI entry point
├── examples/                         # Example scripts
│   ├── helius_example.py             # Helius API examples
│   ├── crossmint_example.py          # Crossmint wallet examples
│   └── goat_plugins_example.py       # GOAT SDK plugin examples
├── docs/                             # Documentation
│   ├── HELIUS_INTEGRATION.md         # Helius setup guide
│   ├── DARK_DEXTER.md                # Dark Dexter overview
│   └── CROSSMINT_INTEGRATION.md      # Crossmint & GOAT SDK guide
├── pyproject.toml
└── uv.lock
```

## Documentation

### Core Dexter
- **Getting Started**: See installation and usage sections above
- **Configuration**: Customize agent behavior via initialization parameters

### Dark Dexter
- **[Dark Dexter Overview](docs/DARK_DEXTER.md)**: Introduction to Dark Dexter capabilities and architecture
- **[Helius Integration Guide](docs/HELIUS_INTEGRATION.md)**: Complete guide to Helius DAS API integration
- **[Crossmint & GOAT SDK Guide](docs/CROSSMINT_INTEGRATION.md)**: Comprehensive wallet and DeFi plugin documentation
- **[User Guide](docs/DARK_DEXTER_USER_GUIDE.md)**: Complete reference for all Dark Dexter features

### Examples
- `examples/helius_example.py`: Helius DAS API operations (getAsset, getAssetBatch, searchAssets, etc.)
- `examples/crossmint_example.py`: Crossmint wallet creation, balance checking, and transactions
- `examples/goat_plugins_example.py`: GOAT SDK plugin usage with AI agent integration

## Configuration

Dexter supports configuration via the `Agent` class initialization:

```python
from dexter.agent import Agent

agent = Agent(
    max_steps=20,              # Global safety limit
    max_steps_per_task=5       # Per-task iteration limit
)
```

Dark Dexter configuration is managed through environment variables (see Installation section).

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.
