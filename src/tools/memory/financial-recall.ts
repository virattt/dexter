import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryManager } from '../../memory/index.js';

export const RECALL_FINANCIAL_CONTEXT_DESCRIPTION = `
Recall persisted financial context about a ticker or company from long-term memory.

**Call this BEFORE get_financials, get_market_data, or any financial data tool** for any ticker
you may have researched before. Returns:
- Routing hints: which data source works for this ticker (e.g., "fmp-premium" = skip FMP, use web_search)
- Prior analysis conclusions: investment thesis, valuation estimates, red flags
- Analyst consensus data from previous sessions
- Known API limitations for this ticker

This avoids wasted tool calls and lets you skip straight to the source that works.

**When to use:** Always, for any ticker, at the start of a research task.
**Input:** ticker symbol (required), optional free-text query for semantic search.
`.trim();

const schema = z.object({
  ticker: z.string().describe('Ticker symbol, e.g. VWS.CO, AAPL, SAP.DE'),
  query: z.string().optional().describe('Optional semantic search query for additional context'),
  namespace: z.string().optional().describe(
    'Optional namespace to scope the recall (e.g. "dcf", "short-thesis"). ' +
    'When provided, only returns insights stored under that namespace. Omit to retrieve all insights.',
  ),
});

export const recallFinancialContextTool = new DynamicStructuredTool({
  name: 'recall_financial_context',
  description: RECALL_FINANCIAL_CONTEXT_DESCRIPTION,
  schema,
  func: async ({ ticker, query, namespace }) => {
    const manager = await MemoryManager.get();
    const store = manager.getFinancialStore();
    if (!store) return 'Financial memory not available.';

    const byTicker = store.recallByTicker(ticker, namespace);
    const byQuery = query ? store.search(query, { maxResults: 4, namespace }) : [];

    // Merge and deduplicate by id
    const seen = new Set<number>();
    const all = [...byTicker, ...byQuery].filter((i) => {
      if (i.id !== undefined && seen.has(i.id)) return false;
      if (i.id !== undefined) seen.add(i.id);
      return true;
    });

    if (all.length === 0) return `No prior financial context found for ${ticker}${namespace ? ` [ns:${namespace}]` : ''}.`;

    const routing = store.getRouting(ticker, namespace);
    const lines: string[] = [];

    if (routing) {
      lines.push(`**Routing:** ${routing} — ${routingHint(routing)}`);
      lines.push('');
    }

    lines.push(`**Stored insights for ${ticker}${namespace ? ` [ns:${namespace}]` : ''}** (${all.length} found):`);    for (const insight of all.slice(0, 6)) {
      const tags = insight.tags.length ? ` [${insight.tags.slice(0, 3).join(', ')}]` : '';
      const date = insight.updatedAt
        ? ` (${new Date(insight.updatedAt).toISOString().slice(0, 10)})`
        : '';
      lines.push(`\n- ${insight.content}${tags}${date}`);

      const related = insight.id !== undefined ? store.getRelatedInsights(insight.id) : [];
      for (const rel of related.slice(0, 2)) {
        lines.push(`  ↳ ${rel.relation}: ${rel.insight.ticker} — ${rel.insight.content.slice(0, 80)}`);
      }
    }

    return lines.join('\n');
  },
});

function routingHint(routing: string): string {
  switch (routing) {
    case 'fmp-premium': return 'skip FMP (premium tier required), use web_search directly';
    case 'fmp-ok': return 'FMP free tier works for this ticker';
    case 'yahoo-ok': return 'Yahoo Finance works for this ticker';
    case 'web-fallback': return 'all APIs failed, use web_search / web_fetch';
    default: return routing;
  }
}
