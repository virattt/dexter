import { callLlm } from '../model/llm.js';
import { MemoryManager } from './index.js';
import { CONTEXT_THRESHOLD } from '../utils/tokens.js';

export const MEMORY_FLUSH_TOKEN = 'NO_MEMORY_TO_FLUSH';

const MEMORY_FLUSH_PROMPT = `
Session context is close to compaction. Summarize durable facts and user preferences worth remembering long-term.

Rules:
- Output concise markdown bullet points.
- Include durable facts, explicit user preferences, and stable decisions.
- **Date-stamp all financial data** — append the approximate period so future sessions know freshness.
  Example: "AAPL P/E 22× TTM (FY2024-Q3), forward P/E 18× (analyst consensus 2025-03)"
- Do not store raw stock prices or market caps (they change daily). Store conclusions and theses instead.

Priority order — if space is limited, preserve higher-priority items first:

### P1 — CRITICAL (always keep)
- **Ticker routing**: which data source worked for each ticker
  (e.g., "VWS.CO: FMP premium-only, use web_search"; "AAPL: FMP ok")
- **User risk profile**: risk tolerance, investment horizon, position size limits
- **Portfolio decisions**: specific buy/sell/hold decisions and the reasoning

### P2 — IMPORTANT (keep when possible)
- **Investment theses**: ticker, thesis summary, key metrics that support it, target price range (date-stamped)
- **Analyst consensus**: price targets, recommendation distribution, estimate revision direction (date-stamped)
- **WACC / valuation assumptions used**: for each DCF run, store the key inputs (growth rate, WACC, terminal rate)
- **Risk flags**: red flags, concerns, or reasons to avoid a specific stock

### P3 — USEFUL (keep if space allows)
- **Sector / macro context**: sector correlations, macro observations relevant to user's holdings
- **Company profiles**: business model notes, key operational metrics, competitive position
- **Market patterns**: seasonal effects or recurring patterns the user has noted

### P4 — PERSONAL CONTEXT
- Life events affecting finances (job change, home purchase, family)
- Tax situation or jurisdiction
- Financial goals (retirement targets, income targets, savings goals)
- Account details mentioned (brokerage, 401k, IRA specifics)

Do not include temporary tool output, raw API responses, or stock prices.
If nothing should be stored, reply exactly with ${MEMORY_FLUSH_TOKEN}.
`.trim();

export function shouldRunMemoryFlush(params: {
  estimatedContextTokens: number;
  threshold?: number;
  alreadyFlushed: boolean;
}): boolean {
  const threshold = params.threshold ?? CONTEXT_THRESHOLD;
  if (params.alreadyFlushed) {
    return false;
  }
  return params.estimatedContextTokens >= threshold;
}

export async function runMemoryFlush(params: {
  model: string;
  systemPrompt: string;
  query: string;
  toolResults: string;
  signal?: AbortSignal;
}): Promise<{ flushed: boolean; written: boolean; content?: string }> {
  const prompt = `
Original user query:
${params.query}

Relevant retrieved context:
${params.toolResults || '[no tool results yet]'}

${MEMORY_FLUSH_PROMPT}
`.trim();

  const result = await callLlm(prompt, {
    model: params.model,
    systemPrompt: params.systemPrompt,
    signal: params.signal,
  });
  const response = typeof result.response === 'string' ? result.response.trim() : '';
  if (!response || response === MEMORY_FLUSH_TOKEN) {
    return { flushed: true, written: false };
  }

  const manager = await MemoryManager.get();
  await manager.appendDailyMemory(`## Pre-compaction memory flush\n${response}`);
  return { flushed: true, written: true, content: response };
}
