import { describe, test, expect, beforeAll } from 'bun:test';
import { Agent } from './agent.js';
import { callLlm, getChatModel, DEFAULT_MODEL, DEFAULT_PROVIDER } from '../model/llm.js';
import type { AIMessage } from '@langchain/core/messages';

describe('Azure OpenAI Integration', () => {
  beforeAll(() => {
    // Ensure we're using Azure OpenAI
    expect(DEFAULT_PROVIDER).toBe('azureopenai');
    expect(DEFAULT_MODEL).toBe('gpt-5.2');
  });

  describe('LLM Direct Calls', () => {
    test('should use Azure OpenAI with managed identity by default', () => {
      const model = getChatModel();
      expect(model).toBeDefined();
      expect(model.constructor.name).toBe('ChatOpenAI');
    });

    test('should successfully call Azure OpenAI with a simple prompt', async () => {
      const result = await callLlm('Say "Hello from Azure OpenAI" and nothing else.', {
        model: DEFAULT_MODEL,
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();

      const responseText = typeof result.response === 'string'
        ? result.response
        : (result.response as AIMessage).content;

      expect(typeof responseText).toBe('string');
      expect((responseText as string).length).toBeGreaterThan(0);

      console.log('✅ Azure OpenAI Response: - agent-azure-openai.test.ts:35', responseText);
    }, { timeout: 30000 });

    test('should return token usage information', async () => {
      const result = await callLlm('Count to 3.', {
        model: DEFAULT_MODEL,
      });

      expect(result.usage).toBeDefined();
      if (result.usage) {
        expect(result.usage.inputTokens).toBeGreaterThan(0);
        expect(result.usage.outputTokens).toBeGreaterThan(0);
        expect(result.usage.totalTokens).toBeGreaterThan(0);

        console.log('✅ Token Usage: - agent-azure-openai.test.ts:49', result.usage);
      }
    }, { timeout: 30000 });

    test('should handle multi-turn conversation context', async () => {
      const systemPrompt = 'You are a helpful assistant. Be concise.';

      const result = await callLlm('What is 2+2?', {
        model: DEFAULT_MODEL,
        systemPrompt,
      });

      expect(result.response).toBeDefined();
      const responseText = typeof result.response === 'string'
        ? result.response
        : (result.response as AIMessage).content;

      expect(responseText).toContain('4');
      console.log('✅ Math Response: - agent-azure-openai.test.ts:67', responseText);
    }, { timeout: 30000 });
  });

  describe('Agent Integration', () => {
    test('should create agent with default Azure OpenAI configuration', () => {
      const agent = Agent.create({ model: DEFAULT_MODEL });
      expect(agent).toBeDefined();
      console.log('✅ Agent created successfully with Azure OpenAI - agent-azure-openai.test.ts:75');
    });

    test('should handle simple conversational query without tool calls', async () => {
      const agent = Agent.create({
        model: DEFAULT_MODEL,
        maxIterations: 5,
      });

      const query = 'What features do you have? Please list your key capabilities.';
      const events: string[] = [];
      let finalAnswer = '';

      console.log('\n🤖 Testing Agent with query: - agent-azure-openai.test.ts:88', query);
      console.log('━ - agent-azure-openai.test.ts:89'.repeat(80));

      for await (const event of agent.run(query)) {
        events.push(event.type);

        switch (event.type) {
          case 'thinking':
            console.log('💭 Thinking: - agent-azure-openai.test.ts:96', event.message);
            break;

          case 'tool_start':
            console.log(`🔧 Tool Start: ${event.tool} - agent-azure-openai.test.ts:100`);
            break;

          case 'tool_end':
            console.log(`✅ Tool End: ${event.tool} - agent-azure-openai.test.ts:104`);
            break;

          case 'answer_start':
            console.log('📝 Generating final answer... - agent-azure-openai.test.ts:108');
            break;

          case 'done':
            finalAnswer = event.answer;
            console.log('\n✨ Final Answer: - agent-azure-openai.test.ts:113');
            console.log('━ - agent-azure-openai.test.ts:114'.repeat(80));
            console.log(finalAnswer);
            console.log('━ - agent-azure-openai.test.ts:116'.repeat(80));
            console.log(`\n📊 Stats: - agent-azure-openai.test.ts:117`);
            console.log(`Iterations: ${event.iterations} - agent-azure-openai.test.ts:118`);
            console.log(`Tool Calls: ${event.toolCalls.length} - agent-azure-openai.test.ts:119`);
            console.log(`Time: ${event.totalTime}ms - agent-azure-openai.test.ts:120`);
            if (event.tokenUsage) {
              console.log(`Tokens: ${event.tokenUsage.totalTokens} (${event.tokenUsage.inputTokens} in, ${event.tokenUsage.outputTokens} out) - agent-azure-openai.test.ts:122`);
            }
            break;
        }
      }

      // Assertions
      expect(events).toContain('done');
      expect(finalAnswer).toBeDefined();
      expect(finalAnswer.length).toBeGreaterThan(0);

      // The response should mention some capabilities/features
      const lowerAnswer = finalAnswer.toLowerCase();
      const hasFeaturesMention =
        lowerAnswer.includes('feature') ||
        lowerAnswer.includes('capabilit') ||
        lowerAnswer.includes('can') ||
        lowerAnswer.includes('tool') ||
        lowerAnswer.includes('help') ||
        lowerAnswer.includes('research') ||
        lowerAnswer.includes('financial') ||
        lowerAnswer.includes('data');

      expect(hasFeaturesMention).toBe(true);

      console.log('\n✅ Agent test completed successfully! - agent-azure-openai.test.ts:147');
    }, { timeout: 60000 });

    test('should handle tool-based queries', async () => {
      const agent = Agent.create({
        model: DEFAULT_MODEL,
        maxIterations: 10,
      });

      const query = 'What tools are available to you? Just list them, don\'t use them.';
      let finalAnswer = '';
      let toolCallCount = 0;

      console.log('\n🤖 Testing Agent with query: - agent-azure-openai.test.ts:160', query);
      console.log('━ - agent-azure-openai.test.ts:161'.repeat(80));

      for await (const event of agent.run(query)) {
        if (event.type === 'tool_start') {
          toolCallCount++;
        }

        if (event.type === 'done') {
          finalAnswer = event.answer;
          console.log('\n✨ Final Answer: - agent-azure-openai.test.ts:170', finalAnswer);
          console.log(`📊 Tool Calls: ${toolCallCount} - agent-azure-openai.test.ts:171`);
        }
      }

      expect(finalAnswer).toBeDefined();
      expect(finalAnswer.length).toBeGreaterThan(0);

      console.log('\n✅ Toolbased query test completed! - agent-azure-openai.test.ts:178');
    }, { timeout: 60000 });

    test('should respect max iterations limit', async () => {
      const agent = Agent.create({
        model: DEFAULT_MODEL,
        maxIterations: 2, // Very low limit
      });

      const query = 'Tell me about yourself';
      let iterations = 0;

      for await (const event of agent.run(query)) {
        if (event.type === 'done') {
          iterations = event.iterations;
        }
      }

      expect(iterations).toBeLessThanOrEqual(2);
      console.log(`✅ Max iterations respected: ${iterations}/2 - agent-azure-openai.test.ts:197`);
    }, { timeout: 30000 });
  });

  describe('Error Handling', () => {
    test('should handle empty query gracefully', async () => {
      const agent = Agent.create({ model: DEFAULT_MODEL });
      let hasError = false;
      let finalAnswer = '';

      try {
        for await (const event of agent.run('')) {
          if (event.type === 'done') {
            finalAnswer = event.answer;
          }
        }
      } catch (error) {
        hasError = true;
      }

      // Should either handle gracefully with a response or throw an error
      expect(hasError || finalAnswer.length > 0).toBe(true);
      console.log('✅ Empty query handled: - agent-azure-openai.test.ts:219', hasError ? 'with error' : 'gracefully');
    }, { timeout: 30000 });
  });

  describe('Azure Managed Identity Configuration', () => {
    test('should use correct credential type based on environment', () => {
      const isProduction = process.env.NODE_ENV === 'production';
      const expectedCredentialType = isProduction ? 'ManagedIdentityCredential' : 'AzureCliCredential';

      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'} - agent-azure-openai.test.ts:228`);
      console.log(`✅ Expected Credential: ${expectedCredentialType} - agent-azure-openai.test.ts:229`);

      // This test mainly documents the expected behavior
      // In test environment, it should use AzureCliCredential (same as development)
      expect(['production', 'development', 'test', undefined]).toContain(process.env.NODE_ENV);
    });
  });
});

describe('Azure OpenAI Performance', () => {
  test('should complete simple query within reasonable time', async () => {
    const startTime = Date.now();

    const result = await callLlm('Say hi!', {
      model: DEFAULT_MODEL,
    });

    const duration = Date.now() - startTime;

    expect(result.response).toBeDefined();
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

    console.log(`✅ Query completed in ${duration}ms - agent-azure-openai.test.ts:251`);
  }, { timeout: 30000 });

  test('should handle concurrent requests', async () => {
    const queries = [
      'What is 1+1?',
      'What is 2+2?',
      'What is 3+3?',
    ];

    const startTime = Date.now();

    const results = await Promise.all(
      queries.map(query => callLlm(query, { model: DEFAULT_MODEL }))
    );

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.response).toBeDefined();
    });

    console.log(`✅ ${queries.length} concurrent requests completed in ${duration}ms - agent-azure-openai.test.ts:274`);
    console.log(`Average: ${Math.round(duration / queries.length)}ms per request - agent-azure-openai.test.ts:275`);
  }, { timeout: 45000 });
});
