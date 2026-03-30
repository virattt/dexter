import { describe, expect, test } from 'vitest';
import { AgentRunnerController } from './agent-runner.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

describe('AgentRunnerController', () => {
  test('updates the active agent config for subsequent runs', () => {
    const history = new InMemoryChatHistory('gpt-5.4');
    const controller = new AgentRunnerController(
      { model: 'gpt-5.4', modelProvider: 'openai', maxIterations: 10 },
      history,
    );

    controller.updateAgentConfig({
      model: 'ollama:llama3.1',
      modelProvider: 'ollama',
    });

    expect((controller as any).agentConfig).toMatchObject({
      model: 'ollama:llama3.1',
      modelProvider: 'ollama',
      maxIterations: 10,
    });
    expect((history as any).model).toBe('ollama:llama3.1');
  });
});
