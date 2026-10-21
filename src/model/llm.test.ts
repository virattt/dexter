import { describe, expect, spyOn, test } from 'bun:test';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { getDefaultModelForProvider } from '../utils/model.js';
import { callLlmWithMessages, getChatModel, getFastModel, streamLlmWithMessages } from './llm.js';

describe('OpenAI API routing', () => {
  test('uses the Responses API for the GPT-6 and GPT-5.6 families', () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    try {
      for (const model of ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol']) {
        const llm = getChatModel(model) as { useResponsesApi?: boolean };
        expect(llm.useResponsesApi).toBe(true);
      }
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });
});

describe('MiniMax streaming HTTP requests', () => {
  for (const format of ['openai', 'anthropic'] as const) {
    test(`${format} streams the selected Flash model`, async () => {
      const previous = {
        MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
        MINIMAX_API_FORMAT: process.env.MINIMAX_API_FORMAT,
        MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL,
      };
      let requestBody: Record<string, unknown> = {};
      const model = 'MiniMax-M3.1-Flash';
      const events = format === 'openai' ? [
        { id: 'chat_test', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: null }] },
        { id: 'chat_test', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      ] : [
        { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model, content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ];
      const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (
        input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
      ) => {
        const request = new Request(input, init);
        requestBody = await request.json() as Record<string, unknown>;
        const data = events.map((event) => `${'type' in event ? `event: ${event.type}\n` : ''}data: ${JSON.stringify(event)}\n\n`).join('');
        return new Response(data + (format === 'openai' ? 'data: [DONE]\n\n' : ''), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }, { preconnect: globalThis.fetch.preconnect }));
      process.env.MINIMAX_API_KEY = 'test-key';
      process.env.MINIMAX_API_FORMAT = format;
      delete process.env.MINIMAX_BASE_URL;
      try {
        let content = '';
        for await (const chunk of streamLlmWithMessages([new HumanMessage('Hello')], {
          model: getDefaultModelForProvider('minimax'),
        })) {
          if (typeof chunk.content === 'string') content += chunk.content;
          else for (const block of chunk.content) {
            if (block.type === 'text' && typeof block.text === 'string') content += block.text;
          }
        }
        expect(content).toBe('ok');
        expect(requestBody.model).toBe(model);
        expect(requestBody.stream).toBe(true);
        expect(requestBody.service_tier).toBeUndefined();
        expect(requestBody.reasoning_split).toBeUndefined();
        if (format === 'anthropic') expect(requestBody.thinking).toEqual({ type: 'adaptive' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        fetchMock.mockRestore();
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  }
});

describe('MiniMax HTTP requests', () => {
  for (const format of ['openai', 'anthropic'] as const) {
    for (const region of ['global', 'cn', 'custom'] as const) {
      test(`${format} ${region} preserves default, saved, legacy and custom model requests`, async () => {
        const previous = {
          MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
          MINIMAX_API_FORMAT: process.env.MINIMAX_API_FORMAT,
          MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL,
        };
        const baseUrl = region === 'custom'
          ? `https://minimax.example.test/${format}`
          : `https://api.${region === 'cn' ? 'minimaxi.com' : 'minimax.io'}/${format === 'openai' ? 'v1' : 'anthropic'}`;
        let requestUrl = '';
        let requestBody: Record<string, unknown> = {};
        // Intercept the SDK's serialized HTTP request; never contact an inference endpoint.
        const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (
          input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
        ) => {
          const request = new Request(input, init);
          requestUrl = request.url;
          requestBody = await request.json() as Record<string, unknown>;
          return Response.json(format === 'openai' ? {
            id: 'chat_test',
            object: 'chat.completion',
            model: requestBody.model,
            choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          } : {
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            model: requestBody.model,
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        }, { preconnect: globalThis.fetch.preconnect }));
        process.env.MINIMAX_API_KEY = 'test-key';
        if (format === 'openai') delete process.env.MINIMAX_API_FORMAT;
        else process.env.MINIMAX_API_FORMAT = format;
        if (region === 'global') delete process.env.MINIMAX_BASE_URL;
        else process.env.MINIMAX_BASE_URL = baseUrl;

        try {
          const defaultModel = getDefaultModelForProvider('minimax')!;
          expect(defaultModel).toBe('minimax:MiniMax-M3.1-Flash');
          expect(getFastModel('minimax', 'saved-model')).toBe(defaultModel);
          for (const model of [defaultModel, 'minimax:MiniMax-M3', 'minimax:MiniMax-M2.7', 'minimax:custom-model']) {
            const result = await callLlmWithMessages([
              new HumanMessage({ content: [
                { type: 'text', text: 'Describe this image.' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
              ] }),
              new AIMessage({
                content: format === 'anthropic' ? [{ type: 'thinking', thinking: 'saved reasoning', signature: 'test-signature' }] : '',
                tool_calls: [{ id: 'call_test', name: 'lookup', args: { symbol: 'TEST' } }],
              }),
              new ToolMessage({ content: 'saved tool result', tool_call_id: 'call_test' }),
            ], { model });

            expect(typeof result.response === 'string' ? result.response : result.response.content).toBe('ok');
            expect(requestUrl).toBe(`${baseUrl}/${format === 'openai' ? 'chat/completions' : 'v1/messages'}`);
            expect(requestBody.model).toBe(model.replace(/^minimax:/, ''));
            // Flash requires adaptive thinking; retain other models' existing SDK defaults.
            if (format === 'anthropic' && model === defaultModel) {
              expect(requestBody.thinking).toEqual({ type: 'adaptive' });
            } else if (format === 'anthropic') {
              // Newer SDKs omit this default instead of serializing disabled.
              const sdkDefaults: unknown[] = [undefined, { type: 'disabled' }];
              expect(sdkDefaults).toContainEqual(requestBody.thinking);
            } else {
              expect(requestBody.thinking).toBeUndefined();
            }
            expect(requestBody.reasoning_effort).toBeUndefined();
            expect(requestBody.output_config).toBeUndefined();
            expect(requestBody.service_tier).toBeUndefined();
            expect(requestBody.reasoning_split).toBeUndefined();
            const messages = requestBody.messages as Array<Record<string, unknown>>;
            if (format === 'openai') {
              expect(messages[0]?.content).toEqual([
                { type: 'text', text: 'Describe this image.' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
              ]);
              expect(messages[1]?.tool_calls).toEqual([
                { id: 'call_test', type: 'function', function: { name: 'lookup', arguments: '{"symbol":"TEST"}' } },
              ]);
              expect(messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_test', content: 'saved tool result' });
            } else {
              expect(messages[0]?.content).toEqual([
                { type: 'text', text: 'Describe this image.' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA==' } },
              ]);
              expect(messages[1]?.content).toContainEqual({ type: 'thinking', thinking: 'saved reasoning', signature: 'test-signature' });
              expect(messages[1]?.content).toContainEqual({ type: 'tool_use', id: 'call_test', name: 'lookup', input: { symbol: 'TEST' } });
              expect(messages[2]?.content).toContainEqual({ type: 'tool_result', tool_use_id: 'call_test', content: 'saved tool result' });
            }
          }
          expect(fetchMock).toHaveBeenCalledTimes(4);
        } finally {
          fetchMock.mockRestore();
          for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
          }
        }
      });
    }
  }
});
