import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Parse a number from Alpha Vantage response (handles 'None' and undefined)
 */
function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === 'None' || value === '-') {
    return null;
  }
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

/**
 * Transform Alpha Vantage OVERVIEW response to a consistent format
 */
function transformOverview(data: Record<string, unknown>): Record<string, unknown> {
  return {
    symbol: data['Symbol'],
    name: data['Name'],
    description: data['Description'],
    exchange: data['Exchange'],
    currency: data['Currency'],
    country: data['Country'],
    sector: data['Sector'],
    industry: data['Industry'],
    // Valuation Metrics
    marketCapitalization: parseNumber(data['MarketCapitalization']),
    peRatio: parseNumber(data['PERatio']),
    pegRatio: parseNumber(data['PEGRatio']),
    bookValue: parseNumber(data['BookValue']),
    priceToBookRatio: parseNumber(data['PriceToBookRatio']),
    priceToSalesRatioTTM: parseNumber(data['PriceToSalesRatioTTM']),
    evToRevenue: parseNumber(data['EVToRevenue']),
    evToEbitda: parseNumber(data['EVToEBITDA']),
    // Dividend Data
    dividendPerShare: parseNumber(data['DividendPerShare']),
    dividendYield: parseNumber(data['DividendYield']),
    dividendDate: data['DividendDate'],
    exDividendDate: data['ExDividendDate'],
    // Earnings & Profitability
    eps: parseNumber(data['EPS']),
    revenuePerShareTTM: parseNumber(data['RevenuePerShareTTM']),
    profitMargin: parseNumber(data['ProfitMargin']),
    operatingMarginTTM: parseNumber(data['OperatingMarginTTM']),
    returnOnAssetsTTM: parseNumber(data['ReturnOnAssetsTTM']),
    returnOnEquityTTM: parseNumber(data['ReturnOnEquityTTM']),
    // Financial Health
    revenueTTM: parseNumber(data['RevenueTTM']),
    grossProfitTTM: parseNumber(data['GrossProfitTTM']),
    ebitda: parseNumber(data['EBITDA']),
    quarterlyRevenueGrowthYOY: parseNumber(data['QuarterlyRevenueGrowthYOY']),
    quarterlyEarningsGrowthYOY: parseNumber(data['QuarterlyEarningsGrowthYOY']),
    // Analyst Data
    analystTargetPrice: parseNumber(data['AnalystTargetPrice']),
    analystRatingStrongBuy: parseNumber(data['AnalystRatingStrongBuy']),
    analystRatingBuy: parseNumber(data['AnalystRatingBuy']),
    analystRatingHold: parseNumber(data['AnalystRatingHold']),
    analystRatingSell: parseNumber(data['AnalystRatingSell']),
    analystRatingStrongSell: parseNumber(data['AnalystRatingStrongSell']),
    // Stock Data
    beta: parseNumber(data['Beta']),
    fiftyTwoWeekHigh: parseNumber(data['52WeekHigh']),
    fiftyTwoWeekLow: parseNumber(data['52WeekLow']),
    fiftyDayMovingAverage: parseNumber(data['50DayMovingAverage']),
    twoHundredDayMovingAverage: parseNumber(data['200DayMovingAverage']),
    sharesOutstanding: parseNumber(data['SharesOutstanding']),
    // Fiscal Information
    fiscalYearEnd: data['FiscalYearEnd'],
    latestQuarter: data['LatestQuarter'],
  };
}

const FinancialMetricsSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial metrics for. For example, 'AAPL' for Apple."
    ),
});

export const getFinancialMetricsSnapshot = new DynamicStructuredTool({
  name: 'get_financial_metrics_snapshot',
  description: `Fetches comprehensive company overview and financial metrics, including:
- Valuation metrics: P/E ratio, PEG ratio, price-to-book, market cap, EV/EBITDA
- Dividend data: dividend yield, dividend per share, ex-dividend date
- Profitability: profit margin, ROA, ROE, operating margin
- Growth: quarterly revenue growth, earnings growth
- Analyst data: target price, buy/sell/hold ratings
- Stock data: beta, 52-week high/low, moving averages
Useful for a comprehensive snapshot of a company's financial health and valuation.`,
  schema: FinancialMetricsSnapshotInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('OVERVIEW', params);
    return formatToolResult(transformOverview(data), [url]);
  },
});

const EarningsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch earnings for. For example, 'AAPL' for Apple."
    ),
});

export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description: `Retrieves quarterly and annual earnings data for a company, including reported EPS, estimated EPS, and surprise percentage. Useful for analyzing earnings performance and tracking earnings surprises.`,
  schema: EarningsInputSchema,
  func: async (input) => {
    const params = { symbol: input.ticker };
    const { data, url } = await callApi('EARNINGS', params);

    const result = {
      symbol: data['symbol'],
      annualEarnings: (data['annualEarnings'] as Array<Record<string, string>> || []).map((e) => ({
        fiscalDateEnding: e['fiscalDateEnding'],
        reportedEPS: parseNumber(e['reportedEPS']),
      })),
      quarterlyEarnings: (data['quarterlyEarnings'] as Array<Record<string, string>> || []).map((e) => ({
        fiscalDateEnding: e['fiscalDateEnding'],
        reportedDate: e['reportedDate'],
        reportedEPS: parseNumber(e['reportedEPS']),
        estimatedEPS: parseNumber(e['estimatedEPS']),
        surprise: parseNumber(e['surprise']),
        surprisePercentage: parseNumber(e['surprisePercentage']),
      })),
    };

    return formatToolResult(result, [url]);
  },
});
