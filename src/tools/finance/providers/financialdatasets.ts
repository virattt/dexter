import { callApi } from '../api.js';

type QueryParams = Record<string, string | number | string[] | undefined>;

export async function fdPriceSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/prices/snapshot/', { ticker });
  return { data: (data as Record<string, unknown>).snapshot ?? {}, url };
}

export async function fdPrices(params: {
  ticker: string;
  interval: string;
  interval_multiplier: number;
  start_date: string;
  end_date: string;
}, options?: { cacheable?: boolean }): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/prices/', params, options);
  return { data: (data as Record<string, unknown>).prices ?? [], url };
}

export async function fdCompanyFacts(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/company/facts', { ticker });
  return { data: (data as Record<string, unknown>).company_facts ?? {}, url };
}

export async function fdNews(params: {
  ticker: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/news/', params);
  return { data: (data as Record<string, unknown>).news ?? [], url };
}

export async function fdIncomeStatements(params: QueryParams): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financials/income-statements/', params);
  return { data: (data as Record<string, unknown>).income_statements ?? {}, url };
}

export async function fdBalanceSheets(params: QueryParams): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financials/balance-sheets/', params);
  return { data: (data as Record<string, unknown>).balance_sheets ?? {}, url };
}

export async function fdCashFlowStatements(params: QueryParams): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financials/cash-flow-statements/', params);
  return { data: (data as Record<string, unknown>).cash_flow_statements ?? {}, url };
}

export async function fdAllFinancialStatements(params: QueryParams): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financials/', params);
  return { data: (data as Record<string, unknown>).financials ?? {}, url };
}

export async function fdKeyRatiosSnapshot(ticker: string): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financial-metrics/snapshot/', { ticker });
  return { data: (data as Record<string, unknown>).snapshot ?? {}, url };
}

export async function fdKeyRatios(params: QueryParams): Promise<{ data: unknown; url: string }> {
  const { data, url } = await callApi('/financial-metrics/', params);
  return { data: (data as Record<string, unknown>).financial_metrics ?? [], url };
}
