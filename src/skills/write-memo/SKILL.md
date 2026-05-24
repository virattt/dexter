---
name: write-memo
description: Drafts a professional investment memo (HTML output) for a long or short equity idea, structured the way a hedge fund analyst would present a thesis to a PM. Triggers when the user asks to "write a memo", "draft an investment memo", "write up a thesis", "pitch this stock", "memo on [ticker]", "long writeup", "short writeup", or similar. Produces a 1-page HTML file at .dexter/memos/.
---

# Write Investment Memo Skill

Produces a buyside-quality investment memo as a self-contained HTML file. The memo is opinionated and falsifiable — it leads with a variant view and steelmans the bear case. The output is the deliverable; the chat response is just a header summary plus the file path.

## Workflow Checklist

Copy and track progress:
```
Investment Memo Progress:
- [ ] Step 1: Frame the trade (direction, horizon, variant view)
- [ ] Step 2: Gather data (financials, market, filings)
- [ ] Step 3: Build Bear / Base / Bull scenarios
- [ ] Step 4: Optional DCF anchor for base case
- [ ] Step 5: Draft memo content (fill all slots)
- [ ] Step 6: Self-critique pass
- [ ] Step 7: Render HTML to .dexter/memos/
- [ ] Step 8: Report header summary + file path
```

## Step 1: Frame the Trade

Confirm or ask for the following before drafting:

- **Ticker** (required)
- **Direction**: long or short (required)
- **Horizon**: 3mo / 6mo / 12mo / 2yr+ (default 12mo if not specified)
- **Conviction**: high / medium / low (default medium)
- **Variant view**: one sentence — what the analyst sees that consensus doesn't

**If the user does not provide a variant view**: do not ask repeatedly. Gather data in Step 2 first, then derive a candidate variant view from where your model meaningfully diverges from consensus (e.g., "our '27 EPS is $X vs consensus $Y because [driver]"). Present it as a draft and let the analyst accept, refine, or replace before you proceed to Step 5.

## Step 2: Gather Data (Parallel)

Issue these tool calls in parallel:

### 2.1 Financials
Call `get_financials`:
- `"[TICKER] annual income statements last 5 years"` — revenue, operating income, net income, EPS, margins
- `"[TICKER] annual cash flow statements last 5 years"` — operating CF, capex, FCF
- `"[TICKER] latest balance sheet"` — debt, cash, shares outstanding
- `"[TICKER] financial metrics snapshot"` — P/E, EV, ROIC, FCF growth, debt/equity, margins
- `"[TICKER] segmented financials"` — segment revenue, segment margins (if multi-segment)
- `"[TICKER] earnings history last 8 quarters"` — beats/misses, surprises
- `"[TICKER] company facts"` — sector, industry, market cap
- `"[TICKER] KPI guidance"` and `"[TICKER] KPI metrics"` — management-provided KPIs and guidance

### 2.2 Market & Ownership
Call `get_market_data`:
- `"[TICKER] price snapshot"` — current price, 52-week range, market cap
- `"[TICKER] historical prices last 12 months"` — for return / multiple compression context
- `"[TICKER] insider trades last 6 months"` — recent buys/sells, dollar amounts
- `"[TICKER] institutional holdings"` — top holders, recent additions / reductions
- `"[TICKER] news last 30 days"` — recent material events

### 2.3 Filings
Call `read_filings`:
- Most recent 10-K Item 1 (Business) — for business snapshot language
- Most recent 10-K Item 1A (Risk Factors) — to source risks from the company itself
- Most recent 10-Q — recent quarterly trajectory

### 2.4 Memory (optional)
Call `memory_search` with the ticker — surfaces any prior notes, prior memos, or user-provided constraints (e.g., risk tolerance, sector exposure already in book).

### 2.5 Sentiment (optional, only if time-sensitive)
Call `x_search` for recent material chatter on the ticker. Skip if the thesis is fundamental and not catalyst-driven this week.

## Step 3: Build Scenarios

Construct Bear / Base / Bull scenarios. Each scenario is **driver-based**, not a single number pulled from the air.

For each scenario specify:
- **Revenue growth** (forecast year, 2-3 years out)
- **EBIT / operating margin** at that point
- **Exit multiple** (P/E, EV/EBITDA, or EV/Sales as appropriate for the sector)
- **Probability weight** (the three must sum to 100%)
- **Price target** (derived from the above)
- **Return** vs. current price (with sign)

Then compute:
- **Probability-weighted return** = sum(prob × return) across scenarios
- **Upside / downside ratio** = |bull return| / |bear return|

**Asymmetry check**: if upside/downside < 2x, flag this prominently. A weak-asymmetry setup is a coin flip, not a trade. Either revise the scenarios honestly, or note the weak asymmetry in the memo (do not hide it).

## Step 4: Optional DCF Anchor

For base case, optionally invoke the `dcf-valuation` skill via the `skill` tool to produce an intrinsic value anchor. Use it as a cross-check against your base-case price target, not as a replacement.

## Step 5: Draft Memo Content

Read the template and style guide:
- [memo-template.html](memo-template.html)
- [memo-style.md](memo-style.md)
- [examples.md](examples.md) — pattern-match tone and density

Fill every slot. Slots are listed in the template — do not skip any. Slot-specific guidance:

### `{{variant_view}}`
Three sentences max. Lead with the divergence from consensus: *what we see, why we think it, why the market hasn't priced it*. If the user did not provide one, this is where your derived candidate goes.

### `{{thesis_bullets}}`
3-5 bullets, each in this format:
> **[Claim]** — [Evidence with a specific number]. *Wrong if [observable falsifier].*

Example:
> **Ad-tier reaches 15% of subs by '27** — Q1 disclosed 40M ad-tier subs (+85% YoY) on a 270M base; trajectory implies 15% mix at constant adds. *Wrong if ad-tier ARPU compresses below $8 due to inventory glut.*

Each bullet must be **falsifiable**. No "great management", "strong moat", "wide TAM" without a specific operational metric behind it.

### `{{business_snapshot}}`
4-5 lines max. What they sell, how they make money, segment mix, unit economics that matter for the thesis. **No founding-year boilerplate.** Pull verbatim from the 10-K Item 1 where it tightens the language.

### `{{whats_priced_in}}`
Current multiple, implied growth or margin assumption embedded in that multiple, sellside consensus numbers (revenue, EPS for FY+1 and FY+2). Then one sentence on where your model diverges and by how much.

### `{{scenario_table}}`
Render as an HTML table. Columns: Bear / Base / Bull. Rows: Probability, Revenue growth (FY27), EBIT margin (FY27), Exit multiple, Price target, Return. Color returns: positive `class="pos"`, negative `class="neg"`.

### `{{bull_narrative}}`, `{{base_narrative}}`, `{{bear_narrative}}`
One paragraph each (3-5 sentences). Each is a *coherent world*, not a list of factors:
- **Bull**: what has to be true. Specific operational wins that compound. Tied to evidence we'd see in quarterly data.
- **Base**: the thesis playing out as written.
- **Bear**: steelmanned — written as if you believed it. Specific competitive losses, customer concentration risk materializing, multiple compression to a lower peer group. **If the bear paragraph reads weaker than the bull paragraph, rewrite it.**

### `{{catalysts_table}}`
Table with columns: Event, Date / Quarter, Expected Impact. 3-5 entries. Dates should be specific (Q3 '26, Aug '26 earnings, Investor Day Nov '26).

### `{{risks_table}}`
Table with columns: Risk, Mitigant, Tripwire. The tripwire is the **observable data point that would invalidate the thesis** (e.g., "Q3 ad-tier ARPU prints below $8", "top customer renewal pushed past Q4"). Tripwires distinguish a hedge fund memo from a sellside report.

### `{{position_management}}`
Three short lines: suggested sizing (% NAV) anchored to conviction × asymmetry; entry price (current or limit); stop level or scale-out trigger.

### `{{monitoring_kpis}}`
3-5 KPIs to track quarterly. These are the metrics that confirm or kill the thesis — not generic ones (revenue growth, EPS) but specific ones tied to your variant view.

## Step 6: Self-Critique Pass (Mandatory)

Before rendering, verify every check. If any fail, revise the relevant section before continuing.

1. **Variant view is actually variant.** Not a restatement of consensus dressed up as a view. The test: can you point to specific sellside notes / consensus numbers your view contradicts?
2. **Every thesis bullet is falsifiable.** Each has a "wrong if" clause naming a specific observable.
3. **Numbers behind every adjective.** No "strong growth" without the bps / %. No "expanding margins" without the basis point delta.
4. **Bear case is steelmanned.** Read the bear paragraph aloud. If it reads weaker than the bull, rewrite.
5. **Asymmetry ≥ 2x.** If not, the memo flags this in the header rather than hiding it.
6. **Probability weights sum to 100%.**
7. **Tripwires are observable.** Each risk has a data point an analyst could watch for, not a vibe.

## Step 7: Render HTML

1. Read `memo-template.html` via `read_file`
2. Replace every `{{slot}}` placeholder with the content you drafted
3. Set `{{date}}` to today's date in YYYY-MM-DD format
4. Set `{{analyst}}` from memory if known, otherwise blank
5. Write to `.dexter/memos/[TICKER]_[DIRECTION]_[YYYY-MM-DD].html` via `write_file`
   - Direction is `LONG` or `SHORT` (uppercase)
   - Example: `.dexter/memos/NFLX_LONG_2026-05-24.html`
6. **Only** write a `.md` source file if the user explicitly requested one

The path uses forward slashes. The `write_file` tool will create the `.dexter/memos/` directory if it does not exist.

## Step 8: Report to Chat

Final chat response should be exactly this format and nothing more:

```
[TICKER] · [LONG/SHORT] · Target $X (+Y% / -Y%) · Asymmetry [N.Nx] · [Conviction]

Memo saved to .dexter/memos/[FILENAME].html
Open with: open .dexter/memos/[FILENAME].html
```

Do not paste the full memo content into the chat. The file is the deliverable. The chat output is a scannable header.

## Critical Don'ts

- Do not paste the full memo as a chat response in addition to writing the file
- Do not write a `.md` file alongside unless explicitly requested
- Do not include charts, sparklines, scenario bars, or any visual element beyond tables
- Do not add emoji anywhere — not in the memo, not in the chat response
- Do not include a prominent "AI-generated" footer or branding
- Do not skip the self-critique pass in Step 6
- Do not invent consensus numbers — if you do not have them from a tool call, say so in the memo
