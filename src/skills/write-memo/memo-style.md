# Investment Memo Style Guide

Rules the memo must follow. These mirror buyside writing conventions and avoid the tells that mark a document as AI-generated.

## Voice

- **First person plural** ("we believe", "our base case") — that's how a buyside team writes.
- **Direct, not hedging.** "Margins compress 200bps in '27" beats "margins could potentially face some pressure in 2027".
- **Confidence calibrated by evidence.** State the view, then state the evidence. Hedge once with a "wrong if" — not in every sentence.
- **One sentence per idea** in narrative sections. Long sentences with comma chains and parentheticals signal AI drift.

## Banned vocabulary

Never use these words. They are AI-generated tells:

- "delve", "delves", "delving"
- "leverage" as a verb ("we leverage X to do Y")
- "robust", "comprehensive", "holistic", "seamless"
- "navigate the landscape", "navigate the challenges"
- "in today's fast-paced", "in an ever-evolving"
- "stands out", "sets itself apart"
- "deep dive", "unpack", "double-click"
- "moreover", "furthermore", "additionally" (use a new sentence)
- "It's worth noting that" (just say the thing)

## Banned constructions

- **Tricolons** — three-item lists for rhythmic effect ("fast, scalable, and reliable"). One AI tell.
- **Em dash abuse** — at most one em dash per paragraph. Prefer periods or commas.
- **"Not just X but Y"** — overused contrast structure.
- **Generic closing summaries** — "In conclusion, this is a compelling opportunity that..." Don't write these. End on a specific claim or a tripwire.
- **Hedge stacking** — "could potentially possibly maybe". Pick one or zero.

## Numbers

- **Quantify everything.** "Margins expanded 380bps" not "margins improved meaningfully".
- **Percentages with explicit base.** "Revenue grew 28% YoY" not "revenue saw strong growth".
- **Multiples in line.** "Trading at 18x FY26 EPS" not "trading at attractive multiples".
- **Don't invent numbers.** If you don't have it from a tool call, write "not disclosed" or omit the line. Never fabricate consensus figures.

## Thesis bullet format

Every thesis bullet must be a complete falsifiable claim:

> **[Specific claim with a number]** — [Evidence with a specific number, ideally citing the data point]. *Wrong if [specific observable would happen].*

Good:
> **Ad-tier reaches 15% of subs by '27** — Q1 disclosed 40M ad-tier subs (+85% YoY) on a 270M base; trajectory implies 15% mix at constant adds. *Wrong if ad-tier ARPU compresses below $8 due to inventory glut.*

Bad (vague claim, no falsifier):
> **Strong product-market fit in ad tier** — Management has emphasized this is a key growth area going forward.

## Bear case requirements

The bear paragraph is the highest-stakes paragraph in the memo. Rules:

1. **Steelmanned.** Written as if you actually believed it. If you can't, you don't understand the trade.
2. **Specific competitor / customer / regulator named.** Not "competition intensifies" — name the company and the product.
3. **Coherent world, not a list.** The bear case is a story where the thesis is wrong. Connect the dots.
4. **Read the bull paragraph and the bear paragraph back to back.** If bear reads weaker, rewrite. This is the single most common failure mode.

## Tripwires

Every risk row in the risks table must have a tripwire. A tripwire is **an observable data point that would invalidate the thesis** within the holding period.

Good tripwires:
- "Q3 ad-tier ARPU prints below $8"
- "Top customer announces in-sourcing on Q2 call"
- "Gross margin contracts more than 150bps in any quarter"
- "Insider sales exceed $50M in any rolling 90-day window"

Bad tripwires (not observable / not actionable):
- "Macro deteriorates"
- "Competition increases"
- "Sentiment shifts negatively"

## What to pull from filings

When summarizing the business, pull verbatim from the 10-K Item 1 where the company's own language is tighter than rewriting it. Quote with quotes and source: `"[exact phrase]" (10-K Item 1)`.

For risks, prefer pulling from Item 1A and the company's own disclosure language — it's the most defensible risk framing in the memo.

## Closing the memo

Memos do not need a "conclusion" section. The header already states the recommendation; the thesis bullets state the view; the scenarios state the math. A closing paragraph that restates these is padding.

The last section in the body is **Monitoring KPIs** — the specific metrics that confirm or kill the thesis. That's the right note to end on: what to watch.
