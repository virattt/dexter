export type FinanceProviderId = 'auto' | 'financialdatasets' | 'alphavantage';

export interface FinanceProviderDef {
  id: Exclude<FinanceProviderId, 'auto'>;
  displayName: string;
  apiKeyEnvVar: string;
}

export const FINANCE_PROVIDER_DEFS: readonly FinanceProviderDef[] = [
  {
    id: 'financialdatasets',
    displayName: 'Financial Datasets',
    apiKeyEnvVar: 'FINANCIAL_DATASETS_API_KEY',
  },
  {
    id: 'alphavantage',
    displayName: 'Alpha Vantage',
    apiKeyEnvVar: 'ALPHAVANTAGE_API_KEY',
  },
] as const;

// Keep existing behavior by prioritizing Financial Datasets in auto mode.
export const AUTO_FINANCE_ORDER: readonly FinanceProviderDef['id'][] = [
  'financialdatasets',
  'alphavantage',
] as const;

export function isFinanceProviderId(value: string): value is FinanceProviderId {
  return value === 'auto' || FINANCE_PROVIDER_DEFS.some((provider) => provider.id === value);
}

export function getFinanceProviderDef(providerId: Exclude<FinanceProviderId, 'auto'>): FinanceProviderDef {
  const provider = FINANCE_PROVIDER_DEFS.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Unknown finance provider: ${providerId}`);
  }
  return provider;
}

export function getFinanceProviderDisplayName(providerId: FinanceProviderId): string {
  if (providerId === 'auto') return 'Auto';
  return getFinanceProviderDef(providerId).displayName;
}

export function resolveFinanceProvider(
  preferredProvider: string,
  env: NodeJS.ProcessEnv = process.env,
): Exclude<FinanceProviderId, 'auto'> | null {
  const hasKey = (providerId: Exclude<FinanceProviderId, 'auto'>): boolean => {
    const envKey = getFinanceProviderDef(providerId).apiKeyEnvVar;
    return Boolean(env[envKey]?.trim());
  };

  if (isFinanceProviderId(preferredProvider) && preferredProvider !== 'auto') {
    if (hasKey(preferredProvider)) {
      return preferredProvider;
    }
  }

  for (const providerId of AUTO_FINANCE_ORDER) {
    if (hasKey(providerId)) {
      return providerId;
    }
  }

  return null;
}
