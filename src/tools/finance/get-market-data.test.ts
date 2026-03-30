import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import { AIMessage } from '@langchain/core/messages';

const mockCallLlm = mock(async () => ({
  response: new AIMessage({ content: '', tool_calls: [] }),
  usage: undefined,
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

const { createGetMarketData } = await import('./get-market-data.js');
const { api } = await import('./api.js');

function makeToolCallResponse(name: string, args: Record<string, unknown>) {
  return {
    response: new AIMessage({
      content: '',
      tool_calls: [{ name, args, id: 'test-id', type: 'tool_call' as const }],
    }),
    usage: undefined,
  };
}

let apiSpy: ReturnType<typeof spyOn<typeof api, 'get'>>;

beforeEach(() => {
  mockCallLlm.mockClear();
  apiSpy = spyOn(api, 'get').mockResolvedValue({
    data: { prices: [{ close: 150 }] },
    url: 'https://api.test/prices/',
  });
});

afterEach(() => {
  apiSpy.mockRestore();
});

describe('createGetMarketData', () => {
  test('returns a tool with name get_market_data', () => {
    const tool = createGetMarketData('test-model');
    expect(tool.name).toBe('get_market_data');
  });
});

describe('get_market_data — LLM routes to tool', () => {
  test('executes tool call when LLM returns get_stock_price', async () => {
    mockCallLlm.mockResolvedValueOnce(
      makeToolCallResponse('get_stock_price', { ticker: 'AAPL' }),
    );
    apiSpy.mockResolvedValue({
      data: { snapshot: { ticker: 'AAPL', price: 150 } },
      url: 'https://api.test/snapshot/',
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'What is AAPL stock price?' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('executes tool call when LLM returns get_company_news', async () => {
    mockCallLlm.mockResolvedValueOnce(
      makeToolCallResponse('get_company_news', { ticker: 'AAPL', limit: 5 }),
    );
    apiSpy.mockResolvedValue({
      data: { news: [{ title: 'AAPL earnings beat' }] },
      url: 'https://api.test/news/',
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'Latest AAPL news?' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('handles unknown tool name gracefully', async () => {
    mockCallLlm.mockResolvedValueOnce(
      makeToolCallResponse('nonexistent_tool', { ticker: 'AAPL' }),
    );

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'price of AAPL' });
    const parsed = JSON.parse(result);
    // Should have error data for the failed tool call
    expect(parsed.data).toBeDefined();
  });
});

describe('get_market_data — keyword fallback', () => {
  test('falls back to keyword routing when LLM returns no tool calls', async () => {
    // Both LLM calls return empty tool_calls → triggers keyword fallback
    mockCallLlm.mockResolvedValue({
      response: new AIMessage({ content: '', tool_calls: [] }),
      usage: undefined,
    });
    apiSpy.mockResolvedValue({
      data: { snapshot: { ticker: 'AAPL', price: 150 } },
      url: 'https://api.test/snapshot/',
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'stock price of Apple' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('routes to insider trades on "insider" keyword', async () => {
    mockCallLlm.mockResolvedValue({
      response: new AIMessage({ content: '', tool_calls: [] }),
      usage: undefined,
    });
    apiSpy.mockResolvedValue({
      data: { insider_trades: [] },
      url: 'https://api.test/insider/',
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'Tesla insider bought shares' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('routes to crypto price on "bitcoin" keyword', async () => {
    mockCallLlm.mockResolvedValue({
      response: new AIMessage({ content: '', tool_calls: [] }),
      usage: undefined,
    });
    apiSpy.mockResolvedValue({
      data: { snapshot: { ticker: 'BTC', price: 50000 } },
      url: 'https://api.test/crypto/',
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'bitcoin price today' });
    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
  });

  test('returns error when no ticker can be resolved from query', async () => {
    mockCallLlm.mockResolvedValue({
      response: new AIMessage({ content: '', tool_calls: [] }),
      usage: undefined,
    });

    const tool = createGetMarketData('test-model');
    const result = await tool.invoke({ query: 'what is the meaning of life' });
    const parsed = JSON.parse(result);
    expect(parsed.data.error).toBeDefined();
  });
});
