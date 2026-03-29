import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '@/model/llm';
import { resolveProvider, getProviderById } from '@/providers';
import { getSetting } from '@/utils/config';
import { checkApiKeyExistsForProvider } from '@/utils/env';
import { getDefaultModelForProvider } from '@/utils/model';
import { assertCodexCliReady } from '@/model/codex';
import type { PortfolioDefinition, EffectiveModelConfig } from './types';

export class PortfolioModelResolutionError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_PORTFOLIO_CONFIG'
      | 'INVALID_MODEL'
      | 'INVALID_PROVIDER'
      | 'INVALID_MODEL_PROVIDER_COMBINATION'
      | 'UNSUPPORTED_PROVIDER_FOR_PORTFOLIO_ANALYSIS'
      | 'MISSING_PROVIDER_CREDENTIALS'
      | 'PROVIDER_NOT_READY',
    message: string,
  ) {
    super(message);
  }
}

type ResolutionLayer = {
  source: EffectiveModelConfig['source'];
  model?: string;
  provider?: string;
};

function buildLayers(params: {
  cliModel?: string;
  cliProvider?: string;
  portfolio?: PortfolioDefinition;
  sourceOverride?: EffectiveModelConfig['source'];
}): ResolutionLayer[] {
  return [
    {
      source: params.sourceOverride ?? 'cli',
      model: params.cliModel,
      provider: params.cliProvider,
    },
    {
      source: 'portfolio',
      model: params.portfolio?.model,
      provider: params.portfolio?.modelProvider,
    },
    {
      source: 'global',
      model: getSetting('modelId', undefined as string | undefined),
      provider: getSetting('provider', undefined as string | undefined),
    },
    {
      source: 'default',
      model: DEFAULT_MODEL,
      provider: DEFAULT_PROVIDER,
    },
  ];
}

export function resolveEffectiveModel(params: {
  cliModel?: string;
  cliProvider?: string;
  portfolio?: PortfolioDefinition;
  sourceOverride?: EffectiveModelConfig['source'];
}): EffectiveModelConfig {
  for (const layer of buildLayers(params)) {
    if (!layer.model && !layer.provider) {
      continue;
    }

    let model = layer.model;
    let provider = layer.provider;

    if (model && !provider) {
      provider = resolveProvider(model).id;
    } else if (provider && !model) {
      model = getDefaultModelForProvider(provider);
      if (!model) {
        throw new PortfolioModelResolutionError(
          'INVALID_PROVIDER',
          `Provider "${provider}" does not have a default model configured.`,
        );
      }
    }

    if (!model || !provider) {
      continue;
    }

    const providerDef = getProviderById(provider);
    if (!providerDef) {
      throw new PortfolioModelResolutionError('INVALID_PROVIDER', `Unknown provider "${provider}".`);
    }

    const inferredProvider = resolveProvider(model).id;
    if (inferredProvider !== provider) {
      throw new PortfolioModelResolutionError(
        'INVALID_MODEL_PROVIDER_COMBINATION',
        `Model "${model}" is not compatible with provider "${provider}".`,
      );
    }

    if (provider === 'codex') {
      throw new PortfolioModelResolutionError(
        'UNSUPPORTED_PROVIDER_FOR_PORTFOLIO_ANALYSIS',
        'Portfolio analysis requires a tool-capable provider. Codex CLI is tool-free in Dexter.',
      );
    }

    return {
      model,
      provider,
      source: layer.source,
    };
  }

  throw new PortfolioModelResolutionError('INVALID_MODEL', 'Could not resolve an effective model.');
}

export async function assertPortfolioProviderReady(config: EffectiveModelConfig): Promise<void> {
  if (config.provider === 'codex') {
    await assertCodexCliReady();
    throw new PortfolioModelResolutionError(
      'UNSUPPORTED_PROVIDER_FOR_PORTFOLIO_ANALYSIS',
      'Portfolio analysis requires a tool-capable provider. Codex CLI is tool-free in Dexter.',
    );
  }

  const providerDef = getProviderById(config.provider);
  if (!providerDef) {
    throw new PortfolioModelResolutionError('INVALID_PROVIDER', `Unknown provider "${config.provider}".`);
  }

  if (providerDef.apiKeyEnvVar && !checkApiKeyExistsForProvider(config.provider)) {
    throw new PortfolioModelResolutionError(
      'MISSING_PROVIDER_CREDENTIALS',
      `${providerDef.displayName} is not configured. Set ${providerDef.apiKeyEnvVar} before running portfolio analysis.`,
    );
  }
}
