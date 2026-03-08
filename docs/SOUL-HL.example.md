# HIP-3 Portfolio Thesis (SOUL-HL.example.md)

Copy to `~/.dexter/SOUL-HL.md` to customize. Used when working with PORTFOLIO-HYPERLIQUID.md. If you use a target table, use the same canonical format as HEARTBEAT.md so code can parse it: `Ticker | TargetMin | TargetMax | Category | Notes` (one row per ticker, percentages as numbers).

## Target Allocation

| Ticker | TargetMin | TargetMax | Category | Notes |
|--------|-----------|-----------|----------|-------|
| BTC | 35 | 40 | Core | Base layer |
| HYPE | 10 | 15 | Core | Onchain equities |
| SOL | 8 | 12 | L1 | Agentic |
| ETH | 6 | 10 | L1 | Base / settlement |
| NEAR | 4 | 6 | L1 | Chain abstraction |
| SUI | 4 | 6 | L1 | Agentic optionality |
| ORCL | 2 | 4 | AI infra | |
| PLTR | 2 | 4 | AI infra | |
| COIN | 2 | 3 | Tokenization | |
| HOOD | 2 | 3 | Tokenization | |
| CRCL | 2 | 3 | Tokenization | |
| AMZN | 0 | 2 | Hyperscalers | Optional |
| MSFT | 0 | 2 | Hyperscalers | Optional |
| GOOGL | 0 | 2 | Hyperscalers | Optional |

## Sizing Rules

- Regime determines size; conviction determines inclusion
- No single position >15% except BTC
- Concentration alert threshold: >5% above target (TargetMax + 5%)
