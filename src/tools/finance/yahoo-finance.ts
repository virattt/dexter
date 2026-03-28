import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { quoteSummary as directQuoteSummary } from './yahoo-client.js';

// Minimal type for the quoteSummary function, wide enough for all modules used here.
// Using `any` response type avoids coupling to yahoo-finance2 internal generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QuoteSummaryFn = (ticker: string, opts: { modules: string[] }) => Promise<any>;

const YAHOO_SOURCE_URL = (ticker: string) =>
  `https://finance.yahoo.com/quote/${ticker}/analysis`;

// ---------------------------------------------------------------------------
// makeYahooTools — factory for dependency injection (enables unit testing
// without module-level mocking)
// ---------------------------------------------------------------------------

export function makeYahooTools(quoteSummary: QuoteSummaryFn) {
  const getYahooAnalystTargets = new DynamicStructuredTool({
    name: 'get_yahoo_analyst_targets',
    description:
      'Fetches analyst consensus price targets and recommendation ratings from Yahoo Finance. ' +
      'Returns targetHighPrice, targetLowPrice, targetMeanPrice, targetMedianPrice, ' +
      'recommendationKey (buy/hold/sell), recommendationMean score, and numberOfAnalystOpinions. ' +
      'Covers international tickers (e.g. VWS.CO, AZN.L, SAP.DE) not available in other sources.',
    schema: z.object({
      ticker: z.string().describe(
        "Stock ticker symbol, including exchange suffix for international stocks (e.g. 'VWS.CO', 'AZN.L', 'SAP.DE', 'AAPL').",
      ),
    }),
    func: async (input) => {
      const ticker = input.ticker.trim();
      try {
        const result = await quoteSummary(ticker, { modules: ['financialData'] });
        const fd = result.financialData;
        if (!fd) {
          return formatToolResult({ error: `No financial data returned by Yahoo Finance for ${ticker}` }, []);
        }
        const data = {
          ticker,
          targetHighPrice: fd.targetHighPrice ?? null,
          targetLowPrice: fd.targetLowPrice ?? null,
          targetMeanPrice: fd.targetMeanPrice ?? null,
          targetMedianPrice: fd.targetMedianPrice ?? null,
          recommendationMean: fd.recommendationMean ?? null,
          recommendationKey: fd.recommendationKey ?? null,
          numberOfAnalystOpinions: fd.numberOfAnalystOpinions ?? null,
        };
        return formatToolResult(data, [YAHOO_SOURCE_URL(ticker)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: message }, []);
      }
    },
  });

  const getYahooAnalystRecommendations = new DynamicStructuredTool({
    name: 'get_yahoo_analyst_recommendations',
    description:
      'Fetches analyst buy/sell/hold recommendation trend from Yahoo Finance. ' +
      'Returns monthly counts (strongBuy, buy, hold, sell, strongSell) for the current month ' +
      'and the prior 3 months. Covers international tickers.',
    schema: z.object({
      ticker: z.string().describe(
        "Stock ticker symbol, including exchange suffix for international stocks (e.g. 'VWS.CO', 'AZN.L').",
      ),
    }),
    func: async (input) => {
      const ticker = input.ticker.trim();
      try {
        const result = await quoteSummary(ticker, { modules: ['recommendationTrend'] });
        const trend = result.recommendationTrend?.trend ?? [];
        return formatToolResult(trend, [YAHOO_SOURCE_URL(ticker)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: message }, []);
      }
    },
  });

  const getYahooUpgradeDowngradeHistory = new DynamicStructuredTool({
    name: 'get_yahoo_upgrade_downgrade_history',
    description:
      'Fetches recent analyst rating changes (upgrades, downgrades, reiterations) from Yahoo Finance. ' +
      'Returns firm name, toGrade, fromGrade, action, and date for the most recent analyst actions. ' +
      'Covers international tickers.',
    schema: z.object({
      ticker: z.string().describe(
        "Stock ticker symbol, including exchange suffix for international stocks (e.g. 'VWS.CO', 'AZN.L').",
      ),
    }),
    func: async (input) => {
      const ticker = input.ticker.trim();
      try {
        const result = await quoteSummary(ticker, { modules: ['upgradeDowngradeHistory'] });
        const history = result.upgradeDowngradeHistory?.history ?? [];
        // Return the 10 most recent entries to keep context size manageable
        return formatToolResult(history.slice(0, 10), [YAHOO_SOURCE_URL(ticker)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: message }, []);
      }
    },
  });

  const getYahooIncomeStatements = new DynamicStructuredTool({
    name: 'get_yahoo_income_statements',
    description:
      'Fetches historical income statements from Yahoo Finance. Free, no API key required. ' +
      'Works for international tickers (e.g. VWS.CO, AZN.L, SAP.DE). ' +
      'Returns totalRevenue, netIncome, grossProfit, operatingIncome, ebit per annual period. ' +
      'Used as a fallback when Financial Modeling Prep is unavailable or requires a paid plan.',
    schema: z.object({
      ticker: z.string().describe(
        "Stock ticker symbol, including exchange suffix for international stocks (e.g. 'VWS.CO', 'AZN.L', 'AAPL').",
      ),
      limit: z.number().default(4).describe('Number of periods to return (default: 4).'),
    }),
    func: async (input) => {
      const ticker = input.ticker.trim();
      try {
        const result = await quoteSummary(ticker, { modules: ['incomeStatementHistory'] });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records: any[] = result.incomeStatementHistory?.incomeStatementHistory ?? [];

        const data: Record<string, unknown>[] = [];
        for (const r of records.slice(0, input.limit)) {
          const entry: Record<string, unknown> = { date: r.endDate };
          // Only include fields that carry real values for this ticker
          if (r.totalRevenue) entry.totalRevenue = r.totalRevenue;
          if (r.grossProfit) entry.grossProfit = r.grossProfit;
          if (r.operatingIncome) entry.operatingIncome = r.operatingIncome;
          if (r.netIncome !== null && r.netIncome !== undefined) entry.netIncome = r.netIncome;
          if (r.ebit) entry.ebit = r.ebit;
          // Keep record only if it has at least one meaningful metric
          if (entry.totalRevenue !== undefined || entry.netIncome !== undefined) data.push(entry);
        }

        if (data.length === 0) {
          return formatToolResult(
            { error: `No income statement data available for ${ticker} on Yahoo Finance.` },
            [],
          );
        }

        return formatToolResult(data, [`https://finance.yahoo.com/quote/${ticker}/financials`]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return formatToolResult({ error: message }, []);
      }
    },
  });

  return { getYahooAnalystTargets, getYahooAnalystRecommendations, getYahooUpgradeDowngradeHistory, getYahooIncomeStatements };
}

// Default singleton exports — use the direct Yahoo Finance HTTP client
const _tools = makeYahooTools(directQuoteSummary);

export const getYahooAnalystTargets = _tools.getYahooAnalystTargets;
export const getYahooAnalystRecommendations = _tools.getYahooAnalystRecommendations;
export const getYahooUpgradeDowngradeHistory = _tools.getYahooUpgradeDowngradeHistory;
export const getYahooIncomeStatements = _tools.getYahooIncomeStatements;
