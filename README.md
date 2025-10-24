# Maximus 🤖

Maximus is an autonomous agent for onchain asset analysis and transaction execution. It thinks, plans, and learns as it works, performing comprehensive analysis using task planning, self-reflection, and real-time market data. Think Claude Code, but built specifically for onchain operations.


<img width="979" height="651" alt="Screenshot 2025-10-14 at 6 12 35 PM" src="https://github.com/user-attachments/assets/5a2859d4-53cf-4638-998a-15cef3c98038" />

## Overview

Maximus takes complex onchain tasks and turns them into clear, step-by-step execution plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed outcome.  

It's not just another chatbot. It's an agent that plans ahead, verifies its progress, and keeps iterating until the job is done—whether that's analyzing assets or executing transactions.

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured execution steps
- **Autonomous Execution**: Selects and executes the right tools for analysis and transaction operations
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Conversational Memory**: Remembers past queries within a session using Capi memory API
- **Real-Time Onchain Data**: Access to prices, market data, OHLC charts, and asset information from CoinGecko
- **Flexible Identifiers**: Supports both CoinGecko IDs (bitcoin, ethereum) and ticker symbols (BTC, ETH)
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

### Prerequisites

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- OpenAI API key (get [here](https://platform.openai.com/api-keys))
- CoinGecko Pro API key (get [here](https://www.coingecko.com/en/api/pricing))
- Capi API key for memory (get [here](https://capi.dev/sign-up)) - Optional but recommended

### Installation

1. Clone the repository:
```bash
git clone https://github.com/virattt/maximus.git
cd maximus
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
# CAPI_API_KEY=your-capi-api-key (optional, for conversational memory)
```

### Usage

Run Maximus in interactive mode:
```bash
uv run maximus-agent
```

### Example Queries

Try asking Maximus questions like:
- "What is Bitcoin's current price and market cap?"
- "Compare the 30-day price performance of Ethereum and Solana"
- "What are the top 10 cryptocurrencies by market cap?"
- "Show me the 7-day OHLC data for BTC"
- "What are the trending cryptocurrencies right now?"
- "Get detailed information about Cardano"

Maximus will automatically:
1. Break down your request into actionable tasks
2. Fetch the necessary onchain data from CoinGecko
3. Perform calculations and analysis
4. Provide a comprehensive, data-rich response

### Memory Feature

Maximus has conversational memory powered by Capi, allowing it to remember and reference past interactions within a session:

**Follow-up questions:**
```
>> What's the 24h trading volume for BTC and SOL?
[... Maximus provides the data ...]

>> repeat the last data points to me
[... Maximus recalls and repeats the previous answer ...]

>> what about Ethereum?
[... Maximus understands the context and fetches Ethereum's trading volume ...]
```

**Memory commands:**
- `/clear-mem` or `/clear-memory` - Delete all memories from the current session using Capi's forgetMemory API
- `exit` or `quit` - Exit Maximus (memories are automatically deleted)

**Note:** Memory is session-based. Each time you start Maximus, you get a fresh session with no memory from previous runs. When you exit or use `/clear-mem`, memories are permanently deleted from Capi's storage.

## Architecture

Maximus uses a multi-agent architecture with specialized components:

- **Planning Agent**: Analyzes requests and creates structured task lists
- **Action Agent**: Selects appropriate tools and executes operations
- **Validation Agent**: Verifies task completion and data sufficiency
- **Answer Agent**: Synthesizes findings into comprehensive responses

## Available Tools

Maximus has access to the following onchain data and analysis tools:

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
maximus/
├── src/
│   ├── maximus/
│   │   ├── agent.py      # Main agent orchestration logic
│   │   ├── model.py      # LLM interface
│   │   ├── prompts.py    # System prompts for each component
│   │   ├── schemas.py    # Pydantic models
│   │   ├── tools/        # Onchain data and analysis tools
│   │   │   ├── api.py    # CoinGecko API client
│   │   │   ├── prices.py # Price and OHLC data tools
│   │   │   ├── market.py # Market overview tools
│   │   │   └── info.py   # Asset information tools
│   │   ├── utils/        # Utility functions
│   │   └── cli.py        # CLI entry point
├── pyproject.toml
└── uv.lock
```

## Configuration

Maximus supports configuration via the `Agent` class initialization:

```python
from maximus.agent import Agent

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

## Troubleshooting

### Memory Not Working

If you're seeing Capi API calls in your dashboard but memory doesn't seem to be working:

1. **Check API Key**: Ensure `CAPI_API_KEY` is set in your `.env` file
2. **Check Debug Output**: Look for memory-related logs:
   - `💾 Session initialized with memory` - Session started successfully
   - `💾 Memory saved successfully` - Memory was stored
   - `💾 Retrieved X relevant memory item(s)` - Memories were found
3. **Wait for Embedding**: Capi needs a moment to embed memories. Try:
   - Ask a question and get an answer
   - Wait 1-2 seconds
   - Ask a follow-up question that references the previous one
4. **Test with Simple Query**:
   ```
   >> What is the price of Bitcoin?
   [wait for answer]
   >> repeat that
   [should recall the Bitcoin price]
   ```

If you see warnings like `⚠️ Memory storage disabled` or `⚠️ Failed to store memory`, check your API key and network connection.

### Connection Issues

If you encounter connection errors, try:
- Check your internet connection
- Verify your API keys are valid
- Try again in a few moments (API rate limits)

## License

This project is licensed under the MIT License.

