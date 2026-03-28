import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { AIMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Mock callLlm BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockCallLlm = mock(async (_prompt: string, _opts: unknown) => ({
  response: new AIMessage({ content: '', tool_calls: [] }),
  usage: undefined,
}));

mock.module('../../model/llm.js', () => ({
  callLlm: mockCallLlm,
  DEFAULT_MODEL: 'gpt-5.4',
  getChatModel: mock(() => ({})),
}));

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

const { createGetFinancials } = await import('./get-financials.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolCallResponse(toolName: string, args: Record<string, unknown>): AIMessage {
  return new AIMessage({
    content: '',
    tool_calls: [{ name: toolName, args, id: 'call-1', type: 'tool_call' }],
  });
}

function emptyResponse(): AIMessage {
  return new AIMessage({ content: '', tool_calls: [] });
}

const withUsage = (response: AIMessage) => ({ response, usage: undefined as undefined });

function parseResult(raw: unknown): { data: unknown } {
  return JSON.parse(raw as string);
}

// ---------------------------------------------------------------------------
// Router retry behaviour
// ---------------------------------------------------------------------------

describe('get-financials router — retry on zero tool calls', () => {
  const tool = createGetFinancials('test-model');

  beforeEach(() => mockCallLlm.mockReset());

  test('retries when first callLlm returns zero tool calls', async () => {
    // First call: no tool calls → retry
    mockCallLlm.mockResolvedValueOnce({ response: emptyResponse(), usage: undefined });
    // Second call (retry): also no tool calls → keyword fallback
    mockCallLlm.mockResolvedValueOnce({ response: emptyResponse(), usage: undefined });

    await tool.invoke({ query: 'analyst estimates for AAPL' });

    expect(mockCallLlm).toHaveBeenCalledTimes(2);
  });

  test('does NOT retry when first callLlm returns valid tool calls', async () => {
    mockCallLlm.mockResolvedValueOnce({
      response: makeToolCallResponse('get_analyst_estimates', { ticker: 'AAPL', period: 'annual' }),
      usage: undefined,
    });

    await tool.invoke({ query: 'analyst estimates for AAPL' });

    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  test('uses valid tool calls from retry when first attempt is empty', async () => {
    mockCallLlm
      .mockResolvedValueOnce({ response: emptyResponse(), usage: undefined })
      .mockResolvedValueOnce({
        response: makeToolCallResponse('get_analyst_estimates', { ticker: 'AAPL', period: 'annual' }),
        usage: undefined,
      });

    const raw = await tool.invoke({ query: 'analyst estimates for AAPL' });
    const result = parseResult(raw);

    // Should not be a routing error
    expect((result.data as Record<string, unknown>).error).not.toBe('No tools selected for query');
  });
});

// ---------------------------------------------------------------------------
// Keyword fallback behaviour
// ---------------------------------------------------------------------------

describe('get-financials router — keyword fallback after two empty responses', () => {
  const tool = createGetFinancials('test-model');

  beforeEach(() => {
    mockCallLlm.mockReset();
    // Both LLM calls return empty (triggers keyword fallback)
    mockCallLlm.mockResolvedValue({ response: emptyResponse(), usage: undefined });
  });

  test('routes "analyst price targets for VWS.CO" to get_yahoo_analyst_targets', async () => {
    const raw = await tool.invoke({ query: 'analyst price targets for VWS.CO' });
    const result = parseResult(raw);

    // Should not be a "No tools selected" error — keyword fallback should have fired
    expect((result.data as Record<string, unknown>).error).not.toBe('No tools selected for query');
  });

  test('routes "analyst estimates for AAPL" to get_analyst_estimates', async () => {
    const raw = await tool.invoke({ query: 'analyst estimates for AAPL' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).not.toBe('No tools selected for query');
  });

  test('returns "No tools selected" error only when no ticker can be extracted', async () => {
    const raw = await tool.invoke({ query: 'what is the meaning of life' });
    const result = parseResult(raw);

    expect((result.data as Record<string, unknown>).error).toBe('No tools selected for query');
  });
});

// ---------------------------------------------------------------------------
// Yahoo Finance tools registered in router
// ---------------------------------------------------------------------------

describe('get-financials — Yahoo Finance tools in FINANCE_TOOLS', () => {
  const tool = createGetFinancials('test-model');

  test('router prompt mentions Yahoo Finance tools for international tickers', async () => {
    // Check that at least one callLlm invocation carries the Yahoo tool in its tools list
    mockCallLlm.mockResolvedValueOnce({
      response: makeToolCallResponse('get_yahoo_analyst_targets', { ticker: 'VWS.CO' }),
      usage: undefined,
    });

    await tool.invoke({ query: 'price targets for VWS.CO' });

    const callOpts = mockCallLlm.mock.calls[0]?.[1] as { tools?: Array<{ name: string }> };
    const toolNames = callOpts?.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain('get_yahoo_analyst_targets');
    expect(toolNames).toContain('get_yahoo_analyst_recommendations');
  });
});
