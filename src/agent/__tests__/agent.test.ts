import { Agent, AgentCallbacks, Task } from '../agent.js';
import { PlannedTask, SubTaskResult } from '../schemas.js';

// Mock all external dependencies
jest.mock('../../model/llm.js');
jest.mock('../../tools/index.js');
jest.mock('../../utils/context.js');
jest.mock('../task-planner.js');
jest.mock('../task-executor.js');
jest.mock('../answer-generator.js');

import { TaskPlanner } from '../task-planner.js';
import { TaskExecutor } from '../task-executor.js';
import { AnswerGenerator } from '../answer-generator.js';

const MockTaskPlanner = TaskPlanner as jest.MockedClass<typeof TaskPlanner>;
const MockTaskExecutor = TaskExecutor as jest.MockedClass<typeof TaskExecutor>;
const MockAnswerGenerator = AnswerGenerator as jest.MockedClass<typeof AnswerGenerator>;

const model = 'gpt-4.1';

/**
 * Creates mock AgentCallbacks with jest mocks for testing
 */
function createMockCallbacks(): AgentCallbacks & {
  onUserQuery: jest.Mock;
  onTasksPlanned: jest.Mock;
  onSubtasksPlanned: jest.Mock;
  onSubTaskStart: jest.Mock;
  onSubTaskComplete: jest.Mock;
  onTaskStart: jest.Mock;
  onTaskComplete: jest.Mock;
  onSpinnerStart: jest.Mock;
  onSpinnerStop: jest.Mock;
  onAnswerStream: jest.Mock;
} {
  return {
    onUserQuery: jest.fn(),
    onTasksPlanned: jest.fn(),
    onSubtasksPlanned: jest.fn(),
    onSubTaskStart: jest.fn(),
    onSubTaskComplete: jest.fn(),
    onTaskStart: jest.fn(),
    onTaskComplete: jest.fn(),
    onSpinnerStart: jest.fn(),
    onSpinnerStop: jest.fn(),
    onAnswerStream: jest.fn(),
  };
}

/**
 * Creates a sample task for testing (UI representation)
 */
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    description: 'Test task',
    done: false,
    ...overrides,
  };
}

/**
 * Creates a planned task for testing
 */
function createPlannedTask(taskId: number = 1): PlannedTask {
  return {
    id: taskId,
    description: 'Test task',
    subTasks: [
      {
        id: 1,
        description: 'Get Apple quarterly income statements for last 4 quarters',
      },
    ],
  };
}

/**
 * Creates a subtask result for testing
 */
function createSubTaskResult(taskId: number = 1, subTaskId: number = 1): SubTaskResult {
  return {
    taskId,
    subTaskId,
    success: true,
  };
}

async function* mockStreamGenerator(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('Agent', () => {
  let mockPlanTasks: jest.Mock;
  let mockExecuteTasks: jest.Mock;
  let mockGenerateAnswer: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup TaskPlanner mock
    mockPlanTasks = jest.fn().mockResolvedValue([]);
    MockTaskPlanner.mockImplementation(() => ({
      planTasks: mockPlanTasks,
    }) as unknown as TaskPlanner);

    // Setup TaskExecutor mock
    mockExecuteTasks = jest.fn().mockResolvedValue([]);
    MockTaskExecutor.mockImplementation(() => ({
      executeTasks: mockExecuteTasks,
    }) as unknown as TaskExecutor);

    // Setup AnswerGenerator mock
    mockGenerateAnswer = jest.fn().mockReturnValue(mockStreamGenerator(['Answer']));
    MockAnswerGenerator.mockImplementation(() => ({
      generateAnswer: mockGenerateAnswer,
    }) as unknown as AnswerGenerator);
  });

  describe('run', () => {
    it('calls onUserQuery callback with query', async () => {
      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(callbacks.onUserQuery).toHaveBeenCalledWith('What is Apple revenue?');
    });

    it('plans tasks and subtasks', async () => {
      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(mockPlanTasks).toHaveBeenCalledWith(
        'What is Apple revenue?',
        expect.any(Object),
        undefined
      );
    });

    it('calls onTasksPlanned callback after planning', async () => {
      const plannedTasks = [createPlannedTask(1), createPlannedTask(2)];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      mockExecuteTasks.mockResolvedValue([createSubTaskResult(1), createSubTaskResult(2)]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      // Tasks are extracted from planned tasks for UI
      expect(callbacks.onTasksPlanned).toHaveBeenCalledWith([
        { id: 1, description: 'Test task', done: false },
        { id: 2, description: 'Test task', done: false },
      ]);
    });

    it('generates answer directly when no tasks are planned', async () => {
      mockPlanTasks.mockResolvedValue([]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What time is it?');

      expect(callbacks.onAnswerStream).toHaveBeenCalled();
      expect(callbacks.onTasksPlanned).not.toHaveBeenCalled();
      expect(mockExecuteTasks).not.toHaveBeenCalled();
    });

    it('calls onSubtasksPlanned callback with planned tasks', async () => {
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      mockExecuteTasks.mockResolvedValue([createSubTaskResult()]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSubtasksPlanned).toHaveBeenCalledWith(plannedTasks);
    });

    it('executes planned tasks using TaskExecutor', async () => {
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      mockExecuteTasks.mockResolvedValue([createSubTaskResult()]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(mockExecuteTasks).toHaveBeenCalledWith(
        plannedTasks,
        expect.any(String), // queryId
        expect.any(Object)  // callbacks
      );
    });

    it('passes subtask complete callback to executor', async () => {
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      
      mockExecuteTasks.mockImplementation((_plannedTasks, _queryId, cbs) => {
        cbs?.onSubTaskComplete?.(1, 1, true);
        return Promise.resolve([createSubTaskResult()]);
      });

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSubTaskComplete).toHaveBeenCalledWith(1, 1, true);
    });

    it('generates answer after execution', async () => {
      const plannedTasks = [createPlannedTask()];
      const subTaskResults = [createSubTaskResult()];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      mockExecuteTasks.mockResolvedValue(subTaskResults);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        'What is Apple revenue?',
        expect.any(String), // queryId
        undefined // messageHistory
      );
      expect(callbacks.onAnswerStream).toHaveBeenCalled();
    });

    it('calls onSpinnerStart and onSpinnerStop during operations', async () => {
      mockPlanTasks.mockResolvedValue([]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSpinnerStart).toHaveBeenCalled();
    });

    it('handles multiple tasks in parallel', async () => {
      const plannedTasks = [
        createPlannedTask(1),
        createPlannedTask(2),
      ];
      const subTaskResults = [
        createSubTaskResult(1),
        createSubTaskResult(2),
      ];
      mockPlanTasks.mockResolvedValue(plannedTasks);
      mockExecuteTasks.mockResolvedValue(subTaskResults);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Compare Apple and Microsoft');

      expect(mockExecuteTasks).toHaveBeenCalledWith(
        plannedTasks,
        expect.any(String),
        expect.any(Object)
      );
      expect(mockGenerateAnswer).toHaveBeenCalledWith(
        'Compare Apple and Microsoft',
        expect.any(String),
        undefined
      );
    });
  });
});
