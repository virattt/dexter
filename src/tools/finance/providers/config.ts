import type { FinanceDataProviderId } from './types.js';

export type FinanceProviderMode =
  | { mode: 'auto' }
  | { mode: 'fixed'; provider: FinanceDataProviderId };

function normalizeProviderId(value: string): FinanceDataProviderId | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'financialdatasets' || v === 'financial_datasets' || v === 'financial-datasets') {
    return 'financialdatasets';
  }
  if (v === 'fmp' || v === 'financialmodelingprep' || v === 'financial_modeling_prep') return 'fmp';
  if (v === 'alphavantage' || v === 'alpha_vantage' || v === 'alpha-vantage') return 'alphavantage';
  return null;
}

/**
 * Select which finance data provider to use.
 * - Unset or "auto": try providers in fallback order per tool.
 * - Set to a provider id: only that provider is used.
 */
export function getFinanceProviderMode(): FinanceProviderMode {
  const raw = process.env.FINANCE_DATA_PROVIDER;
  if (!raw) return { mode: 'auto' };
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'auto') return { mode: 'auto' };

  const provider = normalizeProviderId(trimmed);
  if (!provider) return { mode: 'auto' };
  return { mode: 'fixed', provider };
}

