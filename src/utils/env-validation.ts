/**
 * Environment variable validation for Dexter startup.
 * Fails fast with clear messages when critical keys are missing.
 */

export type EnvValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const LLM_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'XAI_API_KEY', 'OPENROUTER_API_KEY', 'MOONSHOT_API_KEY', 'DEEPSEEK_API_KEY'];
const SEARCH_KEYS = ['EXASEARCH_API_KEY', 'TAVILY_API_KEY', 'PERPLEXITY_API_KEY'];

export function validateEnv(options?: { strict?: boolean }): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasLlmKey = LLM_KEYS.some((k) => {
    const v = process.env[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
  if (!hasLlmKey) {
    errors.push('Set OPENAI_API_KEY or ANTHROPIC_API_KEY (or another LLM key) for the agent.');
  }

  const fdKey = process.env.FINANCIAL_DATASETS_API_KEY;
  if (!fdKey || typeof fdKey !== 'string' || fdKey.trim().length === 0) {
    errors.push('Set FINANCIAL_DATASETS_API_KEY for market data.');
  }

  const hasSearchKey = SEARCH_KEYS.some((k) => {
    const v = process.env[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
  if (!hasSearchKey) {
    warnings.push('No web search key (EXASEARCH_API_KEY, TAVILY_API_KEY, or PERPLEXITY_API_KEY). Web search will be limited.');
  }

  const langsmithKey = process.env.LANGSMITH_API_KEY;
  if (!langsmithKey || langsmithKey.trim().length === 0) {
    warnings.push('LANGSMITH_API_KEY not set. Tracing disabled.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEnvOrExit(options?: { strict?: boolean }): void {
  const result = validateEnv(options);
  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[dexter] ${w}`);
    }
  }
  if (!result.ok) {
    console.error('[dexter] Configuration errors:');
    for (const e of result.errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
}
