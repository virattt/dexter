import { describe, expect, test } from 'bun:test';
import { getProviderById } from '../providers.js';
import {
  getDefaultModelForProvider,
  getModelDisplayName,
  getModelIdsForProvider,
} from './model.js';

describe('OpenAI model catalog', () => {
  test('offers the GPT-6 family with Astra as the default', () => {
    expect(getModelIdsForProvider('openai')).toEqual([
      'gpt-6-astra',
      'gpt-6-sol',
      'gpt-6-luna',
    ]);
    expect(getDefaultModelForProvider('openai')).toBe('gpt-6-astra');
  });

  test('uses Luna for lightweight OpenAI calls', () => {
    expect(getProviderById('openai')?.fastModel).toBe('gpt-6-luna');
  });

  test('shows the GPT-6 tier names in the UI', () => {
    expect(getModelDisplayName('gpt-6-astra')).toBe('GPT 6 Astra');
    expect(getModelDisplayName('gpt-6-sol')).toBe('GPT 6 Sol');
    expect(getModelDisplayName('gpt-6-luna')).toBe('GPT 6 Luna');
  });
});

describe('Anthropic model catalog', () => {
  test('offers the current Claude family with Sonnet as the default', () => {
    expect(getModelIdsForProvider('anthropic')).toEqual([
      'claude-sonnet-5',
      'claude-opus-5-5',
      'claude-fable-5-1',
    ]);
    expect(getDefaultModelForProvider('anthropic')).toBe('claude-sonnet-5');
  });

  test('shows the Claude model names in the UI', () => {
    expect(getModelDisplayName('claude-sonnet-5')).toBe('Sonnet 5');
    expect(getModelDisplayName('claude-opus-5-5')).toBe('Opus 5.5');
    expect(getModelDisplayName('claude-fable-5-1')).toBe('Fable 5.1');
  });
});

describe('MiniMax model catalog', () => {
  test('offers MiniMax M3 and M2.7 with M3 as the default', () => {
    expect(getModelIdsForProvider('minimax')).toEqual([
      'minimax:MiniMax-M3',
      'minimax:MiniMax-M2.7',
    ]);
    expect(getDefaultModelForProvider('minimax')).toBe('minimax:MiniMax-M3');
  });

  test('uses MiniMax M2.7 for lightweight calls', () => {
    expect(getProviderById('minimax')?.fastModel).toBe('minimax:MiniMax-M2.7');
  });

  test('shows the MiniMax model names in the UI', () => {
    expect(getModelDisplayName('minimax:MiniMax-M3')).toBe('MiniMax M3');
    expect(getModelDisplayName('minimax:MiniMax-M2.7')).toBe('MiniMax M2.7');
  });
});
