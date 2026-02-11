---
name: deep-research
description: Executes deep, multi-step financial research on a stock or topic. Invoke AFTER the user has been interviewed about their research goals. Pass the user's scoped parameters (goal, time horizon, focus areas, output format, comparisons) as the skill arguments.
---

# Deep Research Skill

**Important:** This skill is for research execution only. The interview/scoping phase is handled by the system prompt BEFORE this skill is invoked. When invoking this skill, pass the user's answers (goal, time horizon, focus, output, comparisons) as arguments.

## Data Gathering

Based on the scoping answers, gather data using these tools:

### Financials (always)
- `financial_search`: "[TICKER] annual income statements last 5 years"
- `financial_search`: "[TICKER] financial metrics snapshot"
- `financial_search`: "[TICKER] latest balance sheet"

### Growth & Drivers (if focus includes growth or thesis)
- `financial_search`: "[TICKER] quarterly revenue and earnings last 8 quarters"
- `financial_search`: "[TICKER] analyst estimates"
- `web_search`: "[COMPANY] growth strategy 2025 2026"

### Risks (if focus includes risks)
- `web_search`: "[COMPANY] risks regulation competition"
- `financial_search`: "[TICKER] insider trades last 6 months"

### Competitive Position (if focus includes competition or comparisons)
- `financial_search`: "[COMP_TICKER] financial metrics snapshot" (for each competitor)
- `web_search`: "[COMPANY] vs [COMPETITOR] market share"

### Valuation (if focus includes valuation)
- Use the `dcf-valuation` skill if available
- Otherwise: `financial_search`: "[TICKER] price snapshot" + calculate P/E, EV/EBITDA, PEG from gathered data

## Analysis & Output

Structure the final output based on what the user requested:

### Bull / Base / Bear Thesis
- **Bull case**: best realistic scenario with catalysts and upside %
- **Base case**: most likely outcome with fair value estimate
- **Bear case**: key risks and downside %

### Competitor Comparison
- Side-by-side table: revenue, margins, growth, valuation multiples
- Qualitative moat comparison (1–2 sentences each)

### Risk Report
- Top 5 risks ranked by impact × probability
- For each: what to watch (metric or signal) and trigger level

### Full Report
- Executive summary (3–4 sentences)
- All sections above combined
- "What to watch" checklist for quarterly monitoring

## Output Rules

- Lead with the key finding — don't bury the conclusion
- Use tables for comparative data
- Keep total output concise — quality over length
- Include specific numbers, not vague qualifiers
- End with 3–5 actionable "things to watch" going forward
