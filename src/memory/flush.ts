import { callLlm } from '../model/llm.js';
import { MemoryManager } from './index.js';
import { CONTEXT_THRESHOLD } from '../utils/tokens.js';

export const MEMORY_FLUSH_TOKEN = 'NO_MEMORY_TO_FLUSH';

const MEMORY_FLUSH_PROMPT = `
Session context is close to compaction. Summarize durable facts and user preferences worth remembering long-term.

Rules:
- Output concise markdown bullet points.
- Include durable facts, explicit user preferences, and stable decisions.
- Prioritize capturing personal financial information:
  - Financial goals (retirement targets, savings goals, income targets)
  - Risk tolerance and investment philosophy
  - Portfolio decisions and allocation changes
  - Trade history and the reasoning behind buy/sell decisions
  - Account details mentioned (brokerage, 401k, IRA specifics)
- Also capture personal context that affects financial advice:
  - Life events (job changes, home purchase, family changes)
  - Tax situation or jurisdiction
  - Time horizons and liquidity needs
- Do not include temporary tool output, market data, or stock prices.
- If nothing should be stored, reply exactly with ${MEMORY_FLUSH_TOKEN}.
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
