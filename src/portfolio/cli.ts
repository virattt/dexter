import { loadCronStore, saveCronStore } from '@/cron/store';
import { computeNextRunAtMs } from '@/cron/schedule';
import type { CronJob } from '@/cron/types';
import { validatePortfolioConfig, getPortfolioById, getEnabledPortfolios, getPortfolioSchedule } from './config';
import { resolveEffectiveModel, PortfolioModelResolutionError } from './model-resolution';
import { runPortfolioAnalysis } from './runner';
import type { PortfolioAnalysisResult, PortfolioDefinition } from './types';

type PortfolioCommandResult = {
  exitCode: number;
  payload: unknown;
};

function parseCommonFlags(args: string[]): { model?: string; provider?: string; json: boolean; rest: string[] } {
  const rest: string[] = [];
  let model: string | undefined;
  let provider: string | undefined;
  let json = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--model') {
      model = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--provider') {
      provider = args[i + 1];
      i += 1;
      continue;
    }
    rest.push(arg);
  }

  return { model, provider, json, rest };
}

function portfolioJobName(portfolio: PortfolioDefinition): string {
  return `Portfolio: ${portfolio.name}`;
}

function serializeError(
  code: string,
  message: string,
  details?: unknown,
): { ok: false; error: { code: string; message: string; details?: unknown } } {
  return {
    ok: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
}

function success(payload: unknown, exitCode = 0): PortfolioCommandResult {
  return { exitCode, payload };
}

function failure(code: string, message: string, exitCode: number, details?: unknown): PortfolioCommandResult {
  return { exitCode, payload: serializeError(code, message, details) };
}

async function runPortfolio(portfolio: PortfolioDefinition, args: { model?: string; provider?: string }, trigger: PortfolioAnalysisResult['trigger']) {
  const modelConfig = resolveEffectiveModel({
    cliModel: args.model,
    cliProvider: args.provider,
    portfolio,
  });
  return runPortfolioAnalysis({
    portfolio,
    modelConfig,
    trigger,
  });
}

function loadValidatedConfig() {
  const validation = validatePortfolioConfig();
  if (!validation.ok || !validation.config) {
    throw new PortfolioModelResolutionError(
      'INVALID_PORTFOLIO_CONFIG',
      validation.errors.join('\n') || 'Portfolio config is invalid.',
    );
  }
  return validation.config;
}

export async function runPortfolioCommand(rawArgs: string[]): Promise<PortfolioCommandResult> {
  const { model, provider, json, rest } = parseCommonFlags(rawArgs);
  const subcommand = rest[0];

  if (!json) {
    return failure('JSON_REQUIRED', 'Portfolio commands require --json in v1.', 2);
  }

  try {
    switch (subcommand) {
      case 'validate': {
        const validation = validatePortfolioConfig();
        return success(validation, validation.ok ? 0 : 2);
      }

      case 'list': {
        const config = loadValidatedConfig();
        return success({
          ok: true,
          portfolios: config.portfolios.map((portfolio) => ({
            id: portfolio.id,
            name: portfolio.name,
            enabled: portfolio.enabled,
            holdings_count: portfolio.holdings.length,
            configured_model: portfolio.model,
            configured_provider: portfolio.modelProvider,
          })),
        });
      }

      case 'run': {
        const portfolioId = rest[1];
        if (!portfolioId) {
          return failure('MISSING_PORTFOLIO_ID', 'Portfolio id is required for run.', 2);
        }

        const config = loadValidatedConfig();
        const portfolio = getPortfolioById(config, portfolioId);
        if (!portfolio) {
          return failure('UNKNOWN_PORTFOLIO', `Unknown portfolio "${portfolioId}".`, 2);
        }

        const result = await runPortfolio(portfolio, { model, provider }, 'manual');
        return success(result, result.ok ? 0 : 4);
      }

      case 'run-all': {
        const config = loadValidatedConfig();
        const portfolios = getEnabledPortfolios(config);
        const results: PortfolioAnalysisResult[] = [];
        for (const portfolio of portfolios) {
          results.push(await runPortfolio(portfolio, { model, provider }, 'manual'));
        }

        return success({
          ok: results.every((result) => result.ok),
          generated_at: new Date().toISOString(),
          results,
        }, results.every((result) => result.ok) ? 0 : 4);
      }

      case 'sync-jobs': {
        const config = loadValidatedConfig();
        const portfolios = getEnabledPortfolios(config);
        const store = loadCronStore();
        const created: string[] = [];
        const updated: string[] = [];
        const disabled: string[] = [];

        const enabledIds = new Set(portfolios.map((portfolio) => portfolio.id));

        for (const job of store.jobs) {
          if (job.payload.kind === 'portfolio' && !enabledIds.has(job.payload.portfolioId ?? '')) {
            job.enabled = false;
            job.state.nextRunAtMs = undefined;
            job.updatedAtMs = Date.now();
            disabled.push(job.id);
          }
        }

        for (const portfolio of portfolios) {
          const modelConfig = resolveEffectiveModel({
            cliModel: model,
            cliProvider: provider,
            portfolio,
          });

          const schedule = getPortfolioSchedule(config, portfolio);
          const nextRunAtMs = computeNextRunAtMs(schedule, Date.now());
          const existing = store.jobs.find((job) => job.payload.kind === 'portfolio' && job.payload.portfolioId === portfolio.id);

          if (existing) {
            existing.name = portfolioJobName(portfolio);
            existing.enabled = true;
            existing.schedule = schedule;
            existing.payload = {
              kind: 'portfolio',
              portfolioId: portfolio.id,
              model: modelConfig.model,
              modelProvider: modelConfig.provider,
            };
            existing.state.nextRunAtMs = nextRunAtMs;
            existing.updatedAtMs = Date.now();
            updated.push(existing.id);
          } else {
            const id = `${Date.now().toString(36)}-${portfolio.id}`;
            const job: CronJob = {
              id,
              name: portfolioJobName(portfolio),
              description: `Daily analysis for portfolio ${portfolio.id}`,
              enabled: true,
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
              schedule,
              payload: {
                kind: 'portfolio',
                portfolioId: portfolio.id,
                model: modelConfig.model,
                modelProvider: modelConfig.provider,
              },
              fulfillment: 'keep',
              state: {
                nextRunAtMs,
                consecutiveErrors: 0,
                scheduleErrorCount: 0,
              },
            };
            store.jobs.push(job);
            created.push(job.id);
          }
        }

        saveCronStore(store);
        return success({
          ok: true,
          created,
          updated,
          disabled,
          jobs: store.jobs
            .filter((job) => job.payload.kind === 'portfolio')
            .map((job) => ({
              id: job.id,
              portfolioId: job.payload.portfolioId,
              name: job.name,
              enabled: job.enabled,
              nextRunAtMs: job.state.nextRunAtMs,
              model: job.payload.model,
              provider: job.payload.modelProvider,
            })),
        });
      }

      case 'run-job': {
        const jobId = rest[1];
        if (!jobId) {
          return failure('MISSING_JOB_ID', 'Job id is required for run-job.', 2);
        }

        const store = loadCronStore();
        const job = store.jobs.find((entry) => entry.id === jobId);
        if (!job || job.payload.kind !== 'portfolio' || !job.payload.portfolioId) {
          return failure('UNKNOWN_JOB', `Unknown portfolio job "${jobId}".`, 2);
        }

        const config = loadValidatedConfig();
        const portfolio = getPortfolioById(config, job.payload.portfolioId);
        if (!portfolio) {
          return failure('UNKNOWN_PORTFOLIO', `Portfolio "${job.payload.portfolioId}" no longer exists.`, 2);
        }

        const result = await runPortfolio(portfolio, {
          model: model ?? job.payload.model,
          provider: provider ?? job.payload.modelProvider,
        }, 'manual-job');
        return success(result, result.ok ? 0 : 4);
      }

      default:
        return failure(
          'UNKNOWN_SUBCOMMAND',
          'Unknown portfolio subcommand. Use validate, list, run, run-all, sync-jobs, or run-job.',
          2,
        );
    }
  } catch (error) {
    if (error instanceof PortfolioModelResolutionError) {
      const exitCode = error.code === 'MISSING_PROVIDER_CREDENTIALS' || error.code === 'PROVIDER_NOT_READY' ? 3 : 2;
      return failure(error.code, error.message, exitCode);
    }

    return failure('PORTFOLIO_COMMAND_ERROR', error instanceof Error ? error.message : String(error), 4);
  }
}
