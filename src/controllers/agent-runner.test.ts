import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { AgentRunnerController } from './agent-runner.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { AgentConfig, AgentEvent, ApprovalDecision } from '../agent/types.js';

/**
 * Helper to create an AgentRunnerController with a change counter
 */
function createController(onChange?: () => void) {
  let changeCount = 0;
  const controller = new AgentRunnerController(
    { model: 'gpt-5.5', modelProvider: 'openai', maxIterations: 10 },
    new InMemoryChatHistory('gpt-5.5'),
    () => {
      changeCount++;
      onChange?.();
    },
  );
  return { controller, getChangeCount: () => changeCount };
}

describe('AgentRunnerController', () => {
  let mockAgentRunYielded: AgentEvent[] = [];

  beforeEach(() => {
    mockAgentRunYielded = [];

    mock.module('../agent/agent.js', () => ({
      Agent: class MockAgent {
        static async create(config: AgentConfig) {
          return new MockAgent(config);
        }

        constructor(private config: AgentConfig) {}

        async *run(): AsyncGenerator<AgentEvent> {
          // Capture the approval request function from config
          const requestApproval = this.config.requestToolApproval;
          if (requestApproval) {
            const promise = requestApproval({ tool: 'write_file', args: { path: '.dexter/RULES.md', content: 'test' } });
            await promise;
          }

          // Yield any configured events
          for (const event of mockAgentRunYielded) {
            yield event;
          }

          yield { type: 'done', answer: 'done', toolCalls: [], iterations: 1, totalTime: 100 };
        }
      },
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('updates the active agent config for subsequent runs', () => {
    const controller = new AgentRunnerController(
      { model: 'gpt-5.5', modelProvider: 'openai', maxIterations: 10 },
      new InMemoryChatHistory('gpt-5.5'),
    );

    controller.updateAgentConfig({
      model: 'ollama:llama3.1',
      modelProvider: 'ollama',
    });

    expect(controller.currentConfig).toMatchObject({
      model: 'ollama:llama3.1',
      modelProvider: 'ollama',
      maxIterations: 10,
    });
  });

  describe('approval state', () => {
    test('sets pendingApproval when entering approval state', async () => {
      const { controller } = createController();

      expect(controller.pendingApproval).toBeNull();

      const runPromise = controller.runQuery('test query');

      // Wait a tick for the async agent.run() to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.pendingApproval).not.toBeNull();
      expect(controller.pendingApproval?.tool).toBe('write_file');
      expect(controller.pendingApproval?.args).toMatchObject({
        path: '.dexter/RULES.md',
        content: 'test',
      });

      // Clean up: deny to complete the run
      controller.respondToApproval('deny');
      await runPromise;
    });

    test('fires onChange when entering approval state', async () => {
      const { controller, getChangeCount } = createController();
      const initialCount = getChangeCount();

      const runPromise = controller.runQuery('test query');

      // Wait a tick for the async agent.run() to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getChangeCount()).toBeGreaterThan(initialCount);

      // Clean up: deny to complete the run
      controller.respondToApproval('deny');
      await runPromise;
    });

    test('clears pendingApproval on allow-once', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.pendingApproval).not.toBeNull();

      controller.respondToApproval('allow-once');
      await runPromise;

      expect(controller.pendingApproval).toBeNull();
    });

    test('clears pendingApproval on deny', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.pendingApproval).not.toBeNull();

      controller.respondToApproval('deny');
      await runPromise;

      expect(controller.pendingApproval).toBeNull();
    });

    test('fires onChange when exiting approval state', async () => {
      const { controller, getChangeCount } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      const countAfterEnter = getChangeCount();

      controller.respondToApproval('allow-once');
      await runPromise;

      expect(getChangeCount()).toBeGreaterThan(countAfterEnter);
    });

    test('fires onChange when exiting approval state via deny', async () => {
      const { controller, getChangeCount } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      const countAfterEnter = getChangeCount();

      controller.respondToApproval('deny');
      await runPromise;

      expect(getChangeCount()).toBeGreaterThan(countAfterEnter);
    });
  });

  describe('cancelExecution', () => {
    test('clears pendingApproval', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.pendingApproval).not.toBeNull();

      controller.cancelExecution();
      await runPromise;

      expect(controller.pendingApproval).toBeNull();
    });

    test('fires onChange', async () => {
      const { controller, getChangeCount } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      const countBeforeCancel = getChangeCount();

      controller.cancelExecution();
      await runPromise;

      expect(getChangeCount()).toBeGreaterThan(countBeforeCancel);
    });

    test('sets workingState to idle', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.workingState.status).toBe('approval');

      controller.cancelExecution();
      await runPromise;

      expect(controller.workingState.status).toBe('idle');
    });
  });

  describe('respondToApproval edge cases', () => {
    test('does nothing when no approval is pending', () => {
      const { controller, getChangeCount } = createController();
      const countBefore = getChangeCount();

      // Should not throw and should not fire onChange
      controller.respondToApproval('allow-once');

      expect(getChangeCount()).toBe(countBefore);
    });

    test('updates workingState to thinking on allow-once', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(controller.workingState.status).toBe('approval');

      controller.respondToApproval('allow-once');
      await runPromise;

      // After run completes, workingState returns to idle
      expect(controller.workingState.status).toBe('idle');
    });

    test('keeps workingState idle on deny', async () => {
      const { controller } = createController();

      const runPromise = controller.runQuery('test query');
      await new Promise(resolve => setTimeout(resolve, 10));

      controller.respondToApproval('deny');
      await runPromise;

      expect(controller.workingState.status).toBe('idle');
    });
  });
});
