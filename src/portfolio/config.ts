import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { dexterPath } from '@/utils/paths';
import type { CronSchedule } from '@/cron/types';
import type { PortfolioConfig, PortfolioDefinition, PortfolioValidationResult } from './types';

const PORTFOLIO_CONFIG_PATH = dexterPath('portfolios.json');
const PORTFOLIO_CONFIG_EXAMPLE_PATH = dexterPath('portfolios.example.json');
const PORTFOLIO_RUNS_DIR = dexterPath('portfolio-runs');

const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('at'),
    at: z.string().min(1),
  }),
  z.object({
    kind: z.literal('every'),
    everyMs: z.number().min(60_000),
    anchorMs: z.number().optional(),
  }),
  z.object({
    kind: z.literal('cron'),
    expr: z.string().min(1),
    tz: z.string().optional(),
  }),
]);

const holdingSchema = z.object({
  ticker: z.string().min(1),
  weight: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const portfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  holdings: z.array(holdingSchema).min(1),
  benchmark: z.string().optional(),
  watchlist: z.array(z.string()).optional(),
  schedule: scheduleSchema.optional(),
  model: z.string().optional(),
  modelProvider: z.string().optional(),
});

const portfolioConfigSchema = z.object({
  version: z.literal(1),
  defaults: z.object({
    schedule: scheduleSchema.optional(),
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    benchmark: z.string().optional(),
  }).optional(),
  portfolios: z.array(portfolioSchema),
});

const DEFAULT_SCHEDULE: CronSchedule = {
  kind: 'cron',
  expr: '0 8 * * 1-5',
  tz: 'America/New_York',
};

function normalizePortfolio(portfolio: PortfolioDefinition): PortfolioDefinition {
  return {
    ...portfolio,
    holdings: portfolio.holdings.map((holding) => ({
      ...holding,
      ticker: holding.ticker.trim().toUpperCase(),
    })),
    watchlist: portfolio.watchlist?.map((ticker) => ticker.trim().toUpperCase()),
  };
}

export function getPortfolioConfigPath(): string {
  return PORTFOLIO_CONFIG_PATH;
}

export function getPortfolioConfigExamplePath(): string {
  return PORTFOLIO_CONFIG_EXAMPLE_PATH;
}

export function getPortfolioRunsDir(): string {
  return PORTFOLIO_RUNS_DIR;
}

export function loadPortfolioConfigRaw(): string | null {
  if (!existsSync(PORTFOLIO_CONFIG_PATH)) {
    return null;
  }

  return readFileSync(PORTFOLIO_CONFIG_PATH, 'utf8');
}

export function validatePortfolioConfig(raw?: string | null): PortfolioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const source = raw ?? loadPortfolioConfigRaw();

  if (source === null) {
    return {
      ok: false,
      errors: [
        `Portfolio config not found at ${PORTFOLIO_CONFIG_PATH}. Start from ${PORTFOLIO_CONFIG_EXAMPLE_PATH}.`,
      ],
      warnings,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(source);
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON in ${PORTFOLIO_CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }

  const parsed = portfolioConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`),
      warnings,
    };
  }

  const config: PortfolioConfig = {
    ...parsed.data,
    defaults: parsed.data.defaults
      ? {
          ...parsed.data.defaults,
          schedule: parsed.data.defaults.schedule ?? DEFAULT_SCHEDULE,
        }
      : {
          schedule: DEFAULT_SCHEDULE,
        },
    portfolios: parsed.data.portfolios.map((portfolio) => normalizePortfolio(portfolio)),
  };

  const seen = new Set<string>();
  for (const portfolio of config.portfolios) {
    if (seen.has(portfolio.id)) {
      errors.push(`Duplicate portfolio id: ${portfolio.id}`);
    }
    seen.add(portfolio.id);

    if (portfolio.enabled && portfolio.holdings.length === 0) {
      errors.push(`Enabled portfolio "${portfolio.id}" must have at least one holding.`);
    }

    if (portfolio.holdings.length !== new Set(portfolio.holdings.map((holding) => holding.ticker)).size) {
      warnings.push(`Portfolio "${portfolio.id}" contains duplicate holding tickers.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

export function loadPortfolioConfig(): PortfolioConfig {
  const validation = validatePortfolioConfig();
  if (!validation.ok || !validation.config) {
    throw new Error(validation.errors.join('\n'));
  }
  return validation.config;
}

export function getPortfolioById(config: PortfolioConfig, portfolioId: string): PortfolioDefinition | undefined {
  return config.portfolios.find((portfolio) => portfolio.id === portfolioId);
}

export function getEnabledPortfolios(config: PortfolioConfig): PortfolioDefinition[] {
  return config.portfolios.filter((portfolio) => portfolio.enabled);
}

export function getPortfolioSchedule(config: PortfolioConfig, portfolio: PortfolioDefinition): CronSchedule {
  return portfolio.schedule ?? config.defaults?.schedule ?? DEFAULT_SCHEDULE;
}

export function persistLatestPortfolioRun(portfolioId: string, result: unknown): string {
  const dir = `${PORTFOLIO_RUNS_DIR}/${portfolioId}`;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const outputPath = `${dir}/latest.json`;
  writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  return outputPath;
}

export function ensurePortfolioConfigDir(): void {
  const dir = dirname(PORTFOLIO_CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
