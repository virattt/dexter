import { DEFAULT_MODEL } from '../model/llm.js';

export const DEFAULT_JUDGE_MODEL = 'claude-opus-4-8';
export const DEFAULT_EVAL_SEED = 'dexter-eval';
export const DEFAULT_EVAL_CONCURRENCY = 1;
export const DEFAULT_EVAL_TIMEOUT_MS = 10 * 60 * 1000;

export interface EvalOptions {
  model: string;
  judgeModel: string;
  sampleSize?: number;
  quick: boolean;
  seed: string;
  concurrency: number;
  timeoutMs: number;
  allowSelfJudge: boolean;
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseSampleSize(value: string): number {
  const sampleSize = Number(value);
  if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
    throw new Error(`Invalid sample size: ${value}`);
  }
  return sampleSize;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

export function parseEvalOptions(args: string[]): EvalOptions {
  const options: EvalOptions = {
    model: DEFAULT_MODEL,
    judgeModel: DEFAULT_JUDGE_MODEL,
    quick: false,
    seed: DEFAULT_EVAL_SEED,
    concurrency: DEFAULT_EVAL_CONCURRENCY,
    timeoutMs: DEFAULT_EVAL_TIMEOUT_MS,
    allowSelfJudge: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--sample':
        options.sampleSize = parseSampleSize(readFlagValue(args, i, arg));
        i++;
        break;
      case '--quick':
        options.quick = true;
        break;
      case '--model':
        options.model = readFlagValue(args, i, arg);
        i++;
        break;
      case '--judge-model':
        options.judgeModel = readFlagValue(args, i, arg);
        i++;
        break;
      case '--seed':
        options.seed = readFlagValue(args, i, arg);
        i++;
        break;
      case '--concurrency':
        options.concurrency = parsePositiveInteger(readFlagValue(args, i, arg), 'concurrency');
        i++;
        break;
      case '--timeout':
        options.timeoutMs = parsePositiveInteger(readFlagValue(args, i, arg), 'timeout') * 1000;
        i++;
        break;
      case '--allow-self-judge':
        options.allowSelfJudge = true;
        break;
      default:
        throw new Error(`Unknown eval argument: ${arg}`);
    }
  }

  if (options.quick && options.sampleSize !== undefined) {
    throw new Error('Use either --quick or --sample, not both');
  }

  if (!options.allowSelfJudge && options.model === options.judgeModel) {
    throw new Error('Target model and judge model must differ. Pass --allow-self-judge to override.');
  }

  return options;
}
