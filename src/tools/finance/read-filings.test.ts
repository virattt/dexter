import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { AIMessage } from '@langchain/core/messages';

const mockCallLlm = mock(async () => ({
  response: { ticker: 'AAPL', filing_types: ['10-K'], limit: 10 },
  usage: undefined,
}));

const mockGetFilingsInvoke = mock(async (_args: unknown) =>
  JSON.stringify({ data: [], sourceUrls: ['https://api.test/filings/'] }),
);

const mockGet10KFilingItemsInvoke = mock(async (_args: unknown) =>
  JSON.stringify({ data: 'Risk factors content here...', sourceUrls: ['https://api.test/10k/'] }),
);

const mockGetFilingItemTypes = mock(async () => ({
  '10-K': [
    { name: 'Item-1', title: 'Business', description: 'Business overview' },
    { name: 'Item-1A', title: 'Risk Factors', description: 'Risk factors' },
  ],
  '10-Q': [
    { name: 'Part-1,Item-2', title: 'MD&A', description: "Management's discussion" },
  ],
}));

mock.module('../../model/llm.js', () => ({
  callLlm: mockCallLlm,
  DEFAULT_MODEL: 'gpt-5.4',
  getChatModel: mock(() => ({})),
}));

mock.module('../../agent/prompts.js', () => ({
  getCurrentDate: () => '2024-01-15',
  buildSystemPrompt: () => 'Mock system prompt',
  SYSTEM_PROMPT_CACHE_TTL: 60000,
}));

mock.module('./filings.js', () => ({
  getFilings: { invoke: mockGetFilingsInvoke },
  get10KFilingItems: { invoke: mockGet10KFilingItemsInvoke },
  get10QFilingItems: { invoke: mock(async () => JSON.stringify({ data: [], sourceUrls: [] })) },
  get8KFilingItems: { invoke: mock(async () => JSON.stringify({ data: [], sourceUrls: [] })) },
  getFilingItemTypes: mockGetFilingItemTypes,
}));

const { createReadFilings } = await import('./read-filings.js');

function makeStep2Response(toolName: string, args: Record<string, unknown>) {
  return {
    response: new AIMessage({
      content: '',
      tool_calls: [{ name: toolName, args, id: 'step2-id', type: 'tool_call' as const }],
    }),
    usage: undefined,
  };
}

beforeEach(() => {
  mockCallLlm.mockClear();
  mockGetFilingsInvoke.mockClear();
  mockGet10KFilingItemsInvoke.mockClear();
  mockGetFilingItemTypes.mockClear();
});

describe('createReadFilings', () => {
  test('returns a tool with name read_filings', () => {
    const tool = createReadFilings('test-model');
    expect(tool.name).toBe('read_filings');
  });
});

describe('read_filings — step 1 failure', () => {
  test('returns error when step 1 LLM call throws', async () => {
    mockCallLlm.mockRejectedValueOnce(new Error('LLM timeout'));

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL risk factors' });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
    expect(parsed.data.error).toContain('plan');
  });

  test('returns error when step 1 returns invalid schema', async () => {
    // Return schema-incompatible object (missing required fields)
    mockCallLlm.mockResolvedValueOnce({ response: { bad: 'data' }, usage: undefined });

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL annual report' });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
  });
});

describe('read_filings — no filings found', () => {
  test('returns error when filings metadata is empty', async () => {
    // Step 1 succeeds with valid plan
    mockCallLlm.mockResolvedValueOnce({
      response: { ticker: 'AAPL', filing_types: ['10-K'], limit: 10 },
      usage: undefined,
    });
    // getFilings returns empty list
    mockGetFilingsInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: [], sourceUrls: ['https://api.test/filings/'] }),
    );

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL 10-K' });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toContain('No filings found');
  });
});

describe('read_filings — happy path', () => {
  const mockFiling = {
    accession_number: '0000320193-24-000001',
    filing_type: '10-K',
    period_of_report: '2023-09-30',
  };

  test('returns combined filing content on success', async () => {
    // Step 1: structured output plan
    mockCallLlm.mockResolvedValueOnce({
      response: { ticker: 'AAPL', filing_types: ['10-K'], limit: 10 },
      usage: undefined,
    });
    // getFilings returns one filing
    mockGetFilingsInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: [mockFiling], sourceUrls: ['https://api.test/filings/'] }),
    );
    // Step 2: LLM selects item to read
    mockCallLlm.mockResolvedValueOnce(
      makeStep2Response('get_10K_filing_items', {
        accession_number: mockFiling.accession_number,
        items: ['Item-1A'],
      }),
    );

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL risk factors from latest 10-K' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('includes source URLs from both filings fetch and content read', async () => {
    mockCallLlm.mockResolvedValueOnce({
      response: { ticker: 'AAPL', filing_types: ['10-K'], limit: 5 },
      usage: undefined,
    });
    mockGetFilingsInvoke.mockResolvedValueOnce(
      JSON.stringify({ data: [mockFiling], sourceUrls: ['https://api.test/filings/'] }),
    );
    mockCallLlm.mockResolvedValueOnce(
      makeStep2Response('get_10K_filing_items', {
        accession_number: mockFiling.accession_number,
        items: ['Item-1A'],
      }),
    );

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL risk factors' });
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.sourceUrls)).toBe(true);
    expect(parsed.sourceUrls.length).toBeGreaterThan(0);
  });
});

describe('read_filings — step 2 returns no tool calls', () => {
  test('returns error when step 2 produces no tool calls', async () => {
    mockCallLlm.mockResolvedValueOnce({
      response: { ticker: 'AAPL', filing_types: ['10-K'], limit: 10 },
      usage: undefined,
    });
    mockGetFilingsInvoke.mockResolvedValueOnce(
      JSON.stringify({
        data: [{ accession_number: 'ACC001', filing_type: '10-K' }],
        sourceUrls: [],
      }),
    );
    // Step 2 returns empty tool_calls
    mockCallLlm.mockResolvedValueOnce({
      response: new AIMessage({ content: '', tool_calls: [] }),
      usage: undefined,
    });

    const tool = createReadFilings('test-model');
    const result = await tool.invoke({ query: 'AAPL business description' });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
  });
});
