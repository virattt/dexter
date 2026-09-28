import { describe, test, expect, mock, beforeEach } from 'bun:test';

const searchMock = mock(async (_params: Record<string, unknown>) => ({
  results: [
    { type: 'text', name: 'Apple Q3 results', url: 'https://example.com/aapl', content: 'Revenue rose.' },
    { type: 'text', name: 'Apple 10-Q', url: 'https://example.com/10q', content: 'Filing text.' },
  ],
}));

mock.module('linkup-sdk', () => ({
  LinkupClient: class {
    search = searchMock;
  },
}));

const { linkupSearch } = await import('./linkup.js');

describe('linkupSearch', () => {
  beforeEach(() => {
    searchMock.mockClear();
  });

  test('requests standard-depth search results and returns source URLs', async () => {
    const raw = await linkupSearch.invoke({ query: 'Apple earnings' });
    const result = JSON.parse(raw as string);

    expect(searchMock).toHaveBeenCalledWith({
      query: 'Apple earnings',
      depth: 'standard',
      outputType: 'searchResults',
      maxResults: 5,
    });
    expect(result.data.results).toHaveLength(2);
    expect(result.sourceUrls).toEqual(['https://example.com/aapl', 'https://example.com/10q']);
  });

  test('prefixes errors with the provider name', async () => {
    searchMock.mockImplementationOnce(async () => {
      throw new Error('Invalid API key');
    });

    await expect(linkupSearch.invoke({ query: 'Apple earnings' })).rejects.toThrow(
      '[Linkup API] Invalid API key',
    );
  });
});
