import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const BASE_URL = 'https://api.financialdatasets.ai';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
}

/**
 * Remove redundant fields from API payloads before they are returned to the LLM.
 * This reduces token usage while preserving the financial metrics needed for analysis.
 */
export function stripFieldsDeep(value: unknown, fields: readonly string[]): unknown {
  const fieldsToStrip = new Set(fields);

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map(walk);
    }

    if (!node || typeof node !== 'object') {
      return node;
    }

    const record = node as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(record)) {
      if (fieldsToStrip.has(key)) {
        continue;
      }
      cleaned[key] = walk(child);
    }

    return cleaned;
  }

  return walk(value);
}

export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>,
  options?: { cacheable?: boolean }
): Promise<ApiResponse> {
  const label = describeRequest(endpoint, params);

  // Check local cache first — avoids redundant network calls for immutable data
  if (options?.cacheable) {
    const cached = readCache(endpoint, params);
    if (cached) {
      return cached;
    }
  }

  // Read API key lazily at call time (after dotenv has loaded)
  const FINANCIAL_DATASETS_API_KEY = process.env.FINANCIAL_DATASETS_API_KEY;

  const endpointStr = endpoint.toLowerCase();
  const basePath = endpointStr.split('?')[0];
  const ticker = String(params.ticker ?? '').toUpperCase();
  let responseKey = 'data';
  let consensusData: any = null;

  try {
    const {
      getYahooPrices,
      getYahooIncomeStatements,
      getYahooBalanceSheets,
      getYahooCashFlowStatements,
      getYahooQuote,
    } = await import('./yahoo-finance.js');
    
    // Auto-discover the Finviz scraping utility
    const { getFinvizSnapshot } = await import('./finviz-fundamental-search.js');

    if (basePath === '/prices/snapshot' || basePath === '/prices/snapshot/') {
      // Base quote logic: Fetch from Yahoo but gracefully mix Finviz if possible
      const [yahooQuote, finvizData] = await Promise.allSettled([
        getYahooQuote(ticker),
        getFinvizSnapshot(ticker)
      ]);
      const yData = yahooQuote.status === 'fulfilled' ? yahooQuote.value[0] : {};
      const fData = finvizData.status === 'fulfilled' ? finvizData.value : {};
      
      consensusData = { ...yData, finviz_metrics: fData };
      responseKey = 'snapshot';
    } else if (basePath === '/prices' || basePath === '/prices/') {
      consensusData = await getYahooPrices(
        ticker,
        params.start_date as string | undefined,
        params.end_date as string | undefined
      );
      responseKey = 'prices';
    } else if (basePath.includes('/income-statements')) {
      consensusData = await getYahooIncomeStatements(ticker, params.period as string | undefined);
      responseKey = 'income_statements';
    } else if (basePath.includes('/balance-sheets')) {
      consensusData = await getYahooBalanceSheets(ticker, params.period as string | undefined);
      responseKey = 'balance_sheets';
    } else if (basePath.includes('/cash-flow-statements')) {
      consensusData = await getYahooCashFlowStatements(ticker, params.period as string | undefined);
      responseKey = 'cash_flow_statements';
    } else if (basePath === '/financials' || basePath === '/financials/') {
      const [inc, bal, cf] = await Promise.all([
         getYahooIncomeStatements(ticker, params.period as string | undefined),
         getYahooBalanceSheets(ticker, params.period as string | undefined),
         getYahooCashFlowStatements(ticker, params.period as string | undefined)
      ]);
      // Returns a single object with the 3 statements array
      consensusData = { income_statements: inc, balance_sheets: bal, cash_flow_statements: cf };
      responseKey = 'financials';
    } else if (basePath === '/financial-metrics/snapshot' || basePath === '/financial-metrics/snapshot/') {
      // Core consensus feature requested by the user: Side-by-side Yahoo and Finviz
      const [yahooMetrics, finvizMetrics] = await Promise.allSettled([
        getYahooQuote(ticker),
        getFinvizSnapshot(ticker)
      ]);
      
      const yData = yahooMetrics.status === 'fulfilled' ? yahooMetrics.value[0] : null;
      const fData = finvizMetrics.status === 'fulfilled' ? finvizMetrics.value : null;
      
      consensusData = {
         yahoo_data: yData,
         finviz_data: fData
      };
      // Flattening some core metrics back into the top level to avoid schema breakages in old tools
      if (yData) Object.assign(consensusData, yData); 
      
      responseKey = 'snapshot';
    } else if (basePath === '/financial-metrics' || basePath === '/financial-metrics/') {
      const yahooData = await getYahooQuote(ticker);
      consensusData = yahooData;
      responseKey = 'financial_metrics';
    }

    if (consensusData) {
      logger.info(`[US Consensus] Successfully built data for ${ticker} on ${basePath}`);

      const fallbackResponse: ApiResponse = {
        data: { [responseKey]: consensusData, status: 'success' },
        url: endpointStr,
      };
      if (options?.cacheable) {
        writeCache(endpoint, params, fallbackResponse.data, fallbackResponse.url);
      }
      return fallbackResponse;
    }
    
    // If consensus failed entirely
    throw new Error(`Consensus extraction failed for ${ticker} on ${basePath}`);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[US Consensus API] fetch error: ${label} — ${message}`);
    throw new Error(`[US Consensus API] request failed for ${label}: ${message}`);
  }
}
