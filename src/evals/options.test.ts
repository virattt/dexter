import { describe, expect, test } from 'bun:test';
import { DEFAULT_MODEL } from '../model/llm.js';
import {
  DEFAULT_EVAL_CONCURRENCY,
  DEFAULT_EVAL_SEED,
  DEFAULT_EVAL_TIMEOUT_MS,
  DEFAULT_JUDGE_MODEL,
  parseEvalOptions,
} from './options.js';

describe('parseEvalOptions', () => {
  test('uses production defaults when no flags are provided', () => {
    expect(parseEvalOptions([])).toEqual({
      model: DEFAULT_MODEL,
      judgeModel: DEFAULT_JUDGE_MODEL,
      quick: false,
      seed: DEFAULT_EVAL_SEED,
      concurrency: DEFAULT_EVAL_CONCURRENCY,
      timeoutMs: DEFAULT_EVAL_TIMEOUT_MS,
      allowSelfJudge: false,
    });
  });

  test('parses independent target and judge models', () => {
    expect(parseEvalOptions([
      '--model',
      'claude-opus-4-8',
      '--judge-model',
      'gpt-5.6-luna',
    ])).toEqual({
      model: 'claude-opus-4-8',
      judgeModel: 'gpt-5.6-luna',
      quick: false,
      seed: DEFAULT_EVAL_SEED,
      concurrency: DEFAULT_EVAL_CONCURRENCY,
      timeoutMs: DEFAULT_EVAL_TIMEOUT_MS,
      allowSelfJudge: false,
    });
  });

  test('allows arbitrary routed model ids', () => {
    expect(parseEvalOptions([
      '--model',
      'openrouter:anthropic/claude-opus-4.1',
      '--judge-model',
      'ollama:llama3.3',
    ])).toEqual({
      model: 'openrouter:anthropic/claude-opus-4.1',
      judgeModel: 'ollama:llama3.3',
      quick: false,
      seed: DEFAULT_EVAL_SEED,
      concurrency: DEFAULT_EVAL_CONCURRENCY,
      timeoutMs: DEFAULT_EVAL_TIMEOUT_MS,
      allowSelfJudge: false,
    });
  });

  test('parses positive integer sample size', () => {
    expect(parseEvalOptions(['--sample', '10'])).toEqual({
      model: DEFAULT_MODEL,
      judgeModel: DEFAULT_JUDGE_MODEL,
      sampleSize: 10,
      quick: false,
      seed: DEFAULT_EVAL_SEED,
      concurrency: DEFAULT_EVAL_CONCURRENCY,
      timeoutMs: DEFAULT_EVAL_TIMEOUT_MS,
      allowSelfJudge: false,
    });
  });

  test('parses reproducibility and speed options', () => {
    expect(parseEvalOptions([
      '--quick',
      '--seed',
      'release-check',
      '--concurrency',
      '3',
      '--timeout',
      '120',
    ])).toEqual({
      model: DEFAULT_MODEL,
      judgeModel: DEFAULT_JUDGE_MODEL,
      quick: true,
      seed: 'release-check',
      concurrency: 3,
      timeoutMs: 120_000,
      allowSelfJudge: false,
    });
  });

  test('rejects accidental self-judging unless explicitly allowed', () => {
    expect(() => parseEvalOptions([
      '--model',
      'gpt-5.6-sol',
      '--judge-model',
      'gpt-5.6-sol',
    ])).toThrow('Target model and judge model must differ');

    expect(parseEvalOptions([
      '--model',
      'gpt-5.6-sol',
      '--judge-model',
      'gpt-5.6-sol',
      '--allow-self-judge',
    ])).toMatchObject({
      model: 'gpt-5.6-sol',
      judgeModel: 'gpt-5.6-sol',
      allowSelfJudge: true,
    });
  });

  test('rejects malformed arguments', () => {
    expect(() => parseEvalOptions(['--model'])).toThrow('Missing value for --model');
    expect(() => parseEvalOptions(['--judge-model', '--sample'])).toThrow(
      'Missing value for --judge-model',
    );
    expect(() => parseEvalOptions(['--sample', '0'])).toThrow('Invalid sample size: 0');
    expect(() => parseEvalOptions(['--sample', '1.5'])).toThrow('Invalid sample size: 1.5');
    expect(() => parseEvalOptions(['--quick', '--sample', '2'])).toThrow(
      'Use either --quick or --sample',
    );
    expect(() => parseEvalOptions(['--concurrency', '0'])).toThrow('Invalid concurrency: 0');
    expect(() => parseEvalOptions(['--timeout', '0'])).toThrow('Invalid timeout: 0');
    expect(() => parseEvalOptions(['--unknown'])).toThrow('Unknown eval argument: --unknown');
  });
});
