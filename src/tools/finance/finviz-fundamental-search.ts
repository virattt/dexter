import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';

export const FINVIZ_FUNDAMENTAL_SEARCH_DESCRIPTION = `
Scrapes and returns real-time fundamental data, valuation metrics, and sentiment analysis for US stocks directly from Finviz.com.
This is a powerful alternative/supplement to standard financial sources like Yahoo Finance or FinancialDatasets. 
Use this tool for:
- Detailed valuation (P/E, Forward P/E, PEG, P/S, P/B, P/C, P/FCF, EV/EBITDA)
- Profitability (ROA, ROE, ROIC, Gross/Oper/Profit Margins)
- Analyst consensus (Target Price, Recom)
- Growth metrics (EPS next 5Y, Sales Y/Y TTM)
- Short interest (Short Float, Short Ratio)

Only works for US equities. Provide a valid uppercase ticker (e.g., 'AAPL', 'MSFT').
`;

const FinvizInputSchema = z.object({
  ticker: z.string().describe("The US stock ticker symbol to fetch fundamental data for (e.g., 'AAPL')."),
});

export async function getFinvizSnapshot(ticker: string): Promise<Record<string, string>> {
  const symbol = ticker.trim().toUpperCase();
  logger.info(`[FinvizTool] Scraping fundamentals for ${symbol}...`);
  
  const res = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000)
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch from Finviz. Status: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const metrics: Record<string, string> = { ticker: symbol };
  
  $('.snapshot-table2 tr').each((_, row) => {
    const td = $(row).find('td');
    for(let i = 0; i < td.length; i += 2) {
       const key = $(td[i]).text().trim();
       const value = $(td[i+1]).text().trim();
       if (key && value) {
          metrics[key] = value;
       }
    }
  });
  
  if (Object.keys(metrics).length <= 1) {
    throw new Error(`Ticker ${symbol} not found or no data available on Finviz.`);
  }
  
  return metrics;
}

export const finvizFundamentalSearchTool = new DynamicStructuredTool({
  name: 'finviz_fundamental_search',
  description: FINVIZ_FUNDAMENTAL_SEARCH_DESCRIPTION,
  schema: FinvizInputSchema,
  func: async (input) => {
    try {
      const ticker = input.ticker.trim().toUpperCase();
      const metrics = await getFinvizSnapshot(ticker);

      return JSON.stringify({
        status: 'success',
        source: 'Finviz Scraper',
        url: `https://finviz.com/quote.ashx?t=${ticker}`,
        metrics
      }, null, 2);
    } catch (error) {
      logger.error(`[FinvizTool] Error for ${input.ticker}: ${error}`);
      return JSON.stringify({ error: String(error) });
    }
  },
});
