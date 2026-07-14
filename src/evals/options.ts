import { DEFAULT_MODEL } from '../model/llm.js';

export interface EvalOptions {
  model: string;
  judgeModel: string;
  sampleSize?: number;
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

export function parseEvalOptions(args: string[]): EvalOptions {
  const options: EvalOptions = {
    model: DEFAULT_MODEL,
    judgeModel: DEFAULT_MODEL,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--sample':
        options.sampleSize = parseSampleSize(readFlagValue(args, i, arg));
        i++;
        break;
      case '--model':
        options.model = readFlagValue(args, i, arg);
        i++;
        break;
      case '--judge-model':
        options.judgeModel = readFlagValue(args, i, arg);
        i++;
        break;
      default:
        throw new Error(`Unknown eval argument: ${arg}`);
    }
  }

  return options;
}
