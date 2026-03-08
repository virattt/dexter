# AIHF Manual Double-Check Guide

This file explains how to use [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) manually to pressure-test Dexter's two-sleeve portfolio suggestions before we build a full integration.

The current goal is simple:

- Use Dexter to generate the portfolio ideas
- Use AIHF as an independent second opinion
- Compare where they agree, where they disagree, and which excluded names deserve another look

## Why This Exists

Dexter is good at:

- building a thesis-aligned portfolio from `SOUL.md`
- enforcing the two-sleeve split
- explaining why names are in or out

AIHF is good at:

- running 18 analyst agents plus risk manager and portfolio manager
- giving an independent multi-agent view on the same tickers
- surfacing hidden disagreement, crowding, valuation concerns, or missed opportunities

That is why we created [`docs/PRD-AIHF-DOUBLE-CHECK.md`](docs/PRD-AIHF-DOUBLE-CHECK.md):

- **manual now**: use AIHF by hand to validate Dexter outputs
- **autopilot later**: let Dexter call AIHF automatically and return a structured second-opinion report

The PRD exists because the manual workflow is useful, but repetitive. Full integration would put this on autopilot by:

- sending Dexter's included names and excluded names to AIHF
- parsing AIHF's output
- returning:
  - `Double-Check Summary`
  - `High-Conviction Conflicts`
  - `Excluded But Interesting`

Important: this is **advisory only**. AIHF should not automatically overwrite Dexter portfolio files.

## Prerequisites

Clone and set up AIHF:

```bash
git clone https://github.com/eliza420ai-beep/ai-hedge-fund.git
cd ai-hedge-fund
cp .env.example .env
poetry install
```

Add your API keys in `.env`.

At minimum you likely want:

```bash
OPENAI_API_KEY=...
FINANCIAL_DATASETS_API_KEY=...
```

If you want AIHF to reason from the same thesis as Dexter, share your `SOUL.md`:

```bash
mkdir -p ~/.ai-hedge-fund
cp /Users/macbookpro16/Documents/research-stocks/dexter/SOUL.md ~/.ai-hedge-fund/SOUL.md
```

AIHF already supports loading `SOUL.md`, which keeps the second opinion aligned with Dexter's worldview.

## Current Dexter Portfolio To Validate

These commands are based on the current portfolio suggestion shown in `terminals/22.txt`.

### Tastytrade sleeve

Included:

- `AMAT, ASML, LRCX, KLAC, TEL, VRT, CEG, EQT, ANET, SNPS, CDNS, BESIY, SNDK, WDC, STX, LITE, COHR, CIEN`

Main excluded challengers:

- `NVDA, AVGO, MRVL, ARM, AAPL, BE, SEI, CRWV, CORZ`

### Hyperliquid sleeve

Included:

- `TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META, MSFT, AMZN, GOOGL, GLD, SLV, SPY, SMH`

Main excluded challengers:

- `MU, NFLX, RIVN, AAPL, AMD, MSTR`

## Manual AIHF Commands

These are the best copy-paste commands to run manually in the `ai-hedge-fund` repo.

### 1. Tastytrade sleeve only

Use this to validate the names Dexter currently included in the tastytrade sleeve.

```bash
poetry run python src/main.py --tickers AMAT,ASML,LRCX,KLAC,TEL,VRT,CEG,EQT,ANET,SNPS,CDNS,BESIY,SNDK,WDC,STX,LITE,COHR,CIEN --analysts-all --show-reasoning
```

### 2. Hyperliquid sleeve only

Use this to validate the names Dexter currently included in the Hyperliquid sleeve.

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL,GLD,SLV,SPY,SMH --analysts-all --show-reasoning
```

### 3. Tastytrade sleeve plus the main excluded challengers

This is the best test of whether Dexter left out better non-HL names.

```bash
poetry run python src/main.py --tickers AMAT,ASML,LRCX,KLAC,TEL,VRT,CEG,EQT,ANET,SNPS,CDNS,BESIY,SNDK,WDC,STX,LITE,COHR,CIEN,NVDA,AVGO,MRVL,ARM,AAPL,BE,SEI,CRWV,CORZ --analysts-all --show-reasoning
```

### 4. Hyperliquid sleeve plus the main excluded challengers

This checks whether the current HL basket should include other names such as `MU` or `AMD`.

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL,GLD,SLV,SPY,SMH,MU,NFLX,RIVN,AAPL,AMD,MSTR --analysts-all --show-reasoning
```

### 5. Excluded names only

This is often the most useful command. It tells you which omitted names AIHF actually likes.

```bash
poetry run python src/main.py --tickers NVDA,AVGO,MRVL,ARM,AAPL,BE,SEI,CRWV,CORZ,MU,NFLX,RIVN,AMD,MSTR --analysts-all --show-reasoning
```

### 6. Reproducible run with fixed dates

If you want stable comparisons over time, pin the date range:

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL --analysts-all --show-reasoning --start-date 2025-12-01 --end-date 2026-03-08
```

## How To Read The Output

You do not want perfect agreement. You want to find **high-conviction disagreement**.

### Good confirmation

- Dexter includes a name
- AIHF is also positive or supportive on it

### Possible problem

- Dexter includes a name
- AIHF is strongly negative on it

### Most valuable signal

- Dexter excluded a name
- AIHF comes back strongly positive on it

That last category is the real reason to run AIHF manually.

## Suggested Workflow

Run the commands in this order:

1. `excluded names only`
2. `tastytrade + challengers`
3. `hyperliquid + challengers`

This sequence gives the fastest feedback on whether Dexter missed anything important.

## Simple Comparison Template

Use this after each manual run:

```markdown
| Ticker | Dexter Stance | AIHF Stance | Revisit? | Notes |
|--------|---------------|-------------|----------|-------|
| MU     | Excluded      | BUY         | Yes      | AIHF likes it more than Dexter does |
| NVDA   | Included HL   | BUY         | No       | Broad confirmation |
| BE     | Excluded      | SELL        | No       | Confirms exclusion |
```

## Why Full Integration Still Matters

Manual commands are useful, but they are slow and repetitive:

- you have to copy tickers by hand
- you have to separate included vs excluded names manually
- you have to read long AIHF output and interpret it yourself

The full integration proposed in [`docs/PRD-AIHF-DOUBLE-CHECK.md`](docs/PRD-AIHF-DOUBLE-CHECK.md) would automate that by:

1. taking Dexter's current two-sleeve output
2. sending included and excluded tickers to AIHF
3. normalizing AIHF's results
4. returning a structured report inside Dexter

That is the "autopilot" goal: not replacing Dexter, but giving Dexter a built-in independent second opinion from AIHF.
