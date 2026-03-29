---
name: geopolitics-osint
description: >
  Gather geopolitical intelligence from OSINT sources (GDELT, Bluesky, web) and
  correlate world events to asset implications. Use this skill when the user wants
  to understand how a geopolitical situation affects their portfolio or a specific
  sector, or when they want a structured OSINT briefing on an ongoing conflict,
  sanctions regime, trade dispute, or cyber threat.
---

# Geopolitics OSINT Skill

## Purpose
Produce a structured geopolitical briefing that:
1. Identifies key events in the last 24–72 hours related to the user's query
2. Maps events to financial asset implications (direction: risk-up / risk-down / volatility)
3. Flags tickers the user already tracks (watchlist hits)
4. Stores findings in memory under namespace `geopolitics-osint` for future recall

## Step-by-Step Workflow

### 1. Parse the user's request
Identify:
- **Topic** — the geopolitical situation (e.g. "Russia Ukraine ceasefire", "China Taiwan military", "Iran nuclear deal")
- **Time window** — default to "1d" unless the user asks for a broader picture ("7d")
- **Watchlist** — recall user watchlist from memory so hits can be flagged
  - Use `recall_financial_context` with query "watchlist portfolio holdings" to retrieve tickers

### 2. Search OSINT sources
Call `geopolitics_search` with:
```json
{
  "topic": "<extracted topic>",
  "timeWindow": "1d",
  "watchlistTickers": ["<ticker1>", "<ticker2>"],
  "limit": 20
}
```
The tool automatically queries:
- **GDELT** — global news article index (no key required)
- **Bluesky** — OSINT community posts (no auth required)

If the tool returns low confidence or few events, broaden the time window to "7d" and call again.

### 3. Cross-reference with financial data (optional)
If the asset implications include tickers the user tracks, call `financial_metrics` to get current prices for context:
```
financial_metrics: get current price and 1-week performance for [ticker]
```

### 4. Check web for breaking news
Use `web_search` to fill gaps if the topic is very recent (< 6h):
```
web_search: site:reuters.com OR site:apnews.com OR site:ft.com [topic] latest news
```

### 5. Synthesise findings
Write a briefing in this structure:

```
## OSINT Briefing: [Topic]
**As of**: [UTC timestamp] | **Confidence**: [high/medium/low]

### Key Events (last [timeWindow])
- [Event 1 — 1–2 sentences, source, date]
- [Event 2 ...]

### Asset Implications
| Ticker | Direction | Rationale | Confidence |
|--------|-----------|-----------|------------|
| NVDA   | risk-down | Taiwan fab dependency | 90% |

### Watchlist Alerts
[List tickers from user watchlist that appear in implications]

### Analysis
[2–3 paragraph synthesis: what does this mean for markets? Are implications already priced in? What would change the outlook?]

### Caveats
[Limitations: missing data, low event count, rapidly evolving situation]
```

### 6. Store findings in memory
Use `store_financial_insight` with `namespace: "geopolitics-osint"`:
```json
{
  "ticker": "GLOBAL",
  "insight": "OSINT briefing: [topic summary]. Key implications: [top 3 tickers].",
  "namespace": "geopolitics-osint",
  "tags": ["osint", "geopolitics", "[event-category]"]
}
```

### 7. Respond to the user
Present the briefing clearly. If watchlist tickers are affected, lead with those.
Add a disclaimer that geopolitical intelligence carries uncertainty and should be one input among many.

## Key Principles
- **Honesty**: if data is sparse or the situation is unclear, say so
- **No fabrication**: don't invent events or probability estimates
- **Asset-first**: always connect geopolitical events back to financial implications
- **Watchlist-first**: user's existing holdings take priority in the output
- **Time-sensitive**: flag when events are very recent and may not be priced in yet

## Example Triggers
- "What's the latest on Russia Ukraine? How does it affect energy stocks?"
- "China Taiwan military exercises — any impact on my NVDA position?"
- "OSINT briefing on Middle East oil supply risk"
- "What are the geopolitical risks to my portfolio this week?"
- "Are there any new sanctions that affect my holdings?"
- "Cyber threat landscape — what should I know about infrastructure attacks?"
