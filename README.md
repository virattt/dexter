# Dexter 🤖

Dexter is an autonomous cryptocurrency research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for cryptocurrency research.


<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Dexter takes complex cryptocurrency questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.  

It’s not just another chatbot.  It’s an agent that plans ahead, verifies its progress, and keeps iterating until the job is done.

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather cryptocurrency data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Crypto Data**: Access to prices, market data, OHLC charts, and coin information from CoinGecko
- **Flexible Identifiers**: Supports both CoinGecko IDs (bitcoin, ethereum) and ticker symbols (BTC, ETH)
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

### Prerequisites

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- CoinGecko Pro API key (get [here](https://www.coingecko.com/en/api/pricing))

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

# Edit .env and add your API keys
# OPENAI_API_KEY=your-openai-api-key
# COINGECKO_API_KEY=your-coingecko-api-key
```

### Usage

Run Dexter in interactive mode:
```bash
uv run dexter-agent
```

### Example Queries

Try asking Dexter questions like:
- "What is Bitcoin's current price and market cap?"
- "Compare the 30-day price performance of Ethereum and Solana"
- "What are the top 10 cryptocurrencies by market cap?"
- "Show me the 7-day OHLC data for BTC"
- "What are the trending cryptocurrencies right now?"
- "Get detailed information about Cardano"

Dexter will automatically:
1. Break down your question into research tasks
2. Fetch the necessary cryptocurrency data from CoinGecko
3. Perform calculations and analysis
4. Provide a comprehensive, data-rich answer

## Architecture

Dexter uses a multi-agent architecture with specialized components:

- **Planning Agent**: Analyzes queries and creates structured task lists
- **Action Agent**: Selects appropriate tools and executes research steps
- **Validation Agent**: Verifies task completion and data sufficiency
- **Answer Agent**: Synthesizes findings into comprehensive responses

## Available Tools

Dexter has access to the following cryptocurrency research tools:

**Price Data:**
- `get_price_snapshot`: Current price, market cap, volume, and 24h changes
- `get_historical_prices`: Historical price data over specified time periods
- `get_ohlc_data`: OHLC candlestick data for technical analysis

**Market Overview:**
- `get_top_cryptocurrencies`: Top cryptocurrencies ranked by market cap or volume
- `get_global_market_data`: Global crypto market statistics and metrics
- `get_trending_coins`: Currently trending cryptocurrencies

**Coin Information:**
- `get_coin_info`: Detailed information about a cryptocurrency project
- `search_cryptocurrency`: Search for cryptocurrencies by name or symbol

## Project Structure

```
dexter/
├── src/
│   ├── dexter/
│   │   ├── agent.py      # Main agent orchestration logic
│   │   ├── model.py      # LLM interface
│   │   ├── prompts.py    # System prompts for each component
│   │   ├── schemas.py    # Pydantic models
│   │   ├── tools/        # Cryptocurrency data tools
│   │   │   ├── api.py    # CoinGecko API client
│   │   │   ├── prices.py # Price and OHLC data tools
│   │   │   ├── market.py # Market overview tools
│   │   │   └── info.py   # Coin information tools
│   │   ├── utils/        # Utility functions
│   │   └── cli.py        # CLI entry point
├── pyproject.toml
└── uv.lock
```

## Configuration

Dexter supports configuration via the `Agent` class initialization:

```python
from dexter.agent import Agent

agent = Agent(
    max_steps=20,              # Global safety limit
    max_steps_per_task=5       # Per-task iteration limit
)
```

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep your pull requests small and focused.  This will make it easier to review and merge.


## License

This project is licensed under the MIT License.

