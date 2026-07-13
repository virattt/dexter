import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { api, stripFieldsDeep } from './api.js';
import { formatToolResult } from '../types.js';
import { TTL_1H } from './utils.js';
import { callLlm, getFastModel } from '../../model/llm.js';
import { resolveProvider } from '../../providers.js';

const REDUNDANT_INSIDER_FIELDS = ['issuer'] as const;

const InsiderTradesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch insider trades for. For example, 'AAPL' for Apple."),
  limit: z
    .number()
    .default(10)
    .describe('Maximum number of insider trades to return (default: 10, max: 1000). Increase this for longer historical windows when needed.'),
  filing_date: z
    .string()
    .optional()
    .describe('Exact filing date to filter by (YYYY-MM-DD).'),
  filing_date_gte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than or equal to this date (YYYY-MM-DD).'),
  filing_date_lte: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than or equal to this date (YYYY-MM-DD).'),
  filing_date_gt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date greater than this date (YYYY-MM-DD).'),
  filing_date_lt: z
    .string()
    .optional()
    .describe('Filter for trades with filing date less than this date (YYYY-MM-DD).'),
  name: z
    .string()
    .optional()
    .describe("Filter by insider name. Common names are accepted (e.g. 'Jensen Huang') and automatically resolved to the exact SEC filing spelling (e.g. 'HUANG JEN HSUN'). Use get_insider_names to list all insiders for a ticker."),
});

async function fetchInsiderNames(ticker: string): Promise<string[]> {
  const { data } = await api.get('/insider-trades/names/', { ticker }, { cacheable: true, ttlMs: TTL_1H });
  return (data.names || []) as string[];
}

/**
 * Token-based candidate matching: order-insensitive, with prefix matching to
 * handle SEC truncations (JEN ↔ Jensen, Tim ↔ Timothy). A candidate matches
 * when every query token matches one of its tokens.
 */
function tokenMatchNames(query: string, candidates: string[]): string[] {
  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return candidates.filter(candidate => {
    const candidateTokens = candidate.toLowerCase().split(/\s+/).filter(Boolean);
    return queryTokens.every(q =>
      candidateTokens.some(c => c.startsWith(q) || q.startsWith(c))
    );
  });
}

const NameMatchSchema = z.object({
  matches: z
    .array(z.string())
    .describe('Candidate names that refer to the queried person, copied verbatim from the list. Empty if the person is not in the list.'),
});

/**
 * LLM candidate matching: handles nickname-to-legal-name jumps the token
 * matcher cannot see (Bill → William, Jamie → James). Output is validated
 * against the candidate list so a hallucinated name can never reach the API.
 */
async function llmMatchNames(model: string, query: string, candidates: string[]): Promise<string[]> {
  const fastModel = getFastModel(resolveProvider(model).id, model);
  const { response } = await callLlm(
    `Person: "${query}"\n\nCandidate names from SEC filings:\n${candidates.map(c => `- ${c}`).join('\n')}`,
    {
      model: fastModel,
      systemPrompt:
        "You match a person's common name to the exact spelling(s) used in SEC insider filings. " +
        'Filing names may be reordered (last name first), abbreviated, or use the legal form of a nickname (Bill → William, Jamie → James, Jensen → Jen Hsun). ' +
        'The same person may appear under multiple spellings — return every spelling that refers to them, copied verbatim from the candidate list. ' +
        'Return an empty list if the person is not in the list. Never return a name for a different person.',
      outputSchema: NameMatchSchema,
    }
  );
  const matched = NameMatchSchema.parse(response).matches;
  const valid = new Set(candidates);
  return matched.filter(m => valid.has(m));
}

/**
 * Resolve a common name ("Jensen Huang") to the exact SEC filing spelling(s)
 * via the free /insider-trades/names/ endpoint. The deterministic token
 * matcher runs first; the LLM matcher is a fallback for queries it cannot
 * match at all, keeping the common path fast and predictable. The same person
 * can appear under multiple spellings across filings (e.g. 'HUANG JEN HSUN'
 * and 'Jen Hsun Huang'), so all matching spellings are returned. Returns the
 * input unchanged when nothing matches, so exact spellings always pass through.
 */
async function resolveInsiderNames(ticker: string, name: string, model: string): Promise<string[]> {
  const candidates = await fetchInsiderNames(ticker);
  const tokenMatches = tokenMatchNames(name, candidates);
  if (tokenMatches.length > 0) return tokenMatches;
  const llmMatches = await llmMatchNames(model, name, candidates);
  return llmMatches.length > 0 ? llmMatches : [name];
}

export function createGetInsiderTrades(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'get_insider_trades',
    description: `Retrieves insider trading transactions for a given company ticker. Insider trades include purchases and sales of company stock by executives, directors, and other insiders. This data is sourced from SEC Form 4 filings. Use filing_date filters to narrow down results by date range. Use the name parameter to filter by a specific insider.`,
    schema: InsiderTradesInputSchema,
    func: async (input) => {
      const ticker = input.ticker.toUpperCase();
      let names: (string | undefined)[] = [input.name];
      if (input.name) {
        try {
          names = await resolveInsiderNames(ticker, input.name, model);
        } catch {
          // Name resolution is best-effort; fall back to the caller's spelling.
        }
      }
      const results = await Promise.all(names.map(name => {
        const params: Record<string, string | number | undefined> = {
          ticker,
          limit: input.limit,
          filing_date: input.filing_date,
          filing_date_gte: input.filing_date_gte,
          filing_date_lte: input.filing_date_lte,
          filing_date_gt: input.filing_date_gt,
          filing_date_lt: input.filing_date_lt,
          name,
        };
        return api.get('/insider-trades/', params, { cacheable: true, ttlMs: TTL_1H });
      }));
      const trades = results
        .flatMap(r => (r.data.insider_trades || []) as Record<string, unknown>[])
        .sort((a, b) => String(b.filing_date ?? '').localeCompare(String(a.filing_date ?? '')))
        .slice(0, input.limit);
      return formatToolResult(
        stripFieldsDeep(trades, REDUNDANT_INSIDER_FIELDS),
        results.map(r => r.url)
      );
    },
  });
}

const InsiderNamesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to list insider names for. For example, 'NVDA' for Nvidia."),
});

export const getInsiderNames = new DynamicStructuredTool({
  name: 'get_insider_names',
  description: `Lists the exact insider names on file for a given company ticker, as recorded in SEC filings (e.g. 'HUANG JEN HSUN'). Use this to see which executives, directors, and other insiders have filings for a company, or to resolve a person's common name to the exact spelling accepted by the get_insider_trades name filter.`,
  schema: InsiderNamesInputSchema,
  func: async (input) => {
    const { data, url } = await api.get('/insider-trades/names/', { ticker: input.ticker.toUpperCase() }, { cacheable: true, ttlMs: TTL_1H });
    return formatToolResult(data.names || [], [url]);
  },
});
