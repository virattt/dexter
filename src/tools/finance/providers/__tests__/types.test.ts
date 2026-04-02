import { describe, test, expect } from 'vitest';
import type { FinancialSummaryRecord, CompanyInfo } from '../types.js';

describe('FinancialSummaryRecord', () => {
  test('allows null for J-Quants-only fields', () => {
    const record: FinancialSummaryRecord = {
      fiscalYearEnd: '2024-03-31',
      period: 'Annual',
      disclosureDate: null,
      netSales: 10000000,
      operatingProfit: 1000000,
      ordinaryProfit: null,
      netIncome: 800000,
      eps: 100.5,
      dividendPerShare: 30,
      forecastSales: null,
      forecastOperatingProfit: null,
      forecastNetIncome: null,
      totalAssets: 50000000,
      equity: 20000000,
      bps: 2500,
      equityToAssetRatio: 40.0,
      cashFlowsFromOperating: 1500000,
      cashFlowsFromInvesting: -500000,
      cashFlowsFromFinancing: -300000,
    };
    expect(record.ordinaryProfit).toBeNull();
    expect(record.forecastSales).toBeNull();
    expect(record.netSales).toBe(10000000);
  });

  test('CompanyInfo has correct market union type', () => {
    const prime: CompanyInfo = { code: '7203', name: 'トヨタ自動車', market: 'Prime' };
    const growth: CompanyInfo = { code: '1234', name: 'テスト株式会社', market: 'Growth' };
    expect(prime.market).toBe('Prime');
    expect(growth.market).toBe('Growth');
  });
});
