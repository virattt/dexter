import { Agent, AgentCallbacks } from '../agent/orchestrator.js';
import type { Task, Plan } from '../agent/state.js';
import type { BatchResult, TaskSummary } from './types.js';
import { tasksToSummary } from './types.js';

export interface RunOptions {
  ticker: string;
  query: string;
  model: string;
}

/**
 * Runs the agent headlessly (without UI) and collects all results.
 */
export async function runHeadless(options: RunOptions): Promise<BatchResult> {
  const { ticker, query, model } = options;
  const startTime = new Date();

  // Collect data from callbacks
  const allTasks: Task[] = [];
  let iterations = 0;
  let answerStream: AsyncGenerator<string> | null = null;

  const callbacks: AgentCallbacks = {
    onPlanCreated: (plan: Plan) => {
      // Merge tasks from each iteration
      for (const task of plan.tasks) {
        const existing = allTasks.find(t => t.id === task.id);
        if (existing) {
          Object.assign(existing, task);
        } else {
          allTasks.push({ ...task });
        }
      }
    },

    onTaskUpdate: (taskId: string, status) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        task.status = status;
        if (status === 'in_progress' && !task.startTime) {
          task.startTime = Date.now();
        } else if (status === 'completed' || status === 'failed') {
          task.endTime = Date.now();
        }
      }
    },

    onTaskToolCallsSet: (taskId, toolCalls) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        task.toolCalls = toolCalls;
      }
    },

    onToolCallUpdate: (taskId, toolIndex, status, output, error) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task?.toolCalls?.[toolIndex]) {
        task.toolCalls[toolIndex].status = status;
        if (output) task.toolCalls[toolIndex].output = output;
        if (error) task.toolCalls[toolIndex].error = error;
      }
    },

    onIterationStart: (iteration) => {
      iterations = iteration;
    },

    onAnswerStream: (stream) => {
      answerStream = stream;
    },
  };

  // Run the agent
  const agent = new Agent({ model, callbacks });
  await agent.run(query);

  // Collect the answer from the stream
  let answer = '';
  if (answerStream !== null) {
    const stream = answerStream as AsyncGenerator<string>;
    for await (const chunk of stream) {
      answer += chunk;
    }
  }

  const endTime = new Date();

  return {
    ticker,
    query,
    answer,
    tasks: tasksToSummary(allTasks),
    metadata: {
      model,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
      iterations,
    },
  };
}
