# Hyperliquid → Financial Datasets Symbol Mapping

Maps Hyperliquid (HIP-3) symbols to Financial Datasets tickers for price data. Used when benchmarking the Hyperliquid portfolio and computing HL basket returns.

**Data source:** [Financial Datasets API](https://financialdatasets.ai) — US stocks, ETFs, crypto. No indices or commodity spot prices; use ETF proxies.

---

## Commodities

| Hyperliquid | FD Ticker | ETF Name |
|-------------|-----------|----------|
| USOIL | USO | United States Oil Fund |
| NATGAS | UNG | United States Natural Gas Fund |
| OIL | USO | Same as USOIL |
| SILVER | SLV | iShares Silver Trust |
| GOLD | GLD | SPDR Gold Shares |
| COPPER | CPER | United States Copper Index Fund |

---

## Indices

| Hyperliquid | FD Ticker | Proxy |
|-------------|-----------|-------|
| US500 | SPY | S&P 500 ETF |
| SEMIS | SMH | VanEck Semiconductor ETF |
| SMALL2000 | IWM | Russell 2000 ETF |
| MAG7 | QQQ | Nasdaq-100 (tech proxy) |
| INFOTECH | QQQ | Nasdaq-100 |
| ROBOT | BOTZ | Global X Robotics & AI ETF |
| XYZ100 | SPY | Use SPY as broad market proxy |

---

## Stocks

Stocks use 1:1 mapping — Hyperliquid symbol = FD ticker.

| Hyperliquid | FD | Notes |
|-------------|-----|------|
| AAPL | AAPL | Apple |
| NVDA | NVDA | NVIDIA |
| MSFT | MSFT | Microsoft |
| PLTR | PLTR | Palantir |
| RIVN | RIVN | Rivian |
| GOOGL | GOOGL | Alphabet |
| NFLX | NFLX | Netflix |
| AMZN | AMZN | Amazon |
| TSLA | TSLA | Tesla |
| META | META | Meta |
| ORCL | ORCL | Oracle |
| COIN | COIN | Coinbase |
| HOOD | HOOD | Robinhood |
| AMD | AMD | AMD |
| MSTR | MSTR | MicroStrategy |
| CRCL | CRCL | Circle (if listed) |
| TSM | TSM | TSMC |

---

## No FD Data (Pre-IPO / Tokenized)

| Hyperliquid | Notes |
|-------------|-------|
| OPENAI | Pre-IPO token; use hyperliquid_prices tool or web_search |
| SPACEX | Pre-IPO token |
| ANTHROPIC | Pre-IPO token |

For performance calculation, use the `hyperliquid_prices` tool (HL-native prices) or exclude these from FD-based reports.

---

## Liquidity (Volume)

When suggesting or rebalancing the Hyperliquid portfolio, prefer **high-volume underlyings** for larger weights (better execution, tighter spreads). Top volume names include: NVDA, MU, SNDNK, HOOD, CRCL, TSLA, INTC, ORCL, EWY, GOOGL, COIN, MSTR, META, AMZN, MSFT. Full ranked list and usage: **docs/PRD-HYPERLIQUID-PORTFOLIO.md §2.1**.

---

## Usage in Dexter

When fetching prices for Hyperliquid portfolio or HL basket:
1. Resolve HL symbol → FD ticker via this mapping
2. Call `get_stock_price` / `get_stock_prices` with FD ticker
3. For crypto (BTC, ETH, SOL, etc.), use `get_crypto_price_snapshot` with `BTC-USD`, `ETH-USD`, etc.
