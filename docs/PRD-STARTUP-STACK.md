# PRD: Startup Stack — From Passion Project to Startup

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07  
**Reference:** [The Stack — ikigaistudio's Substack](https://ikigaistudio.substack.com/p/the-stack)

---

## 1. Executive Summary

When moving beyond passion project / MVP into a startup, we adopt **The Stack** as our framework and legal setup. The Stack collapses an entire infrastructure layer into something a solo founder can access on day one: entity formation, custody, compliance, stablecoin payments, programmable equity, and asset tokenization — all onchain, all compliant, all accessible without proximity to power.

**Core insight:** The old financial system was built on access. This one is built on architecture. A founder anywhere can form a Wyoming LLC from their phone, tokenize equity before lunch, issue a branded stablecoin by dinner, and fractionalize assets for their community by bedtime. Total cost: ~$500 and an afternoon.

---

## 2. The Stack — Components

| Layer | Provider | What it does |
|-------|----------|--------------|
| **Entity** | [doola](https://doola.com) | US LLC formation for non-residents — Wyoming, full paperwork, EIN, registered agent, banking — days, remotely, few hundred dollars. Domestic entity status unlocks everything else. |
| **Rails** | [Coinbase Developer Platform](https://www.coinbase.com/developer-platform) | One API key: institutional custody, compliance, stablecoin payments, wallet infra, trading, onramps/offramps. Branded stablecoins (stablecoin-as-a-service). Tokenize for RWA. Settles on Base. |
| **Equity** | [Fairmint](https://fairmint.com) | SEC-registered Transfer Agent. Cap table on blockchain. Programmable vesting, governance. Fundraising portal with KYC/AML. Reg D, Reg A+. Over $1B onchain equity processed. |
| **Settlement** | Base | Coinbase L2. Near-zero cost, 24/7. USDC-denominated. |

**The flywheel:** Form LLC → Tokenize equity via Fairmint → Issue branded stablecoin via Coinbase → Tokenize RWA via Coinbase → Community subscribes, pays, earns equity, invests in fractionalized assets — all onchain, all instant, one ecosystem.

---

## 3. Why This Matters for Dexter / IkigaiLabs

**Current state:** Passion project. CLI, WhatsApp, HTTP API. No legal entity. No revenue model. No community ownership.

**Target state:** Startup. Legal standing. Revenue that sustains the system. Community that can own a piece. Runs on the same rails that make it possible.

**Mapping to The Stack:**

| Dexter/IkigaiLabs need | Stack component |
|-----------------------|-----------------|
| Legal entity for contracts, banking, platform access | doola Wyoming LLC |
| Custody, compliance, payments | Coinbase Developer Platform |
| Community ownership (tokenize equity) | Fairmint |
| Revenue (API, subscriptions, micropayments) | USDC on Base, x402 for paid endpoints |
| Settlement layer | Base |

**Precedent:** VINCE — autonomous AI trading desk on ElizaOS. Ten agents, funded wallet on Base, x402 micropayments for API endpoints, revenue flows back to fund LLM/compute. Community can own equity via Fairmint. Built by a small team, runs autonomously, settles on one chain. "Three years ago this required a fund, a prime broker, a legal team, and eight figures. Today it requires the stack and the will to build."

---

## 4. The European Problem (Why US Entity)

From The Stack: Everything in the flywheel is "effectively illegal or practically impossible" for a European entity. MiCA (EU crypto regulation) demands EMI/CI authorization for stablecoins, MiFID II or CASP for tokenization, months to years, six figures minimum. A Wyoming LLC takes an afternoon and costs less than dinner in Paris.

**Implication:** If we want The Stack, we form a US entity. No European equivalent exists at this friction level.

---

## 5. Path from MVP to Startup

### Phase 1: Entity (Day 1)

1. Form Wyoming LLC via doola (remote, non-resident OK)
2. Get EIN, registered agent, banking
3. Domestic entity status → unlocks Coinbase, Fairmint, US platforms

### Phase 2: Rails (Week 1–2)

1. Coinbase Developer Platform — API key, custody, compliance
2. Base — settlement layer for any revenue, subscriptions, micropayments
3. USDC — denomination for payments

### Phase 3: Revenue Loop (Month 1–2)

1. Identify monetizable outputs (e.g. paid API, premium heartbeat, research reports)
2. x402 or similar for micropayments if applicable
3. Revenue sustains compute, data, LLM costs — system pays for itself

### Phase 4: Community Ownership (Month 2–3)

1. Fairmint — tokenize equity, cap table onchain
2. Community that uses Dexter can own a piece of Dexter
3. Programmable vesting, governance

### Phase 5: Branded Economy (Optional)

1. Branded stablecoin via Coinbase (if closed-loop economy makes sense)
2. Tokenize RWA if applicable (e.g. research output, data products)

---

## 6. Non-Goals (For This PRD)

- Detailed legal advice (consult counsel)
- Specific pricing or deal terms with doola, Coinbase, Fairmint
- Product roadmap for Dexter features

---

## 7. Key Quote from The Stack

> "The only thing standing between a founder anywhere on earth and the most powerful financial toolkit ever assembled for a solo operator is a WiFi connection and the knowledge that the toolkit exists."

---

## 8. References

### Core Stack

- [The Stack — ikigaistudio's Substack](https://ikigaistudio.substack.com/p/the-stack)
- [doola](https://doola.com) — US entity formation
- [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)
- [Fairmint](https://fairmint.com) — Onchain equity
- [Base](https://base.org) — L2 settlement

### Alternatives & Complements

- [Every](https://www.every.io/) — Full back office (incorporation, banking, payroll, taxes). Alternative for C-Corp + operational infra.
- [OtoCo](https://docs.otoco.io/docs/getting-started) — Blockchain-native entity formation (Wyoming, Delaware, Marshall Islands Series LLC, Swiss Association) from wallet.

### Research & Planning

- [Money for AI](https://www.moneyforai.org/) — Bitcoin Policy Institute study: 48.3% of AI models chose Bitcoin; 79.1% for store of value. Supports BTC thesis.
- [CryptoTax Map](https://www.cryptotaxmap.io/) — Crypto tax rates across 170 countries. Useful for entity/relocation planning.

See [EXTERNAL-RESOURCES.md](./EXTERNAL-RESOURCES.md) for detailed notes on these resources.
