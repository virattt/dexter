import { Agent, AgentCallbacks } from '../agent.js';
import { Task, PlannedTask, SubTaskResult } from '../schemas.js';

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
 * Creates a sample task for testing
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
    task: createTask({ id: taskId }),
    subTasks: [
      {
        id: 1,
        description: 'Retrieve income statements for Apple (AAPL)',
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
  let mockPlanSubtasks: jest.Mock;
  let mockExecuteAll: jest.Mock;
  let mockGenerateFromResults: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup TaskPlanner mock
    mockPlanTasks = jest.fn().mockResolvedValue([]);
    mockPlanSubtasks = jest.fn().mockResolvedValue([]);
    MockTaskPlanner.mockImplementation(() => ({
      planTasks: mockPlanTasks,
      planSubtasks: mockPlanSubtasks,
    }) as unknown as TaskPlanner);

    // Setup TaskExecutor mock
    mockExecuteAll = jest.fn().mockResolvedValue([]);
    MockTaskExecutor.mockImplementation(() => ({
      executeAll: mockExecuteAll,
    }) as unknown as TaskExecutor);

    // Setup AnswerGenerator mock
    mockGenerateFromResults = jest.fn().mockReturnValue(mockStreamGenerator(['Answer']));
    MockAnswerGenerator.mockImplementation(() => ({
      generateAnswer: mockGenerateFromResults,
    }) as unknown as AnswerGenerator);
  });

  describe('run', () => {
    it('calls onUserQuery callback with query', async () => {
      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(callbacks.onUserQuery).toHaveBeenCalledWith('What is Apple revenue?');
    });

    it('plans tasks based on query', async () => {
      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(mockPlanTasks).toHaveBeenCalledWith('What is Apple revenue?', expect.any(Object));
    });

    it('calls onTasksPlanned callback after planning tasks', async () => {
      const tasks = [createTask({ id: 1 }), createTask({ id: 2 })];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue([createPlannedTask(1), createPlannedTask(2)]);
      mockExecuteAll.mockResolvedValue([createSubTaskResult(1), createSubTaskResult(2)]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onTasksPlanned).toHaveBeenCalledWith(tasks);
    });

    it('generates answer directly when no tasks are planned', async () => {
      mockPlanTasks.mockResolvedValue([]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What time is it?');

      expect(callbacks.onAnswerStream).toHaveBeenCalled();
      expect(callbacks.onTasksPlanned).not.toHaveBeenCalled();
      expect(mockPlanSubtasks).not.toHaveBeenCalled();
      expect(mockExecuteAll).not.toHaveBeenCalled();
    });

    it('plans subtasks for tasks using TaskPlanner', async () => {
      const tasks = [createTask()];
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      mockExecuteAll.mockResolvedValue([createSubTaskResult()]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(mockPlanSubtasks).toHaveBeenCalledWith(tasks, expect.any(Object));
    });

    it('calls onSubtasksPlanned callback after planning subtasks', async () => {
      const tasks = [createTask()];
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      mockExecuteAll.mockResolvedValue([createSubTaskResult()]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSubtasksPlanned).toHaveBeenCalledWith(plannedTasks);
    });

    it('executes planned tasks using TaskExecutor', async () => {
      const tasks = [createTask()];
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      mockExecuteAll.mockResolvedValue([createSubTaskResult()]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(mockExecuteAll).toHaveBeenCalledWith(plannedTasks, expect.any(Object));
    });

    it('passes subtask complete callback to executor', async () => {
      const tasks = [createTask()];
      const plannedTasks = [createPlannedTask()];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      
      mockExecuteAll.mockImplementation((_plannedTasks, cbs) => {
        cbs?.onSubTaskComplete?.(1, 1, true);
        return Promise.resolve([createSubTaskResult()]);
      });

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSubTaskComplete).toHaveBeenCalledWith(1, 1, true);
    });

    it('generates answer from subtask results', async () => {
      const tasks = [createTask()];
      const plannedTasks = [createPlannedTask()];
      const subTaskResults = [createSubTaskResult()];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      mockExecuteAll.mockResolvedValue(subTaskResults);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('What is Apple revenue?');

      expect(mockGenerateFromResults).toHaveBeenCalledWith('What is Apple revenue?');
      expect(callbacks.onAnswerStream).toHaveBeenCalled();
    });

    it('calls onSpinnerStart and onSpinnerStop during operations', async () => {
      mockPlanTasks.mockResolvedValue([]);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Query');

      expect(callbacks.onSpinnerStart).toHaveBeenCalled();
      expect(callbacks.onSpinnerStop).toHaveBeenCalled();
    });

    it('calls onSpinnerStop with failure message on error', async () => {
      mockPlanTasks.mockRejectedValue(new Error('Planning failed'));

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await expect(agent.run('Query')).rejects.toThrow('Planning failed');

      expect(callbacks.onSpinnerStop).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        false
      );
    });

    it('handles multiple tasks in parallel', async () => {
      const tasks = [
        createTask({ id: 1 }),
        createTask({ id: 2 }),
      ];
      const plannedTasks = [
        createPlannedTask(1),
        createPlannedTask(2),
      ];
      const subTaskResults = [
        createSubTaskResult(1),
        createSubTaskResult(2),
      ];
      mockPlanTasks.mockResolvedValue(tasks);
      mockPlanSubtasks.mockResolvedValue(plannedTasks);
      mockExecuteAll.mockResolvedValue(subTaskResults);

      const callbacks = createMockCallbacks();
      const agent = new Agent({ model, callbacks });

      await agent.run('Compare Apple and Microsoft');

      expect(mockPlanSubtasks).toHaveBeenCalledWith(tasks, expect.any(Object));
      expect(mockExecuteAll).toHaveBeenCalledWith(plannedTasks, expect.any(Object));
      expect(mockGenerateFromResults).toHaveBeenCalledWith('Compare Apple and Microsoft');
    });
  });
});
