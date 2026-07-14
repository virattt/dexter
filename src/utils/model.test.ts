import { describe, expect, test } from 'bun:test';
import { getProviderById } from '../providers.js';
import {
  getDefaultModelForProvider,
  getModelDisplayName,
  getModelIdsForProvider,
} from './model.js';

describe('OpenAI model catalog', () => {
  test('offers the GPT-5.6 family with Sol as the default', () => {
    expect(getModelIdsForProvider('openai')).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ]);
    expect(getDefaultModelForProvider('openai')).toBe('gpt-5.6-sol');
  });

  test('uses Luna for lightweight OpenAI calls', () => {
    expect(getProviderById('openai')?.fastModel).toBe('gpt-5.6-luna');
  });

  test('shows the GPT-5.6 tier names in the UI', () => {
    expect(getModelDisplayName('gpt-5.6-sol')).toBe('GPT 5.6 Sol');
    expect(getModelDisplayName('gpt-5.6-terra')).toBe('GPT 5.6 Terra');
    expect(getModelDisplayName('gpt-5.6-luna')).toBe('GPT 5.6 Luna');
  });
});

describe('Anthropic model catalog', () => {
  test('offers the current Claude family with Sonnet as the default', () => {
    expect(getModelIdsForProvider('anthropic')).toEqual([
      'claude-sonnet-4-6',
      'claude-opus-4-8',
      'claude-fable-5',
    ]);
    expect(getDefaultModelForProvider('anthropic')).toBe('claude-sonnet-4-6');
  });

  test('shows the Claude model names in the UI', () => {
    expect(getModelDisplayName('claude-sonnet-4-6')).toBe('Sonnet 4.6');
    expect(getModelDisplayName('claude-opus-4-8')).toBe('Opus 4.8');
    expect(getModelDisplayName('claude-fable-5')).toBe('Fable 5');
  });
});
