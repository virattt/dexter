import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import YahooFinance from 'yahoo-finance2';
import { formatToolResult } from '../types.js';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const YAHOO_SOURCE_URL = (ticker: string) =>
  `https://finance.yahoo.com/quote/${ticker}/analysis`;

// ---------------------------------------------------------------------------
// getYahooAnalystTargets
// ---------------------------------------------------------------------------

export const getYahooAnalystTargets = new DynamicStructuredTool({
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
      const result = await yf.quoteSummary(ticker, { modules: ['financialData'] });
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

// ---------------------------------------------------------------------------
// getYahooAnalystRecommendations
// ---------------------------------------------------------------------------

export const getYahooAnalystRecommendations = new DynamicStructuredTool({
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
      const result = await yf.quoteSummary(ticker, { modules: ['recommendationTrend'] });
      const trend = result.recommendationTrend?.trend ?? [];
      return formatToolResult(trend, [YAHOO_SOURCE_URL(ticker)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, []);
    }
  },
});

// ---------------------------------------------------------------------------
// getYahooUpgradeDowngradeHistory
// ---------------------------------------------------------------------------

export const getYahooUpgradeDowngradeHistory = new DynamicStructuredTool({
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
      const result = await yf.quoteSummary(ticker, { modules: ['upgradeDowngradeHistory'] });
      const history = result.upgradeDowngradeHistory?.history ?? [];
      // Return the 10 most recent entries to keep context size manageable
      return formatToolResult(history.slice(0, 10), [YAHOO_SOURCE_URL(ticker)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, []);
    }
  },
});
