import { describe, expect, test } from 'bun:test';
import { getChatModel } from './llm.js';

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

describe('Google Generative AI tool schema sanitization', () => {
  test('strips exclusiveMinimum and converts to minimum for integer schema', () => {
    const previousApiKey = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-key';

    try {
      const { DynamicStructuredTool } = require('@langchain/core/tools');
      const { z } = require('zod');

      const tool = new DynamicStructuredTool({
        name: 'test_tool',
        description: 'test description',
        schema: z.object({
          count: z.number().int().positive().describe('A positive count'),
        }),
        func: async () => 'ok',
      });

      const model = getChatModel('gemini-3.1-pro-preview');
      const bound = (model as any).bindTools([tool]);
      const boundTools = bound.config.tools;

      expect(boundTools).toBeDefined();
      expect(boundTools[0].functionDeclarations).toBeDefined();

      const decl = boundTools[0].functionDeclarations[0];
      const countProp = decl.parameters.properties.count;

      expect(countProp.exclusiveMinimum).toBeUndefined();
      expect(countProp.minimum).toBe(1);

      // Verify invocationParams also sanitizes
      const params = (model as any).invocationParams(bound.config);
      const invocationDecl = params.tools[0].functionDeclarations[0];
      expect(invocationDecl.parameters.properties.count.exclusiveMinimum).toBeUndefined();
      expect(invocationDecl.parameters.properties.count.minimum).toBe(1);
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = previousApiKey;
      }
    }
  });
});
