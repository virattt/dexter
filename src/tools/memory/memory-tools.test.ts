import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { MemoryManager } from '../../memory/index.js';
import { memoryGetTool } from './memory-get.js';
import { memorySearchTool } from './memory-search.js';
import { memoryUpdateTool } from './memory-update.js';
import { recallFinancialContextTool } from './financial-recall.js';
import { storeFinancialInsightTool } from './financial-store.js';

/** formatToolResult wraps data as { data: ... } — unwrap for assertions */
function parseResult(result: string): unknown {
  return (JSON.parse(result) as { data: unknown }).data;
}

// ---------------------------------------------------------------------------
// Shared spy lifecycle
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let managerSpy: ReturnType<typeof spyOn<any, any>>;

afterEach(() => {
  managerSpy?.mockRestore();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupManager(partial: Record<string, unknown>): void {
  managerSpy = spyOn(MemoryManager, 'get').mockResolvedValue(partial as never);
}

// ---------------------------------------------------------------------------
// memory_get
// ---------------------------------------------------------------------------

describe('memory_get', () => {
  it('reads a memory file by path', async () => {
    const mockGet = mock(async () => ({ path: 'MEMORY.md', content: 'Hello\nWorld', totalLines: 2 }));
    setupManager({ get: mockGet });

    const result = parseResult(await memoryGetTool.invoke({ path: 'MEMORY.md' }));
    expect((result as { path: string }).path).toBe('MEMORY.md');
  });

  it('passes from and lines through to manager.get', async () => {
    const mockGet = mock(async () => ({ path: 'MEMORY.md', content: 'line 5', totalLines: 50 }));
    setupManager({ get: mockGet });

    await memoryGetTool.invoke({ path: 'MEMORY.md', from: 5, lines: 2 });

    expect(mockGet.mock.calls[0][0]).toEqual({ path: 'MEMORY.md', from: 5, lines: 2 });
  });

  it('reads a daily log file', async () => {
    const mockGet = mock(async () => ({ path: '2026-01-01.md', content: 'daily note', totalLines: 1 }));
    setupManager({ get: mockGet });

    await memoryGetTool.invoke({ path: '2026-01-01.md' });
    expect(mockGet.mock.calls[0][0].path).toBe('2026-01-01.md');
  });
});

// ---------------------------------------------------------------------------
// memory_search
// ---------------------------------------------------------------------------

describe('memory_search', () => {
  it('returns search results when memory is available', async () => {
    const mockSearch = mock(async () => [{ score: 0.9, content: 'Found memory' }]);
    setupManager({ isAvailable: () => true, search: mockSearch });

    const result = parseResult(await memorySearchTool.invoke({ query: 'test query' })) as {
      results: Array<{ content: string }>;
    };
    expect(result.results).toHaveLength(1);
    expect(result.results[0].content).toBe('Found memory');
  });

  it('calls search with the exact query string', async () => {
    const mockSearch = mock(async () => []);
    setupManager({ isAvailable: () => true, search: mockSearch });

    await memorySearchTool.invoke({ query: 'my specific query' });
    expect(mockSearch.mock.calls[0][0]).toBe('my specific query');
  });

  it('returns disabled error when memory is unavailable', async () => {
    setupManager({
      isAvailable: () => false,
      getUnavailableReason: () => 'Memory is disabled in settings.',
    });

    const result = parseResult(await memorySearchTool.invoke({ query: 'test' })) as {
      disabled: boolean;
      error: string;
    };
    expect(result.disabled).toBe(true);
    expect(result.error).toBe('Memory is disabled in settings.');
  });

  it('uses fallback error message when getUnavailableReason returns null', async () => {
    setupManager({ isAvailable: () => false, getUnavailableReason: () => null });

    const result = parseResult(await memorySearchTool.invoke({ query: 'test' })) as {
      disabled: boolean;
      error: string;
    };
    expect(result.disabled).toBe(true);
    expect(result.error).toBe('Memory search unavailable.');
  });

  it('returns empty results array when no matches found', async () => {
    setupManager({ isAvailable: () => true, search: mock(async () => []) });

    const result = parseResult(await memorySearchTool.invoke({ query: 'obscure' })) as {
      results: unknown[];
    };
    expect(result.results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// memory_update — append
// ---------------------------------------------------------------------------

describe('memory_update — append', () => {
  let mockAppend: ReturnType<typeof mock>;

  beforeEach(() => {
    mockAppend = mock(async () => {});
    setupManager({ appendMemory: mockAppend });
  });

  it('appends content and resolves long_term to MEMORY.md', async () => {
    const result = parseResult(
      await memoryUpdateTool.invoke({ content: 'Test content', action: 'append', file: 'long_term' }),
    ) as { success: boolean; file: string };

    expect(result.success).toBe(true);
    expect(result.file).toBe('MEMORY.md');
    expect(mockAppend.mock.calls[0]).toEqual(['long_term', 'Test content']);
  });

  it('resolves daily to today YYYY-MM-DD.md', async () => {
    const result = parseResult(
      await memoryUpdateTool.invoke({ content: 'Daily note', action: 'append', file: 'daily' }),
    ) as { success: boolean; file: string };

    const today = new Date().toISOString().slice(0, 10);
    expect(result.success).toBe(true);
    expect(result.file).toBe(`${today}.md`);
  });

  it('passes through custom filename unchanged', async () => {
    const result = parseResult(
      await memoryUpdateTool.invoke({ content: 'x', action: 'append', file: '2025-01-01.md' }),
    ) as { file: string };

    expect(result.file).toBe('2025-01-01.md');
  });

  it('returns error when content is missing', async () => {
    const result = parseResult(
      await memoryUpdateTool.invoke({ action: 'append', file: 'long_term' }),
    ) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('"content" is required');
  });

  it('reports correct character count in message', async () => {
    const content = 'Hello World';
    const result = parseResult(
      await memoryUpdateTool.invoke({ content, action: 'append', file: 'long_term' }),
    ) as { message: string };

    expect(result.message).toContain(`${content.length} characters`);
  });
});

// ---------------------------------------------------------------------------
// memory_update — edit
// ---------------------------------------------------------------------------

describe('memory_update — edit', () => {
  it('edits memory and returns success', async () => {
    const mockEdit = mock(async () => true);
    setupManager({ editMemory: mockEdit });

    const result = parseResult(
      await memoryUpdateTool.invoke({
        action: 'edit',
        file: 'long_term',
        old_text: 'old value',
        new_text: 'new value',
      }),
    ) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockEdit.mock.calls[0]).toEqual(['long_term', 'old value', 'new value']);
  });

  it('returns error when text is not found', async () => {
    setupManager({ editMemory: mock(async () => false) });

    const result = parseResult(
      await memoryUpdateTool.invoke({
        action: 'edit',
        file: 'long_term',
        old_text: 'nonexistent',
        new_text: 'replacement',
      }),
    ) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not find');
  });

  it('returns error when old_text or new_text is missing', async () => {
    setupManager({ editMemory: mock(async () => true) });

    const result = parseResult(
      await memoryUpdateTool.invoke({ action: 'edit', file: 'long_term' }),
    ) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('"old_text" and "new_text" are required');
  });
});

// ---------------------------------------------------------------------------
// memory_update — delete
// ---------------------------------------------------------------------------

describe('memory_update — delete', () => {
  it('deletes memory entry and returns success', async () => {
    const mockDelete = mock(async () => true);
    setupManager({ deleteMemory: mockDelete });

    const result = parseResult(
      await memoryUpdateTool.invoke({ action: 'delete', file: 'long_term', old_text: 'Remove me' }),
    ) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockDelete.mock.calls[0]).toEqual(['long_term', 'Remove me']);
  });

  it('returns error when text is not found', async () => {
    setupManager({ deleteMemory: mock(async () => false) });

    const result = parseResult(
      await memoryUpdateTool.invoke({ action: 'delete', file: 'long_term', old_text: 'ghost text' }),
    ) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not find');
  });

  it('returns error when old_text is missing', async () => {
    setupManager({ deleteMemory: mock(async () => true) });

    const result = parseResult(
      await memoryUpdateTool.invoke({ action: 'delete', file: 'long_term' }),
    ) as { success: boolean; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('"old_text" is required');
  });
});

// ---------------------------------------------------------------------------
// recall_financial_context
// ---------------------------------------------------------------------------

describe('recall_financial_context', () => {
  it('returns unavailable message when financial store is null', async () => {
    setupManager({ getFinancialStore: () => null });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toBe('Financial memory not available.');
  });

  it('returns no-context message when no insights found', async () => {
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [],
        search: () => [],
        getRouting: () => null,
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('No prior financial context found for AAPL');
  });

  it('includes namespace in no-context message', async () => {
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [],
        search: () => [],
        getRouting: () => null,
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL', namespace: 'dcf' });
    expect(result).toContain('No prior financial context found for AAPL [ns:dcf]');
  });

  it('returns insights when byTicker finds results', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'Great company', tags: ['analysis:thesis'], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => null,
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('Great company');
    expect(result).toContain('Stored insights for AAPL');
    expect(result).toContain('1 found');
  });

  it('includes routing hint when routing is set', async () => {
    const insight = { id: 1, ticker: 'VWS.CO', content: 'Wind energy', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => 'fmp-premium',
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'VWS.CO' });
    expect(result).toContain('**Routing:** fmp-premium');
    expect(result).toContain('skip FMP');
  });

  it('merges byTicker and byQuery results, deduplicating by id', async () => {
    const shared = { id: 1, ticker: 'AAPL', content: 'Shared insight', tags: [], updatedAt: Date.now() };
    const unique = { id: 2, ticker: 'AAPL', content: 'Query-only insight', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [shared],
        search: () => [shared, unique],
        getRouting: () => null,
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL', query: 'analysis' });
    expect(result).toContain('2 found');
  });

  it('includes related insights in output', async () => {
    const related = {
      relation: 'peer',
      insight: { ticker: 'MSFT', content: 'Related company insight', tags: [] },
    };
    const insight = { id: 1, ticker: 'AAPL', content: 'Main insight', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => null,
        getRelatedInsights: () => [related],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('↳ peer: MSFT');
  });

  it('includes namespace in result header', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'DCF analysis', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => null,
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL', namespace: 'dcf' });
    expect(result).toContain('[ns:dcf]');
  });

  // routingHint branches
  it('routingHint fmp-ok → FMP free tier works', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'test', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => 'fmp-ok',
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('FMP free tier works');
  });

  it('routingHint yahoo-ok → Yahoo Finance works', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'test', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => 'yahoo-ok',
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('Yahoo Finance works');
  });

  it('routingHint web-fallback → all APIs failed', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'test', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => 'web-fallback',
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('all APIs failed');
  });

  it('routingHint unknown value → returns routing string as-is', async () => {
    const insight = { id: 1, ticker: 'AAPL', content: 'test', tags: [], updatedAt: Date.now() };
    setupManager({
      getFinancialStore: () => ({
        recallByTicker: () => [insight],
        search: () => [],
        getRouting: () => 'custom-source',
        getRelatedInsights: () => [],
      }),
    });

    const result = await recallFinancialContextTool.invoke({ ticker: 'AAPL' });
    expect(result).toContain('custom-source');
  });
});

// ---------------------------------------------------------------------------
// store_financial_insight
// ---------------------------------------------------------------------------

describe('store_financial_insight', () => {
  it('returns unavailable message when financial store is null', async () => {
    setupManager({ getFinancialStore: () => null });

    const result = await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'Great company' });
    expect(result).toBe('Financial memory not available — insight not stored.');
  });

  it('stores insight and returns confirmation with id', async () => {
    const mockStore = mock(async () => 42);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    const result = await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'Great company' });
    expect(result).toContain('Stored insight #42 for AAPL');
  });

  it('automatically adds ticker tag (uppercased)', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({ ticker: 'aapl', content: 'test' });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('ticker:AAPL');
  });

  it('does not duplicate ticker tag if already present', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'test', tags: ['ticker:AAPL'] });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags.filter((t) => t === 'ticker:AAPL').length).toBe(1);
  });

  it('adds routing tag and writes to FINANCE.md', async () => {
    const mockStore = mock(async () => 1);
    const mockAppend = mock(async () => {});
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mockAppend,
    });

    await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'test', routing: 'fmp-ok' });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('routing:fmp-ok');
    expect(mockAppend.mock.calls[0][0]).toBe('FINANCE.md');
    expect(mockAppend.mock.calls[0][1]).toContain('AAPL');
  });

  it('does not duplicate routing tag if already in tags', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({
      ticker: 'AAPL',
      content: 'test',
      routing: 'fmp-ok',
      tags: ['routing:fmp-ok'],
    });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags.filter((t) => t.startsWith('routing:')).length).toBe(1);
  });

  it('adds sector tag (lowercased)', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'test', sector: 'Technology' });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('sector:technology');
  });

  it('adds exchange tag (uppercased)', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({ ticker: 'VWS.CO', content: 'test', exchange: 'cph' });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('exchange:CPH');
  });

  it('adds namespace tag', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'test', namespace: 'dcf' });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('ns:dcf');
  });

  it('includes namespace in return string', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    const result = await storeFinancialInsightTool.invoke({
      ticker: 'AAPL',
      content: 'test',
      namespace: 'dcf',
    });
    expect(result).toContain('[ns:dcf]');
  });

  it('does not write to FINANCE.md when routing is not provided', async () => {
    const mockAppend = mock(async () => {});
    setupManager({
      getFinancialStore: () => ({ storeInsight: mock(async () => 1) }),
      appendMemory: mockAppend,
    });

    await storeFinancialInsightTool.invoke({ ticker: 'AAPL', content: 'test' });
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it('includes exchange in FINANCE.md entry', async () => {
    const mockAppend = mock(async () => {});
    setupManager({
      getFinancialStore: () => ({ storeInsight: mock(async () => 1) }),
      appendMemory: mockAppend,
    });

    await storeFinancialInsightTool.invoke({
      ticker: 'VWS.CO',
      content: 'Routing note',
      routing: 'fmp-premium',
      exchange: 'CPH',
    });
    expect(mockAppend.mock.calls[0][1]).toContain('(CPH)');
  });

  it('includes all passed tags alongside auto-generated ones', async () => {
    const mockStore = mock(async () => 1);
    setupManager({
      getFinancialStore: () => ({ storeInsight: mockStore }),
      appendMemory: mock(async () => {}),
    });

    await storeFinancialInsightTool.invoke({
      ticker: 'AAPL',
      content: 'test',
      tags: ['analysis:thesis', 'analysis:risk'],
    });
    const storedTags: string[] = (mockStore.mock.calls[0][0] as { tags: string[] }).tags;
    expect(storedTags).toContain('analysis:thesis');
    expect(storedTags).toContain('analysis:risk');
    expect(storedTags).toContain('ticker:AAPL');
  });
});
