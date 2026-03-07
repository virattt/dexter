# tastytrade / OCC Option Symbol Format

Maps tastytrade option symbols to underlying tickers. Used by `tastytrade_sync_portfolio` and when comparing broker positions to PORTFOLIO.md targets.

**Reference:** [tastytrade API](https://developer.tastytrade.com/) | [OCC Option Symbol](https://www.theocc.com/Market-Data/Option-Symbol-Directory)

---

## Option symbol format (OCC)

Equity and index options use the OCC standard:

- **Root** — Underlying symbol (e.g. AAPL, SPY), typically 1–6 characters, space-padded to 6.
- **Expiration** — YYMMDD (e.g. 250117 = 2025-01-17).
- **Type** — C (call) or P (put).
- **Strike** — Strike price × 1000, zero-padded to 8 digits (e.g. 00150000 = $150).

**Example:** `AAPL  250117C00150000` → AAPL, 2025-01-17, call, $150 strike.

---

## Underlying ticker extraction

For portfolio sync and drift checks:

1. **Equity positions** — Symbol is the ticker (e.g. AAPL, NVDA).
2. **Option positions** — Symbol is OCC format. The **underlying** is the root (first 6 characters trimmed, or first token before space). Dexter’s sync tool uses the root as the ticker so options in the same underlying are aggregated (e.g. multiple AAPL options → one AAPL row with combined value/weight).

---

## Quirks

- **Indices (SPX, VIX, etc.)** — Use index symbols in quotes and option chains; underlying is the index symbol.
- **Fractional strikes** — Some underlyings use fractional strikes; OCC encodes them in the 8-digit strike field.
- **Symbol search** — Use `tastytrade_symbol_search` to resolve names to symbols before calling quote or option chain.

---

## Usage in Dexter

- **tastytrade_sync_portfolio** — Normalizes each position’s symbol to an underlying ticker via the root, then aggregates by ticker and computes weight = value / total equity.
- **Heartbeat (tastytrade drift)** — When `TASTYTRADE_HEARTBEAT_ENABLED=true`, compare live positions (by underlying) to SOUL.md / PORTFOLIO.md target weights; flag drift (e.g. “NVDA 8% vs 5% target”).
