import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

// --- Input Schemas ---

const TickerInputSchema = z.object({
    ticker: z.string().describe("The stock ticker symbol. For Indian stocks on NSE, e.g., RELIANCE.NSE. For BSE, e.g. TCS.BSE."),
});

// --- Tools ---

export const getAlphaVantagePriceSnapshot = new DynamicStructuredTool({
    name: 'get_alpha_vantage_price_snapshot',
    description: `Fetches the latest real-time price snapshot for a stock using Alpha Vantage. Best for Indian stocks (NSE/BSE).`,
    schema: TickerInputSchema,
    func: async ({ ticker }) => {
        try {
            const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
            if (!apiKey) {
                throw new Error("ALPHA_VANTAGE_API_KEY is not set in .env");
            }

            // 1. Fetch Price (GLOBAL_QUOTE)
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
            const response = await fetch(url);
            const rawData = await response.json();

            // Check for API Error or Note (Rate Limit)
            if (rawData['Error Message']) throw new Error(rawData['Error Message']);
            if (rawData['Note']) throw new Error(`Alpha Vantage API Limit: ${rawData['Note']}`);

            const quote = rawData['Global Quote'];
            if (!quote || Object.keys(quote).length === 0) {
                return formatToolResult({ error: `No data found for ${ticker}. check validity.` }, []);
            }

            const data = {
                symbol: quote['01. symbol'],
                price: parseFloat(quote['05. price']),
                open: parseFloat(quote['02. open']),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                volume: parseInt(quote['06. volume']),
                latestTradingDay: quote['07. latest trading day'],
                previousClose: parseFloat(quote['08. previous close']),
                change: parseFloat(quote['09. change']),
                changePercent: quote['10. change percent'],
            };

            return formatToolResult(data, [`https://www.alphavantage.co`]);
        } catch (error) {
            return formatToolResult({ error: `Failed to fetch price for ${ticker}: ${error}` }, []);
        }
    },
});

// Alpha Vantage Fundamentals (Overview) - NOTE: This endpoint might be limited for non-US stocks on free tier
// But we will try it.
export const getAlphaVantageOverview = new DynamicStructuredTool({
    name: 'get_alpha_vantage_overview',
    description: `Fetches company overview and basic fundamentals for a stock using Alpha Vantage.`,
    schema: TickerInputSchema,
    func: async ({ ticker }) => {
        try {
            const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
            const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data['Error Message']) throw new Error(data['Error Message']);
            if (data['Note']) throw new Error(`Alpha Vantage API Limit: ${data['Note']}`);
            if (Object.keys(data).length === 0) {
                return formatToolResult({ error: `No overview data found for ${ticker}.` }, []);
            }

            return formatToolResult(data, [`https://www.alphavantage.co`]);
        } catch (error) {
            return formatToolResult({ error: `Failed to fetch overview for ${ticker}: ${error}` }, []);
        }
    },
});
