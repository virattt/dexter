# HIP-3 Portfolio Thesis (SOUL-HL.example.md)

Copy to `~/.dexter/SOUL-HL.md` to customize. Used when working with PORTFOLIO-HYPERLIQUID.md. If you use a target table, use the same canonical format as HEARTBEAT.md so code can parse it: `Ticker | TargetMin | TargetMax | Category | Notes` (one row per ticker, percentages as numbers).

## Target Allocation

HIP-3 sleeve focuses on onchain equities (tokenized stocks, commodities, indices). Crypto (BTC, SOL, HYPE, ETH, SUI, NEAR) is held in the core portfolio, not here.

| Ticker | TargetMin | TargetMax | Category     | Notes                                    |
|--------|-----------|-----------|--------------|------------------------------------------|
| TSM    | 15        | 20        | Foundry      | Foundry monopoly, tollbooth for AI chips |
| NVDA   | 10        | 15        | AI infra     | GPU monopoly                             |
| ORCL   | 6         | 10        | AI infra     | Cloud/DB infra                           |
| PLTR   | 6         | 10        | AI infra     | Enterprise AI                            |
| COIN   | 5         | 8         | Tokenization | Regulated exchange                       |
| HOOD   | 5         | 8         | Tokenization | Retail crypto/equities                   |
| CRCL   | 5         | 8         | Tokenization | Stablecoin infra                         |
| TSLA   | 4         | 7         | AI/Auto      | FSD + Optimus                            |
| MU     | 4         | 7         | Memory       | HBM/NAND                                 |
| META   | 3         | 5         | Hyperscaler  | Open-source AI                           |
| MSFT   | 2         | 4         | Hyperscaler  | Azure AI                                 |
| AMZN   | 2         | 4         | Hyperscaler  | AWS                                      |
| GOOGL  | 2         | 4         | Hyperscaler  | Gemini + TPUs                            |

## Sizing Rules

- Regime determines size; conviction determines inclusion
- No single position >20%
- Concentration alert threshold: >5% above target (TargetMax + 5%)
