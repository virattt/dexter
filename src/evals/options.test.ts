import { describe, expect, test } from 'bun:test';
import { DEFAULT_MODEL } from '../model/llm.js';
import { parseEvalOptions } from './options.js';

describe('parseEvalOptions', () => {
  test('uses production defaults when no flags are provided', () => {
    expect(parseEvalOptions([])).toEqual({
      model: DEFAULT_MODEL,
      judgeModel: DEFAULT_MODEL,
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
    });
  });

  test('parses positive integer sample size', () => {
    expect(parseEvalOptions(['--sample', '10'])).toEqual({
      model: DEFAULT_MODEL,
      judgeModel: DEFAULT_MODEL,
      sampleSize: 10,
    });
  });

  test('rejects malformed arguments', () => {
    expect(() => parseEvalOptions(['--model'])).toThrow('Missing value for --model');
    expect(() => parseEvalOptions(['--judge-model', '--sample'])).toThrow(
      'Missing value for --judge-model',
    );
    expect(() => parseEvalOptions(['--sample', '0'])).toThrow('Invalid sample size: 0');
    expect(() => parseEvalOptions(['--sample', '1.5'])).toThrow('Invalid sample size: 1.5');
    expect(() => parseEvalOptions(['--unknown'])).toThrow('Unknown eval argument: --unknown');
  });
});
