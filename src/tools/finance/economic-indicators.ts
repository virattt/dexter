import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/**
 * Transform economic indicator time series data
 */
function transformEconomicData(data: Record<string, unknown>): Record<string, unknown> {
  const dataPoints = data['data'] as Array<Record<string, string>> | undefined;

  return {
    name: data['name'],
    interval: data['interval'],
    unit: data['unit'],
    data: (dataPoints || []).map((point) => ({
      date: point['date'],
      value: parseFloat(point['value']),
    })),
  };
}

const IntervalSchema = z.object({
  interval: z
    .enum(['annual', 'quarterly', 'monthly'])
    .default('annual')
    .describe("Data frequency. Defaults to 'annual'."),
});

export const getRealGDP = new DynamicStructuredTool({
  name: 'get_real_gdp',
  description: `Retrieves US Real Gross Domestic Product data. GDP measures total economic output and is a key indicator of economic health. Returns historical data in billions of dollars.`,
  schema: IntervalSchema,
  func: async (input) => {
    const params = { interval: input.interval };
    const { data, url } = await callApi('REAL_GDP', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

export const getRealGDPPerCapita = new DynamicStructuredTool({
  name: 'get_real_gdp_per_capita',
  description: `Retrieves US Real GDP Per Capita data. GDP per capita divides total economic output by population, indicating average economic productivity and standard of living.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('REAL_GDP_PER_CAPITA', {});
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

const TreasuryYieldInputSchema = z.object({
  interval: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('monthly')
    .describe("Data frequency. Defaults to 'monthly'."),
  maturity: z
    .enum(['3month', '2year', '5year', '7year', '10year', '30year'])
    .default('10year')
    .describe("Treasury maturity period. Defaults to '10year'."),
});

export const getTreasuryYield = new DynamicStructuredTool({
  name: 'get_treasury_yield',
  description: `Retrieves US Treasury yield data for specified maturity periods (3mo to 30yr). Treasury yields are key interest rate benchmarks used for valuation, mortgage rates, and economic forecasting. The 10-year yield is particularly important for stock valuations.`,
  schema: TreasuryYieldInputSchema,
  func: async (input) => {
    const params = { interval: input.interval, maturity: input.maturity };
    const { data, url } = await callApi('TREASURY_YIELD', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

const FederalFundsRateInputSchema = z.object({
  interval: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('monthly')
    .describe("Data frequency. Defaults to 'monthly'."),
});

export const getFederalFundsRate = new DynamicStructuredTool({
  name: 'get_federal_funds_rate',
  description: `Retrieves the Federal Funds Rate - the interest rate at which banks lend to each other overnight. This is the primary tool the Federal Reserve uses to implement monetary policy and influences all other interest rates.`,
  schema: FederalFundsRateInputSchema,
  func: async (input) => {
    const params = { interval: input.interval };
    const { data, url } = await callApi('FEDERAL_FUNDS_RATE', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

const CPIInputSchema = z.object({
  interval: z
    .enum(['monthly', 'semiannual'])
    .default('monthly')
    .describe("Data frequency. Defaults to 'monthly'."),
});

export const getCPI = new DynamicStructuredTool({
  name: 'get_cpi',
  description: `Retrieves Consumer Price Index (CPI) data, measuring the average change in prices paid by urban consumers for goods and services. CPI is the primary measure of consumer inflation.`,
  schema: CPIInputSchema,
  func: async (input) => {
    const params = { interval: input.interval };
    const { data, url } = await callApi('CPI', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

export const getInflation = new DynamicStructuredTool({
  name: 'get_inflation',
  description: `Retrieves annual US inflation rates. Inflation measures the rate at which prices for goods and services rise over time, eroding purchasing power. Important for investment returns analysis and economic forecasting.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('INFLATION', {});
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

const RetailSalesInputSchema = z.object({
  interval: z
    .enum(['monthly', 'quarterly'])
    .optional()
    .describe("Data frequency."),
});

export const getRetailSales = new DynamicStructuredTool({
  name: 'get_retail_sales',
  description: `Retrieves US Advance Retail Sales data. Retail sales measure consumer spending at retail establishments and are a key indicator of consumer demand and economic activity.`,
  schema: RetailSalesInputSchema,
  func: async (input) => {
    const params: Record<string, string | undefined> = { interval: input.interval };
    const { data, url } = await callApi('RETAIL_SALES', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

const DurablesInputSchema = z.object({
  interval: z
    .enum(['monthly', 'quarterly'])
    .optional()
    .describe("Data frequency."),
});

export const getDurables = new DynamicStructuredTool({
  name: 'get_durables',
  description: `Retrieves US Manufacturers' New Orders for Durable Goods. Durable goods orders indicate business investment and future manufacturing activity. An important leading economic indicator.`,
  schema: DurablesInputSchema,
  func: async (input) => {
    const params: Record<string, string | undefined> = { interval: input.interval };
    const { data, url } = await callApi('DURABLES', params);
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

export const getUnemployment = new DynamicStructuredTool({
  name: 'get_unemployment',
  description: `Retrieves US unemployment rate data. The unemployment rate measures the percentage of the labor force that is jobless and actively seeking employment. A key indicator of labor market health.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('UNEMPLOYMENT', {});
    return formatToolResult(transformEconomicData(data), [url]);
  },
});

export const getNonfarmPayroll = new DynamicStructuredTool({
  name: 'get_nonfarm_payroll',
  description: `Retrieves US Nonfarm Payroll data. Nonfarm payrolls measure the number of jobs added or lost in the economy, excluding farm workers. Released monthly, this is one of the most closely watched economic indicators.`,
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('NONFARM_PAYROLL', {});
    return formatToolResult(transformEconomicData(data), [url]);
  },
});
