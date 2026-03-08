# HEARTBEAT.example.md

Copy this file to `~/.dexter/HEARTBEAT.md` to customize what Dexter monitors. The heartbeat runs on a schedule and uses this checklist to decide what to check.

**Core motivation:** BTC-heavy portfolio. HODL BTC. Get suggestions for how (and why) to diversify. HYPE (onchain stocks) and SOL/NEAR/SUI/ETH (agentic web4) are thesis-aligned satellites.

---

- **BTC** — price, dominance, any material move or news that affects HODL thesis
- **HYPE** — onchain stocks narrative: HIP-3, equity tokenization, Hyperliquid updates
- **SOL, NEAR, SUI, ETH (Base)** — agentic web4 narrative: Solana, NEAR, Sui, Base ecosystem; DePIN, agent infrastructure news
- **Diversification signals** — anything that changes the how/why of diversifying from BTC-heavy (e.g. AI infra cycle inflection, macro regime shift, Burry danger signal)
- **BTC/Gold ratio** — lead-lag; BTC parabolic often after Gold tops; watch for range-low reclaim as potential trigger (see CYCLE-STRUCTURE-MACRO-BIAS.md)
- **Gold surge when BTC falls** — regime signal (markets paying for safety). When gold surges +20%+ in a quarter, flag that absence of gold exposure cost the portfolio. Gold strength is a warning, not a footnote.
- **Regime overlay** — "Reduce in capitulation, add on pullbacks." When equipment/power names sell off sharply (e.g. geopolitical event), flag: thesis may be right, entry timing may be wrong.
- **SPY-relative consistency** — when portfolio underperforms SPY in mixed regimes, flag the thesis-purity vs defensiveness trade-off.
- **Major index moves** (S&P 500, NASDAQ, Dow) — alert if any move more than 2% in a session
- **Breaking financial news** — major earnings surprises, Fed announcements, significant market events

---

## HIP-3 Target (for PORTFOLIO-HYPERLIQUID.md rebalancing)

When you have a Hyperliquid portfolio, define your target allocation below. The heartbeat and `hyperliquid_portfolio_ops` tool parse this table for deterministic rebalance checks and concentration alerts. HIP-3 sleeve focuses on onchain equities; crypto (BTC, SOL, HYPE, ETH, SUI, NEAR) is in the core portfolio.

**Canonical format (code-parsed):** One row per ticker. Columns: `Ticker | TargetMin | TargetMax | Category | Notes`. Percentages as numbers (no %). Code derives midpoint target and uses TargetMin/TargetMax as the allowed band. Concentration alert when current weight > TargetMax + 5%.

| Ticker | TargetMin | TargetMax | Category     | Notes                                    |
|--------|-----------|-----------|--------------|------------------------------------------|
| TSM    | 15        | 20        | Foundry      | Foundry monopoly, tollbooth for AI chips |
| NVDA   | 10        | 15        | AI infra     | GPU monopoly, high volume                |
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
