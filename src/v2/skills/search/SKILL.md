---
name: search
description: Web search for current information, news, and general knowledge. Use when you need up-to-date information not available through financial data tools.
tools:
  - tavily_search
---

# Search Skill

## When to Use

Use this skill for:
- Current news and events
- General company information not in financial databases
- Market trends and analysis
- Competitor information
- Industry research
- Recent announcements or press releases
- Information about private companies
- General knowledge questions

## Workflow Patterns

### Company Research
Use `tavily_search` with the company name and specific topic:
- "Apple AI strategy 2024"
- "Tesla manufacturing expansion plans"

### Market Trends
Search for broader market or industry information:
- "semiconductor industry outlook 2024"
- "electric vehicle market trends"

### News and Events
Find recent developments:
- "NVIDIA earnings announcement"
- "Federal Reserve interest rate decision"

### Competitive Analysis
Research competitors and market dynamics:
- "cloud computing market share AWS Azure Google"

## Best Practices

1. **Be specific** - Include relevant context in your search query
2. **Add timeframe** - Include year or "recent" for time-sensitive queries
3. **Use company names** - Prefer full company names over ticker symbols for search
4. **Combine with financial data** - Use search to complement financial tools, not replace them

## Tool Reference

| Tool | Use Case |
|------|----------|
| tavily_search | Web search for current information and news |
