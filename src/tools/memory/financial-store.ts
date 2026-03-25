import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../../memory/index.js';
import type { RoutingResult } from '../../memory/financial-tags.js';

export const STORE_FINANCIAL_INSIGHT_DESCRIPTION = `
Persist a financial finding to long-term memory for use in future sessions.

**Call this after completing analysis** to store:
- Investment thesis or valuation estimate for a company
- Which data source worked for a ticker (routing result)
- Analyst consensus and date
- Discovered risk flags or red flags
- Any pattern or insight worth remembering

**When to use:** After researching a company, after discovering a routing limitation
(e.g., VWS.CO is FMP premium-only), after forming a thesis or conclusion.
Stored insights are automatically loaded at the start of every future session.
`.trim();

const schema = z.object({
  ticker: z.string().describe('Ticker symbol, e.g. VWS.CO, AAPL'),
  content: z.string().describe('The insight to store — markdown text, analysis summary, thesis, or routing note'),
  tags: z.array(z.string()).optional().describe(
    'Classification tags: routing:fmp-premium, routing:web-fallback, analysis:thesis, analysis:risk, analysis:valuation, sector:energy, exchange:CPH, etc.',
  ),
  routing: z.enum(['fmp-ok', 'fmp-premium', 'yahoo-ok', 'web-fallback']).optional().describe(
    'Which data source works for this ticker',
  ),
  exchange: z.string().optional().describe('Exchange MIC code, e.g. CPH, XNAS'),
  sector: z.string().optional().describe('Industry sector, e.g. energy, technology'),
});

export const storeFinancialInsightTool = new DynamicStructuredTool({
  name: 'store_financial_insight',
  description: STORE_FINANCIAL_INSIGHT_DESCRIPTION,
  schema,
  func: async ({ ticker, content, tags, routing, exchange, sector }) => {
    const manager = await MemoryManager.get();
    const store = manager.getFinancialStore();
    if (!store) return 'Financial memory not available — insight not stored.';

    const allTags = [...(tags ?? [])];
    const tickerTag = `ticker:${ticker.toUpperCase()}`;
    if (!allTags.includes(tickerTag)) allTags.push(tickerTag);
    if (routing && !allTags.some((t) => t.startsWith('routing:'))) {
      allTags.push(`routing:${routing}`);
    }
    if (sector && !allTags.some((t) => t.startsWith('sector:'))) {
      allTags.push(`sector:${sector.toLowerCase()}`);
    }
    if (exchange && !allTags.some((t) => t.startsWith('exchange:'))) {
      allTags.push(`exchange:${exchange.toUpperCase()}`);
    }

    const id = await store.storeInsight({
      ticker,
      content,
      tags: allTags,
      routing: routing as RoutingResult | undefined,
      exchange,
      sector,
      source: 'agent',
    });

    // Also write routing facts to FINANCE.md for text-based recall
    if (routing) {
      await manager.appendMemory(
        'FINANCE.md',
        `\n- ${ticker}${exchange ? ` (${exchange})` : ''}: routing=${routing} — ${content.slice(0, 100)}`,
      );
    }

    return `Stored insight #${id} for ${ticker} with tags: ${allTags.join(', ')}`;
  },
});
