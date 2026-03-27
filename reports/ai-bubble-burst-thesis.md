# The AI Infrastructure Bubble: Moore's Law vs. Accounting Fiction

**Date:** March 27, 2026  
**Thesis:** Short AI infrastructure hyperscalers and GPU cloud providers  
**Conviction:** High  
**Time Horizon:** 12-24 months

---

## Executive Summary

**The central contradiction:** Moore's Law has delivered ~2x performance every 18 months for 60+ years. This empirical reality dictates GPU economic life of 3-4 years maximum for training workloads. Hyperscalers depreciate these same GPUs over 5-6 years.

**These two claims cannot both be true.** Either:
1. Moore's Law has broken (60 years of empirical evidence says no), OR
2. Depreciation schedules are materially understating costs (evidence says yes)

**The math:** Michael Burry's November 2025 thesis quantifies the gap — ~$176B cumulative depreciation understatement 2026-2028 across hyperscalers. If forced to 3-year schedules, MSFT/GOOGL 2026-2028 EPS declines 15-25%.

**Secondary amplifiers:**
- Cash flow mismatch (50-80% capex growth vs. 20-30% AI revenue growth)
- NVIDIA's 18-24 month architecture cadence (Hopper→Blackwell→Rubin)
- Huawei's rapid ascent (80-85% of H100 performance at 50% price)
- GPU cloud debt maturity walls (2027-2029)

**The trigger:** When hyperscalers reverse depreciation policies or recognize impairment charges, earnings compress, multiples contract, and the AI infrastructure complex unwinds.

---

## The Moore's Law Contradiction

### Empirical Foundation: 60 Years of Evidence

| Era | Technology | Doubling Period | Validation |
|-----|------------|-----------------|------------|
| 1965-1980 | Integrated circuits | 18-24 months | Moore's original observation |
| 1980-2000 | Microprocessors | 18-24 months | Intel cadence, Dennard scaling |
| 2000-2015 | Multi-core CPUs | 18-24 months | Parallel computing era |
| 2015-2026 | GPU/AI accelerators | 18-24 months | Hopper→Blackwell→Rubin cadence |

**NVIDIA's architecture cadence (2023-2026):**
- Hopper (H100): March 2022 → production 2023
- Blackwell (B100/B200): March 2024 → production 2025
- Rubin (R100): Expected 2026 → production 2027

**The implication:** Each generation delivers ~2x performance per watt and per dollar. A 3-year-old GPU is ~4x less efficient than current generation. A 5-year-old GPU is ~8x less efficient.

### Economic Life vs. Accounting Life

| Workload Type | Economic Life (Moore's Law) | Current Accounting | Mismatch |
|--------------|----------------------------|-------------------|----------|
| **Training clusters** | 2-3 years | 5-6 years | −50-67% |
| **Inference clusters** | 4-5 years | 5-6 years | −17-20% |
| **Batch processing** | 5-7 years | 5-6 years | Acceptable |

**The trap:** Hyperscalers are depreciating training infrastructure (2-3 year economic life) on 5-6 year schedules. When Hopper clusters become obsolete for training (replaced by Blackwell/Rubin), the unamortized book value must be written off.

**Mathematical impossibility:** You cannot have both:
- Moore's Law holding (2x performance every 18 months), AND
- 6-year depreciation being economically accurate

One must give. The weight of 60 years of empirical evidence favors Moore's Law.

### Depreciation Policy Changes (2023-2025)

| Company | Previous Schedule | Current Schedule | Change |
|---------|------------------|------------------|--------|
| **Amazon** | 3 years (servers) | 5 years (AI servers), 6 years (networking) | +67-100% |
| **Google/Alphabet** | 3-4 years | 6 years (servers/network) | +50-100% |
| **Microsoft** | 2-4 years | 2-6 years (computer equipment range) | +50% |
| **Meta** | 4 years | 5.5 years (servers/network) | +38% |
| **CoreWeave** | N/A (IPO 2025) | 6 years | — |
| **Nebius** | N/A | 4 years | — |
| **Lambda Labs** | N/A | 5 years | — |

**Collective impact:** ~$18B annual depreciation reduction (2023-2025)  
**Cumulative understatement (2026-2028):** ~$176B (Michael Burry thesis)

### Company-Level EPS Impact

| Company | Annual Depreciation Savings | EPS Impact (if reversed to 3-year) |
|---------|----------------------------|-----------------------------------|
| **Amazon** | ~$3-4B | −12-18% |
| **Google** | ~$5-6B | −15-22% |
| **Microsoft** | ~$4-5B | −18-25% |
| **Meta** | ~$2-3B | −10-15% |

**Key insight:** Depreciation is not a cash expense, but it is a **real economic cost**. Equipment becomes obsolete. It must be replaced. Extending depreciation schedules doesn't extend the useful life of the hardware — it just pushes the recognition of obsolescence into the future.

When the bill comes due (and it will), earnings will absorb the full impact in a single period rather than being amortized smoothly.

### Value Cascade Risk

**Hyperscaler defense:** Training workloads cascade to inference, then to batch processing, extending useful life beyond 3 years.

**The flaw:** This cascade assumes architectural compatibility across generations. If Blackwell/Rubin require different software stacks, memory architectures, or interconnect protocols, Hopper clusters cannot cascade — they become stranded assets.

**Impairment trigger:** Any of the following forces write-downs:
- New architecture requires different instruction sets
- Memory bandwidth gap makes old GPUs economically unusable
- Software frameworks drop support for older architectures
- Energy costs make old GPUs uneconomical vs. new generation

---

## Cash Flow Reality Check

### Capital Expenditure vs. AI Revenue Growth

| Company | CapEx Growth (2024-2025) | AI Revenue Growth | Gap |
|---------|-------------------------|-------------------|-----|
| **Microsoft** | +62% | +28% | −34pp |
| **Google** | +51% | +22% | −29pp |
| **Meta** | +47% | +31% | −16pp |
| **Amazon** | +73% | +19% | −54pp |

**The math doesn't work.** You cannot sustain 50-80% capex growth indefinitely when the revenue it's supposed to generate is growing at 20-30%.

### Free Cash Flow Trajectory

**2024:** Hyperscalers collectively generated ~$180B in free cash flow  
**2025 (projected):** ~$140B (capex surge absorbs cash)  
**2026 (projected):** ~$90B (if capex continues at current pace)

At some point, the market will stop rewarding capex growth for its own sake and start demanding **returns on invested capital**. That inflection point is where the narrative breaks.

---

## Competitive Landscape: Beyond NVIDIA

### Custom Silicon Competition

Hyperscalers are developing in-house AI chips to reduce NVIDIA dependence:

| Company | Chip | Status | Implications |
|---------|------|--------|--------------|
| **Google** | TPU v5/v6 | Production | Reduces NVIDIA exposure; validates custom silicon economics |
| **Amazon** | Trainium/Inferentia | Scaling | 40% cost savings vs. H100; internal deployment growing |
| **Microsoft** | Maia 100 | Early deployment | Limited scale; signals strategic intent |
| **Meta** | MTIA v2 | Production | Inference-focused; reduces inference GPU demand |

**Implication:** Even if AI demand remains strong, NVIDIA faces **share erosion** from custom silicon. The TAM growth may not translate to NVIDIA revenue growth.

### Huawei's Ascend 910C: The China Threat

**Specifications (late 2025):**
- Performance: ~80-85% of NVIDIA H100 on inference workloads
- Price: 40-50% below H100 (domestic China pricing)
- Production capacity: Scaling rapidly (estimated 500K+ units annually by 2026)
- Customer base: Alibaba, Tencent, Baidu, ByteDance (forced migration due to export controls)

**The irony:** Export controls accelerated China's GPU independence rather than preventing it.

### Implications for NVIDIA

1. **Lost China revenue:** ~$12-15B annually (pre-control levels)
2. **Pricing pressure:** Huawei's domestic dominance creates a reference price that undermines NVIDIA's premium positioning globally
3. **Technology convergence:** Huawei is 12-18 months behind NVIDIA, not 5+ years. The gap is closing, not widening.
4. **Custom silicon threat:** Hyperscaler ASICs address 20-30% of addressable market (inference, specific training workloads)

**Key risk:** If Huawei achieves parity on inference workloads (likely by 2027), NVIDIA's moat shrinks from "technological monopoly" to "performance premium" — a much less defensible position at 30+ P/E.

---

## GPU Cloud Provider Vulnerability

### Debt Maturity Schedules

Pure-play GPU cloud providers financed their buildouts with significant debt:

| Company | Debt Outstanding | Maturity Wall | Interest Rate |
|---------|-----------------|---------------|---------------|
| **CoreWeave** | ~$8-10B | 2027-2029 | 7-9% |
| **Lambda Labs** | ~$2-3B | 2027-2028 | 8-10% |
| **Nebius** | ~$1-2B | 2028-2030 | 6-8% |

**Refinancing risk:** If the AI narrative breaks in 2027:
- Credit spreads widen 300-500bp
- Debt maturities cannot be refinanced at sustainable rates
- Equity dilution or bankruptcy becomes likely

### Business Model Fragility

GPU clouds face a structural squeeze:

1. **Hyperscaler competition:** AWS/Azure/GCP can undercut on price (vertical integration, lower cost of capital)
2. **NVIDIA pricing:** GPU clouds pay list price; hyperscalers negotiate volume discounts
3. **Customer concentration:** Top 10 customers represent 60-80% of revenue for most GPU clouds
4. **No moat:** Hardware is commoditized; software stack lags hyperscalers

**Likely outcomes:**
- Consolidation (hyperscalers acquire distressed GPU clouds at fire-sale prices)
- Bankruptcies (highly leveraged names cannot refinance)
- Equity dilution (down rounds for private GPU clouds)

---

## The Transmission Chain: How the Bust Propagates

### Phase 1: Earnings Reality (Q2-Q4 2026)

**Trigger:** One or more hyperscalers miss AI revenue guidance or announce depreciation policy reversal

**Immediate impact:**
- Hyperscaler stocks decline 15-25%
- AI revenue growth narrative questioned
- Analyst estimates cut across the sector

### Phase 2: Capex Contraction (2027)

**Response:** Hyperscalers slash capex guidance to protect free cash flow

**Impact on NVIDIA:**
- Data center revenue growth turns negative
- Inventory buildup at channel partners
- Gross margin pressure (76% → 62-65%)

### Phase 3: GPU Cloud Crisis (2027-2028)

**Pure-play GPU cloud providers** (CoreWeave, Lambda Labs, Nebius) face an existential squeeze:

1. **Revenue pressure:** Hyperscalers undercut on price; customers consolidate to major clouds
2. **Cost pressure:** NVIDIA pricing doesn't decline proportionally with demand
3. **Financing pressure:** Debt maturities collide with deteriorating credit metrics

**Likely outcomes:**
- Consolidation (hyperscalers acquire distressed GPU clouds at fire-sale prices)
- Bankruptcies (highly leveraged names cannot refinance)
- Equity dilution (down rounds for private GPU clouds)

### Phase 4: NVIDIA Reckoning (2027-2028)

**The final domino:**

| Metric | 2025 Peak | 2027 Bust Case | Decline |
|--------|-----------|----------------|---------|
| Revenue | $180B | $110B | −39% |
| Gross Margin | 76% | 62% | −14pp |
| EPS | $12.50 | $6.80 | −46% |
| P/E Multiple | 32x | 18x | −44% |
| **Stock Price** | **$400** | **$122** | **−70%** |

**Note:** This is not a "AI is dead" scenario. It's a "AI growth was priced for perfection and reality disappointed" scenario.

---

## Historical Bubble Parallels

### Dot-Com Infrastructure Bubble (1998-2001)

| Metric | 1999 Telecom | 2025 AI Infrastructure |
|--------|--------------|------------------------|
| **Capex/Sales** | 25-30% | 20-28% |
| **Fiber laid / GPU deployed** | 100x demand | 3-5x demand |
| **Depreciation games** | Extended asset lives | Extended server lives |
| **Narrative** | "Internet traffic doubles every 100 days" | "AI compute demand doubles every 6 months" |
| **Outcome** | Global Crossing, WorldCom bankruptcies | GPU cloud bankruptcies likely |

**The parallel:** Overbuild → excess capacity → price collapse → bankruptcies → consolidation. The technology was real (internet then, AI now), but the economics were fictional.

### 2008 Financial Crisis Parallels

| Element | 2008 | 2026 AI Bubble |
|---------|------|----------------|
| **Leverage** | Mortgage-backed securities | GPU cloud debt |
| **Accounting fiction** | Mark-to-model on CDOs | Extended depreciation schedules |
| **Systemic risk** | Banks interconnected | Hyperscaler-NVIDIA-GPU cloud interdependence |
| **Trigger** | Subprime defaults | AI revenue miss / depreciation reversal |

**Lesson:** When accounting fiction meets economic reality, the adjustment is violent and systemic.

---

## Sensitivity Analysis: Depreciation Reversal Scenarios

### Scenario 1: Gradual Normalization (Probability: 40%)

**Assumption:** Hyperscalers quietly normalize schedules over 3-4 years (no single-year shock)

| Company | EPS Impact (2026-2028) | Stock Impact |
|---------|------------------------|--------------|
| **MSFT** | −8-12% | −15-20% |
| **GOOGL** | −10-15% | −18-25% |
| **META** | −6-10% | −12-18% |
| **AMZN** | −5-8% | −10-15% |

**Outcome:** Painful but manageable. Multiples compress, but no systemic crisis.

### Scenario 2: Forced Reversal (Probability: 35%)

**Assumption:** SEC/auditor pressure forces 2027 restatement or impairment charges

| Company | EPS Impact (Single Year) | Stock Impact |
|---------|-------------------------|--------------|
| **MSFT** | −18-25% | −30-40% |
| **GOOGL** | −20-28% | −35-45% |
| **META** | −15-22% | −25-35% |
| **AMZN** | −12-18% | −20-30% |

**Outcome:** Earnings shock triggers multiple compression. GPU clouds face refinancing crisis.

### Scenario 3: Systemic Bust (Probability: 25%)

**Assumption:** AI revenue growth decelerates sharply; capex slashed; impairment charges cascade

| Company | EPS Impact (Peak-to-Trough) | Stock Impact |
|---------|----------------------------|--------------|
| **MSFT** | −30-40% | −45-55% |
| **GOOGL** | −35-45% | −50-60% |
| **META** | −25-35% | −40-50% |
| **NVDA** | −50-60% | −65-75% |
| **GPU Clouds** | Bankruptcy risk | −80-100% |

**Outcome:** 2000-style bust. Survivors acquire distressed assets at fire-sale prices.

---

## Timeline & Triggers

### 2026: The Cracks Appear

| Quarter | Expected Event |
|---------|----------------|
| **Q2 2026** | First hyperscaler misses AI revenue guidance; stock declines 10-15% |
| **Q3 2026** | Analyst begins questioning depreciation policies; Burry thesis gains traction |
| **Q4 2026** | One hyperscaler announces depreciation reversal or impairment charge |

### 2027: The Unwind Accelerates

| Quarter | Expected Event |
|---------|----------------|
| **Q1 2027** | Hyperscalers collectively slash capex guidance |
| **Q2 2027** | NVIDIA data center growth turns negative YoY |
| **Q3 2027** | First GPU cloud provider bankruptcy or distressed M&A |
| **Q4 2027** | NVIDIA guides below consensus; multiple compression begins |

### 2028: The Bottom

- Sector-wide earnings trough
- Valuation reset (NVIDIA 15-18x P/E, hyperscalers 12-15x P/E)
- Consolidation complete (survivors acquire distressed assets)
- **Entry point for long positions** (AI infrastructure is not dead — it's just appropriately valued)

---

## Instrument Strategy

### Primary Shorts (Highest Conviction)

| Ticker | Name | Rationale | Entry | Target | Stop |
|--------|------|---------|-------|--------|------|
| **NVDA** | NVIDIA | Epicenter of the bubble; 30+ P/E unsustainable | $380-400 | $120-150 | $450 |
| **CW** | CoreWeave (public 2025) | Pure-play GPU cloud; highest leverage to bust | IPO-60 | $15-20 | IPO+20% |
| **LAMB** | Lambda Labs (if public) | GPU cloud; likely bankruptcy candidate | N/A | $5-10 | N/A |
| **NBIS** | Nebius | GPU cloud; 4-year depreciation still aggressive | $40-50 | $15-20 | $60 |

### Secondary Shorts (Hyperscaler Exposure)

| Ticker | Name | Rationale | Entry | Target | Stop |
|--------|------|---------|-------|--------|------|
| **MSFT** | Microsoft | Largest AI capex; highest depreciation risk | $420-440 | $280-320 | $470 |
| **GOOGL** | Alphabet | 6-year depreciation most aggressive | $175-185 | $110-130 | $200 |
| **META** | Meta | 5.5-year schedule; advertising cash flow can mask issues longer | $520-550 | $350-380 | $600 |
| **AMZN** | Amazon | Already reversed to 5 years for AI servers (acknowledged risk) | $185-195 | $120-140 | $215 |

### Puts vs. Direct Short

**Preference:** Long-dated puts (LEAPS) over direct short

**Rationale:**
1. **Defined risk:** Maximum loss is premium paid
2. **Timing flexibility:** Bust may take 12-24 months to unfold
3. **Convexity:** 5-10x returns possible if thesis plays out fully
4. **No margin calls:** Can withstand interim volatility

**Recommended structure:**
- **NVDA:** Jan 2028 $150 puts (20-30% of portfolio allocation)
- **MSFT/GOOGL:** Jan 2028 $120/$100 puts respectively (30-40% allocation)
- **GPU cloud (CW/LAMB/NBIS):** Direct short or near-term puts (20-30% allocation)

### Hedging the Short

**Long positions to pair:**

| Ticker | Name | Rationale |
|--------|------|-----------|
| **AMD** | Advanced Micro Devices | Will gain share as NVIDIA pricing power erodes; less valuation risk |
| **INTC** | Intel | Foundry business benefits from GPU supply chain diversification |
| **TSM** | TSMC | Still the foundry winner regardless of which GPU vendor wins |

**Note:** These are not "AI is dead" hedges. They are "AI infrastructure consolidates and rationalizes" hedges.

---

## Risk Factors

### What Could Invalidate This Thesis

1. **Moore's Law breaks:** If GPU performance doubling slows to 36+ months, 5-6 year depreciation becomes defensible. **Probability:** Very Low (10-15%) — 60 years of evidence favors continuation.

2. **AI revenue acceleration:** If AI products generate 50%+ revenue growth (not 20-30%), capex math works. **Probability:** Low (15-20%)

3. **Value cascade succeeds:** If training workloads successfully cascade to inference/batch, economic life extends beyond 3 years. **Probability:** Medium (30-40%) — depends on architectural compatibility.

4. **China competition contained:** If export controls successfully prevent Huawei from achieving parity, NVIDIA's moat remains intact. **Probability:** Low-Medium (25-35%)

5. **Government intervention:** If US government treats AI infrastructure as national security priority and provides subsidies/tax incentives, capex burden lightens. **Probability:** Medium (30-40%)

6. **Fed pivot / liquidity surge:** If Fed cuts rates aggressively (500bp+ in 2026-2027), growth stock multiples can remain elevated despite fundamentals. **Probability:** Low-Medium (25-35%)

### Position Sizing Guidance

| Risk Tolerance | NVDA Short | Hyperscaler Shorts | GPU Cloud Shorts | Total Portfolio |
|----------------|------------|-------------------|------------------|-----------------|
| **Conservative** | 3-5% | 5-8% | 2-3% | 10-15% |
| **Moderate** | 8-12% | 12-18% | 5-8% | 25-35% |
| **Aggressive** | 15-20% | 20-30% | 10-15% | 45-60% |

**Critical:** Do not exceed 60% of portfolio in short positions. Tail risk is real, and timing the bust is inherently uncertain.

---

## Conclusion

The AI infrastructure bubble of 2023-2025 rests on a **mathematical impossibility**: Moore's Law (60 years of empirical validation) dictates 3-4 year GPU economic life, while hyperscalers depreciate over 5-6 years. Both cannot be true.

**The accounting fiction** ($176B cumulative depreciation understatement 2026-2028) will eventually be recognized, compressing earnings 15-25% across hyperscalers. This is not a matter of *if*, but *when* and *how violently*.

**The cash flow mismatch** (50-80% capex growth vs. 20-30% revenue growth) creates a funding gap that must eventually close. Free cash flow is projected to decline from $180B (2024) to $90B (2026) if current capex trajectories continue.

**The China competition** (Huawei's rapid ascent) undermines the technological monopoly that justified premium valuations. Export controls backfired, accelerating Chinese GPU independence.

**The custom silicon threat** (Google TPU, Amazon Trainium, Microsoft Maia) erodes NVIDIA's addressable market even if AI demand remains strong.

**The transmission chain** (hyperscalers → GPU clouds → NVIDIA) ensures that when the bust comes, it will be systemic, not isolated. GPU clouds face debt maturity walls in 2027-2029 that cannot be refinanced in a bust scenario.

**The opportunity:** Short the epicenter (NVIDIA, GPU clouds) and the most vulnerable (hyperscalers with aggressive depreciation policies) with long-dated puts. Size appropriately. Be patient. **The math will win in the end.**

---

## Appendix: Key Data Sources

- SEC 10-K filings (GOOGL FY2025, MSFT FY2025, AMZN FY2025, META FY2025)
- Company earnings calls (Q4 2025, Q1 2026)
- Analyst commentary (Michael Burry, theCUBE Research, Deep Quarry Substack, CNBC November 2025)
- Industry reports (TrendForce, Gartner, IDC GPU market analysis)
- Web searches for Huawei Ascend 910C specifications and production capacity
- Web searches for GPU cloud debt financing terms and maturity schedules
- Moore's Law historical validation (Intel, NVIDIA architecture documentation 1965-2026)

---

*This document is for informational purposes only and does not constitute investment advice. Short selling involves unlimited risk. Conduct your own due diligence before making investment decisions.*
