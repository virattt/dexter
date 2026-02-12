import { describe, expect, it } from 'bun:test';
import { resolveWebSearchProvider } from './providers.js';

describe('resolveWebSearchProvider', () => {
  it('uses auto order when preferred provider is auto', () => {
    const resolved = resolveWebSearchProvider('auto', {
      EXASEARCH_API_KEY: '',
      LANGSEARCH_API_KEY: 'lang-key',
      TAVILY_API_KEY: 'tav-key',
    });

    expect(resolved).toBe('langsearch');
  });

  it('honors preferred provider when key exists', () => {
    const resolved = resolveWebSearchProvider('tavily', {
      EXASEARCH_API_KEY: 'exa-key',
      TAVILY_API_KEY: 'tav-key',
    });

    expect(resolved).toBe('tavily');
  });

  it('falls back to auto order when preferred provider key is missing', () => {
    const resolved = resolveWebSearchProvider('langsearch', {
      EXASEARCH_API_KEY: 'exa-key',
      LANGSEARCH_API_KEY: '',
    });

    expect(resolved).toBe('exa');
  });

  it('falls back to auto order for invalid setting', () => {
    const resolved = resolveWebSearchProvider('invalid-provider', {
      EXASEARCH_API_KEY: 'exa-key',
    });

    expect(resolved).toBe('exa');
  });
});
