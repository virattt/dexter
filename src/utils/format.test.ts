import { describe, expect, test } from 'bun:test';
import { escapeTemplateVars, truncateAtWord, truncateEnd } from './format.js';

describe('format utils', () => {
  test('truncateAtWord preserves short strings', () => {
    expect(truncateAtWord('short text', 20)).toBe('short text');
  });

  test('truncateAtWord cuts at a nearby word boundary', () => {
    expect(truncateAtWord('alpha beta gamma', 12)).toBe('alpha beta...');
  });

  test('truncateAtWord hard-cuts when no useful word boundary exists', () => {
    expect(truncateAtWord('alphabetagamma', 8)).toBe('alphabet...');
  });

  test('truncateEnd cuts exactly at max length', () => {
    expect(truncateEnd('alpha beta gamma', 10)).toBe('alpha beta...');
  });

  test('escapeTemplateVars doubles curly braces for prompt templates', () => {
    expect(escapeTemplateVars('{"field": "{value}"}')).toBe('{{"field": "{{value}}"}}');
  });
});
