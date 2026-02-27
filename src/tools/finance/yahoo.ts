import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

// --- Helper Types ---

interface PriceData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    date: string;
}

// --- Schema definitions ---

const TickerInputSchema = z.object({
    ticker: z.string().describe("The stock ticker symbol. For Indian stocks on NSE, append '.NS' (e.g., RELIANCE.NS). For BSE, append '.BO' (e.g. TCS.BO)."),
});

// --- Tools ---

export const getYahooPriceSnapshot = new DynamicStructuredTool({
    name: 'get_yahoo_price_snapshot',
    description: `Fetches the latest real-time price snapshot for a stock using Yahoo Finance. Best for Indian stocks (NSE/BSE).`,
    schema: TickerInputSchema,
    func: async ({ ticker }) => {
        try {
            const quote = await yahooFinance.quote(ticker) as any;
            const data = {
                symbol: quote.symbol,
                price: quote.regularMarketPrice,
                currency: quote.currency,
                exchange: quote.exchange,
                open: quote.regularMarketOpen,
                high: quote.regularMarketDayHigh,
                low: quote.regularMarketDayLow,
                previousClose: quote.regularMarketPreviousClose,
                volume: quote.regularMarketVolume,
                marketCap: quote.marketCap,
                timestamp: new Date().toISOString()
            };
            return formatToolResult(data, [`https://finance.yahoo.com/quote/${ticker}`]);
        } catch (error) {
            return formatToolResult({ error: `Failed to fetch price for ${ticker}: ${error}` }, []);
        }
    },
});

export const getYahooFundamentals = new DynamicStructuredTool({
    name: 'get_yahoo_fundamentals',
    description: `Fetches fundamental financial data (income statement, balance sheet, cash flow) for a stock using Yahoo Finance.`,
    schema: TickerInputSchema,
    func: async ({ ticker }) => {
        try {
            // Fetching incomplete modules for brevity; can expand based on need
            const queryOptions = { modules: ['financialData', 'defaultKeyStatistics', 'balanceSheetHistory', 'incomeStatementHistory', 'cashflowStatementHistory'] };
            const result = await yahooFinance.quoteSummary(ticker, queryOptions as any) as any;

            const data = {
                valuation: result.defaultKeyStatistics,
                financials: result.financialData,
                balanceSheet: result.balanceSheetHistory,
                incomeStatement: result.incomeStatementHistory,
                cashFlow: result.cashflowStatementHistory
            };

            return formatToolResult(data, [`https://finance.yahoo.com/quote/${ticker}/financials`]);
        } catch (error) {
            return formatToolResult({ error: `Failed to fetch fundamentals for ${ticker}: ${error}` }, []);
        }
    },
});

export const getYahooNews = new DynamicStructuredTool({
    name: 'get_yahoo_news',
    description: `Fetches latest news for a specific stock ticker using Yahoo Finance.`,
    schema: TickerInputSchema,
    func: async ({ ticker }) => {
        try {
            const news = await yahooFinance.search(ticker, { newsCount: 5 }) as any;
            const newsItems = news.news.map((item: any) => ({
                title: item.title,
                link: item.link,
                publisher: item.publisher,
                providerPublishTime: item.providerPublishTime,
                type: item.type
            }));

            const urls = newsItems.map((n: any) => n.link).filter((l: string) => l);
            return formatToolResult({ news: newsItems }, urls);
        } catch (error) {
            return formatToolResult({ error: `Failed to fetch news for ${ticker}: ${error}` }, []);
        }
    },
});
