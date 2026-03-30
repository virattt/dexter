# Dexter for Forex

Dexter for Forex is an autonomous trade analysis agent specialized in FX, stock indices, gold, and other CFD instruments — optimized for Fintokei prop trading challenges. It performs multi-timeframe analysis, risk management, position sizing, and trade journaling. Think Claude Code, but built specifically for forex and CFD trade analysis.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [How to Install](#how-to-install)
- [How to Run](#how-to-run)
- [Tools & Capabilities](#tools--capabilities)
- [Skills](#skills)
- [Fintokei Integration](#fintokei-integration)
- [How to Debug](#how-to-debug)
- [How to Use with WhatsApp](#how-to-use-with-whatsapp)
- [How to Contribute](#how-to-contribute)
- [License](#license)


## Overview

Dexter for Forex takes trade ideas and market questions, then performs comprehensive analysis using live market data, technical indicators, and economic calendars — always within the context of Fintokei challenge rules.

**Key Capabilities:**
- **Multi-Timeframe Analysis**: Automatically analyzes Daily, H4, H1, and lower timeframes for confluence
- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, ADX, Ichimoku, Stochastic, and more
- **Economic Calendar**: Checks upcoming high-impact events before recommending trades
- **Fintokei Risk Management**: Position sizing respecting daily loss limits, drawdown limits, and profit targets
- **Trade Journal**: Record, track, and analyze trading performance with detailed statistics
- **Account Health Monitor**: Real-time challenge progress tracking with actionable recommendations
- **Persistent Memory**: Remembers your Fintokei plan, preferred instruments, and trading style across sessions

**Supported Instruments:**
- **FX Majors**: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
- **FX Minors/Crosses**: EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, and 15+ more
- **Stock Indices**: JP225 (Nikkei), US30 (Dow), US500 (S&P), NAS100 (Nasdaq), GER40 (DAX), UK100 (FTSE), FRA40, AUS200, HK50
- **Commodities**: XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI), UKOIL (Brent)


## Prerequisites

- [Bun](https://bun.com) runtime (v1.0 or higher)
- LLM API key (OpenAI, Anthropic, Google, xAI, or others)
- Twelve Data API key (get free at [twelvedata.com](https://twelvedata.com/)) — for market data, indicators, and economic calendar
- Exa API key (optional, for web search) — get at [exa.ai](https://exa.ai)

#### Installing Bun

**macOS/Linux:**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

After installation, restart your terminal and verify:
```bash
bun --version
```

## How to Install

1. Clone the repository:
```bash
git clone https://github.com/yuya-sugita/dexter-for-forex.git
cd dexter-for-forex
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp env.example .env

# Edit .env and add your API keys:
# OPENAI_API_KEY=your-openai-api-key        (or ANTHROPIC_API_KEY, GOOGLE_API_KEY, etc.)
# TWELVE_DATA_API_KEY=your-twelve-data-key   (market data & indicators)
# EXASEARCH_API_KEY=your-exa-api-key         (optional: web search)
```

## How to Run

Run Dexter in interactive mode:
```bash
bun start
```

Or with watch mode for development:
```bash
bun dev
```

### Example Queries

```
> EUR/USDを分析して、エントリーポイントを教えて
> ゴールドの日足と4時間足のトレンドを確認して
> 今日のドル円に影響する経済指標は？
> Fintokeiチャレンジの残りのリスク予算を計算して
> 口座残高200万円、リスク1%でGBP/JPYの適正ロット数は？
> 今週のトレード成績をまとめて
> US30のRSIとMACDを4時間足で確認して
```


## Tools & Capabilities

| Tool | Description |
|------|-------------|
| `get_market_data` | Current prices, historical OHLCV, and technical indicators for all Fintokei instruments |
| `economic_calendar` | Upcoming economic events with impact levels and affected instruments |
| `get_fintokei_rules` | Challenge rules, profit targets, drawdown limits by plan type |
| `calculate_position_size` | Position sizing respecting per-trade risk and daily loss limits |
| `check_account_health` | Account status against challenge rules with recommendations |
| `record_trade` | Record new trades in the journal |
| `close_trade` | Close trades with P&L calculation |
| `get_trade_stats` | Performance analysis (win rate, R:R, profit factor, streaks) |
| `get_trade_history` | Review recent trades and open positions |
| `web_search` | Web search for market news and analysis |
| `web_fetch` | Fetch and extract content from web pages |
| `browser` | Browser automation for interactive web content |
| `memory_*` | Persistent memory for user preferences and trading history |


## Skills

Skills are specialized workflows that provide step-by-step analysis for complex tasks:

| Skill | Trigger | Description |
|-------|---------|-------------|
| `trade-analysis` | "analyze EUR/USD", "check this setup", "find trade opportunities" | Multi-timeframe analysis with confluence scoring, key levels, and complete trade plans |
| `fintokei-challenge` | "challenge progress", "account health", "how to pass" | Challenge dashboard with drawdown status, profit target progress, and risk recommendations |
| `risk-management` | "position sizing", "correlation risk", "portfolio heat" | Advanced risk analysis including correlation monitoring, portfolio heat, and drawdown recovery plans |


## Fintokei Integration

Dexter understands Fintokei challenge rules out of the box:

**Supported Plans:**
- **ProTrader** (2-step): Phase 1 (8% target, 5% daily / 10% total DD) → Phase 2 (5% target) → Funded (80% split)
- **SwiftTrader** (1-step): 10% target, 5% daily / 10% total DD → Funded (80% split)
- **StartTrader** (instant): No challenge, 50-90% scaling split, 5% daily / 10% total DD

**Account sizes**: ¥200,000 / ¥500,000 / ¥1,000,000 / ¥2,000,000 / ¥5,000,000

**Risk management features:**
- Position sizing that respects both per-trade risk AND daily loss limits
- Account health monitoring with HEALTHY / WARNING / DANGER / FAILED states
- Drawdown recovery strategy with required trade calculations
- Correlation risk warnings for simultaneous positions


## How to Debug

All tool calls are logged to `.dexter/scratchpad/` as JSONL files:

```
.dexter/scratchpad/
├── 2026-03-30-111400_9a8f10723f79.jsonl
└── ...
```

Each file tracks: queries, tool calls with results, and agent reasoning.

Trade journal data is stored in `.dexter/journal/trades.json`.


## How to Use with WhatsApp

Chat with Dexter through WhatsApp:

```bash
# Link your WhatsApp account (scan QR code)
bun run gateway:login

# Start the gateway
bun run gateway
```

Then message yourself on WhatsApp with trade analysis questions.

For detailed setup, see the [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md).


## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

**Important**: Please keep pull requests small and focused.


## License

This project is licensed under the MIT License.
