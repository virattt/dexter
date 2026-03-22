import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const AZURE_AI_SCOPE = 'https://ai.azure.com/.default';
const AZURE_COGNITIVE_SCOPE = 'https://cognitiveservices.azure.com/.default';
const AZURE_BASE_URL_ENV_VARS = ['AZURE_OPENAI_BASE_URL', 'OPENAI_BASE_URL'] as const;
const AZURE_SCOPE_ENV_VAR = 'AZURE_OPENAI_SCOPE';

type AzureTokenProvider = () => Promise<string>;

let cachedTokenProvider: AzureTokenProvider | null = null;
let cachedCredential: DefaultAzureCredential | null = null;
const tokenProviderByScope = new Map<string, AzureTokenProvider>();

/**
 * Normalize Azure OpenAI-compatible base URLs.
 * Users commonly paste full `/responses` URLs from Foundry; strip that suffix.
 */
export function normalizeAzureOpenAIBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error('[LLM] Azure base URL is empty');
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlash.replace(/\/responses$/i, '');
}

export function getAzureOpenAIBaseUrl(): string {
  for (const envVar of AZURE_BASE_URL_ENV_VARS) {
    const value = process.env[envVar];
    if (value && value.trim()) {
      return normalizeAzureOpenAIBaseUrl(value);
    }
  }

  throw new Error(
    '[LLM] AZURE_OPENAI_BASE_URL not found in environment variables (or fallback OPENAI_BASE_URL)',
  );
}

export function resolveAzureScope(baseUrl: string): string {
  const configuredScope = process.env[AZURE_SCOPE_ENV_VAR]?.trim();
  if (configuredScope) {
    return configuredScope;
  }

  try {
    const parsedUrl = new URL(baseUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    if (hostname.endsWith('.services.ai.azure.com') || pathname.includes('/api/projects/')) {
      return AZURE_AI_SCOPE;
    }
  } catch {
    // Fall back to Azure OpenAI default scope below.
  }

  return AZURE_COGNITIVE_SCOPE;
}

function getOrCreateTokenProvider(scope: string): AzureTokenProvider {
  const existing = tokenProviderByScope.get(scope);
  if (existing) {
    return existing;
  }

  if (!cachedCredential) {
    cachedCredential = new DefaultAzureCredential();
  }

  const created = getBearerTokenProvider(cachedCredential, scope);
  tokenProviderByScope.set(scope, created);
  return created;
}

export function getAzureAdTokenProvider(): AzureTokenProvider {
  if (!cachedTokenProvider) {
    cachedTokenProvider = async () => {
      const baseUrl = getAzureOpenAIBaseUrl();
      const scope = resolveAzureScope(baseUrl);
      const scopedProvider = getOrCreateTokenProvider(scope);
      try {
        return await scopedProvider();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[LLM] Failed to acquire Azure Entra token for scope ${scope}: ${message}`);
      }
    };
  }
  return cachedTokenProvider;
}
