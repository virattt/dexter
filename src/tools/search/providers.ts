export type WebSearchProviderId = 'auto' | 'exa' | 'langsearch' | 'tavily';

export interface WebSearchProviderDef {
  id: Exclude<WebSearchProviderId, 'auto'>;
  displayName: string;
  apiKeyEnvVar: string;
}

export const WEB_SEARCH_PROVIDER_DEFS: readonly WebSearchProviderDef[] = [
  { id: 'langsearch', displayName: 'LangSearch', apiKeyEnvVar: 'LANGSEARCH_API_KEY' },
  { id: 'exa', displayName: 'Exa', apiKeyEnvVar: 'EXASEARCH_API_KEY' },
  { id: 'tavily', displayName: 'Tavily', apiKeyEnvVar: 'TAVILY_API_KEY' },
] as const;

// Keep existing behavior: Exa is default priority in auto mode.
export const AUTO_WEB_SEARCH_ORDER: readonly WebSearchProviderDef['id'][] = [
  'exa',
  'langsearch',
  'tavily',
] as const;

export function isWebSearchProviderId(value: string): value is WebSearchProviderId {
  return value === 'auto' || WEB_SEARCH_PROVIDER_DEFS.some((provider) => provider.id === value);
}

export function getWebSearchProviderDef(providerId: Exclude<WebSearchProviderId, 'auto'>): WebSearchProviderDef {
  const provider = WEB_SEARCH_PROVIDER_DEFS.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Unknown web search provider: ${providerId}`);
  }
  return provider;
}

export function getWebSearchProviderDisplayName(providerId: WebSearchProviderId): string {
  if (providerId === 'auto') return 'Auto';
  return getWebSearchProviderDef(providerId).displayName;
}

export function resolveWebSearchProvider(
  preferredProvider: string,
  env: NodeJS.ProcessEnv = process.env,
): Exclude<WebSearchProviderId, 'auto'> | null {
  const hasKey = (providerId: Exclude<WebSearchProviderId, 'auto'>): boolean => {
    const envKey = getWebSearchProviderDef(providerId).apiKeyEnvVar;
    return Boolean(env[envKey]?.trim());
  };

  if (isWebSearchProviderId(preferredProvider) && preferredProvider !== 'auto') {
    if (hasKey(preferredProvider)) {
      return preferredProvider;
    }
  }

  for (const providerId of AUTO_WEB_SEARCH_ORDER) {
    if (hasKey(providerId)) {
      return providerId;
    }
  }

  return null;
}
