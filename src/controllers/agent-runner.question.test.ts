import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { AgentRunnerController } from './agent-runner.js';
import { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';
import type { AgentConfig, AgentEvent } from '../agent/types.js';
import type { Question } from '../tools/ask-user-question/types.js';

const QUESTIONS: Question[] = [
  {
    question: 'Which ticker?',
    header: 'Ticker',
    multiSelect: false,
    options: [
      { label: 'AAPL', description: 'Apple' },
      { label: 'MSFT', description: 'Microsoft' },
    ],
  },
];

function createController() {
  const controller = new AgentRunnerController(
    { model: 'gpt-5.5', modelProvider: 'openai', maxIterations: 10 },
    new InMemoryChatHistory('gpt-5.5'),
  );
  return controller;
}

describe('AgentRunnerController — question flow', () => {
  beforeEach(() => {
    mock.module('../agent/agent.js', () => ({
      Agent: class MockAgent {
        static async create(config: AgentConfig) {
          return new MockAgent(config);
        }
        constructor(private config: AgentConfig) {}
        async *run(): AsyncGenerator<AgentEvent> {
          const requestUserInput = this.config.requestUserInput;
          if (requestUserInput) {
            await requestUserInput({ questions: QUESTIONS });
          }
          yield { type: 'done', answer: 'done', toolCalls: [], iterations: 1, totalTime: 10 };
        }
      },
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  test('sets pendingQuestion and question working state while awaiting input', async () => {
    const controller = createController();
    expect(controller.pendingQuestion).toBeNull();

    const runPromise = controller.runQuery('test');
    await new Promise((r) => setTimeout(r, 10));

    expect(controller.pendingQuestion).not.toBeNull();
    expect(controller.pendingQuestion?.questions[0].header).toBe('Ticker');
    expect(controller.workingState.status).toBe('question');

    controller.respondToQuestion({ answers: [] });
    await runPromise;
  });

  test('respondToQuestion clears pendingQuestion and completes the run', async () => {
    const controller = createController();
    const runPromise = controller.runQuery('test');
    await new Promise((r) => setTimeout(r, 10));

    controller.respondToQuestion({
      answers: [{ header: 'Ticker', question: 'Which ticker?', selected: ['AAPL'] }],
    });
    await runPromise;

    expect(controller.pendingQuestion).toBeNull();
    expect(controller.workingState.status).toBe('idle');
  });

  test('cancelExecution unblocks a pending question (declined) without hanging', async () => {
    const controller = createController();
    const runPromise = controller.runQuery('test');
    await new Promise((r) => setTimeout(r, 10));

    expect(controller.pendingQuestion).not.toBeNull();

    controller.cancelExecution();
    await runPromise;

    expect(controller.pendingQuestion).toBeNull();
    expect(controller.workingState.status).toBe('idle');
  });

  test('respondToQuestion is a no-op when nothing is pending', () => {
    const controller = createController();
    expect(() => controller.respondToQuestion({ answers: [] })).not.toThrow();
  });
});
