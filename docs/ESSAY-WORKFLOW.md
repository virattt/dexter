# Essay Workflow — Dexter → Claude → Substack

**Version:** 1.0  
**Last Updated:** 2026-03-07

Turn Dexter's quarterly reports into published essays. Learn, reflect, improve.

---

## The Loop

1. **Run Dexter** — Query 4 (quarterly report) or let the heartbeat run it in the first week of the quarter
2. **Report is saved** — Dexter writes to `~/.dexter/QUARTERLY-REPORT-YYYY-QN.md` automatically
3. **Run Query 5** — Reflection essay draft (optional; or paste report directly into Claude)
4. **Polish in Claude** — Copy Dexter output (or Query 5 draft) into Claude Sonnet for essay refinement
5. **Publish** — Substack, blog, etc.
6. **Update SOUL.md** — Feed essay insights back into the thesis (power refinement, regime signals, etc.)

---

## Step-by-Step

### 1. Generate the Quarterly Report

**Option A — Manual (Query 4):**
```
Write a quarterly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md. Fetch price data for the past 90 days for all holdings plus BTC-USD, GLD, and SPY. Include: portfolio return, benchmark returns, layer attribution, conviction-tier performance, regime assessment, outlook. Save the report to ~/.dexter/QUARTERLY-REPORT-2026-Q1.md using the save_report tool.
```

**Option B — Heartbeat:** If it's the first week of Jan/Apr/Jul/Oct, the heartbeat runs the quarterly report automatically and saves it.

### 2. Generate Essay Draft (Optional)

**Query 5:**
```
Using the quarterly performance report from ~/.dexter/QUARTERLY-REPORT-2026-Q1.md, write a 600–800 word reflection essay. Structure:
1. What the numbers say about our thesis — which layers validated, which didn't
2. The regime problem — what BTC/Gold/SPY told us
3. The machine's recommendation — sizing adjustments and why
4. One sentence that captures the tension between thesis and regime

Write in the voice of the ikigaistudio Substack essays. Output markdown ready for editing.
```

### 3. Polish in Claude

Paste the Dexter output (full report or Query 5 draft) into Claude. Ask for:
- Essay structure and narrative flow
- Voice consistency with prior Substack essays
- One sharp sentence that captures the quarter

### 4. Publish

Substack, blog, or wherever you publish.

### 5. Feed Insights Back to SOUL.md

After each essay, ask: *What did we learn that should change the thesis?*

Examples from [The Terminal That Thinks Like We Do](https://ikigaistudio.substack.com/p/the-terminal-that-thinks-like-we):
- **Power is not one trade** — VRT (inside-the-DC) vs CEG (grid-level) behaved differently → added to SOUL Layer 5
- **BTC concentration as regime risk** — at 40–45%, BTC drives the quarter → added to sizing rules
- **Gold strength as regime signal** — when gold surges while BTC falls, it's a warning → added to regime section

---

## File Locations

| File | Purpose |
|------|---------|
| `~/.dexter/PORTFOLIO.md` | Current holdings (auto-saved when agent suggests) |
| `~/.dexter/QUARTERLY-REPORT-YYYY-QN.md` | Quarterly performance report (auto-saved by agent) |
| `SOUL.md` | Thesis, layers, conviction tiers — update from essay insights |

---

## References

- [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md) — All copy-paste queries
- [The Terminal That Thinks Like We Do](https://ikigaistudio.substack.com/p/the-terminal-that-thinks-like-we) — Example essay from this workflow
