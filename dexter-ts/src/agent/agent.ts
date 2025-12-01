import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm, callLlmStream, DEFAULT_MODEL } from '../model/llm.js';
import {
  ACTION_SYSTEM_PROMPT,
  getAnswerSystemPrompt,
  PLANNING_SYSTEM_PROMPT,
  getToolArgsSystemPrompt,
  VALIDATION_SYSTEM_PROMPT,
  META_VALIDATION_SYSTEM_PROMPT,
} from './prompts.js';
import {
  Task,
  TaskListSchema,
  IsDoneSchema,
  OptimizedToolArgsSchema,
} from './schemas.js';
import { TOOLS } from '../tools/index.js';
import { ContextManager } from '../utils/context.js';

export interface AgentCallbacks {
  onUserQuery?: (query: string) => void;
  onTaskList?: (tasks: Task[]) => void;
  onTaskStart?: (description: string) => void;
  onTaskDone?: (description: string) => void;
  onToolRun?: (params: Record<string, unknown>, result: string) => void;
  onLog?: (message: string) => void;
  onSpinnerStart?: (message: string) => void;
  onSpinnerStop?: (message: string, success: boolean) => void;
  onAnswerStream?: (stream: AsyncGenerator<string>) => void;
  onAnswerComplete?: (answer: string) => void;
}

interface TaskExecutionState {
  stepCount: number;
  lastActions: string[];
  taskOutputSummaries: string[];
}

export class Agent {
  private maxSteps: number;
  private maxStepsPerTask: number;
  private model: string;
  private contextManager: ContextManager;
  private callbacks: AgentCallbacks;

  constructor(options: {
      maxSteps?: number;
      maxStepsPerTask?: number;
      model?: string;
      callbacks?: AgentCallbacks;
  } = {}) {
    this.maxSteps = options.maxSteps ?? 20;
    this.maxStepsPerTask = options.maxStepsPerTask ?? 5;
    this.model = options.model ?? DEFAULT_MODEL;
    this.contextManager = new ContextManager('.dexter/context', this.model);
    this.callbacks = options.callbacks ?? {};
  }

  private log(message: string): void {
    this.callbacks.onLog?.(message);
  }

  private async withProgress<T>(message: string, successMessage: string, fn: () => Promise<T>): Promise<T> {
    this.callbacks.onSpinnerStart?.(message);
    try {
      const result = await fn();
      this.callbacks.onSpinnerStop?.(successMessage || message.replace('...', ' ✓'), true);
      return result;
    } catch (e) {
      this.callbacks.onSpinnerStop?.(`Failed: ${e}`, false);
      throw e;
    }
  }

  async planTasks(query: string): Promise<Task[]> {
    return this.withProgress('Planning tasks...', 'Tasks planned', async () => {
      const toolDescriptions = TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n');
      const prompt = `
      Given the user query: "${query}",
      Create a list of tasks to be completed.
      Example: {"tasks": [{"id": 1, "description": "some task", "done": false}]}
      `;
      const systemPrompt = PLANNING_SYSTEM_PROMPT.replace('{tools}', toolDescriptions);

      try {
        const response = await callLlm(prompt, {
          systemPrompt,
          outputSchema: TaskListSchema,
          model: this.model,
        });
        const tasks = (response as { tasks: Task[] }).tasks;
        this.callbacks.onTaskList?.(tasks);
        return tasks;
      } catch (e) {
        this.log(`Planning failed: ${e}`);
        const fallbackTasks = [{ id: 1, description: query, done: false }];
        this.callbacks.onTaskList?.(fallbackTasks);
        return fallbackTasks;
      }
    });
  }

  private async askForActions(taskDesc: string, lastOutputs: string = ''): Promise<AIMessage> {
    return this.withProgress('Thinking...', '', async () => {
      const prompt = `
      We are working on: "${taskDesc}".
      Here is a history of tool outputs from the session so far: ${lastOutputs}

      Based on the task and the outputs, what should be the next step?
      `;

      try {
        const response = await callLlm(prompt, {
          systemPrompt: ACTION_SYSTEM_PROMPT,
          tools: TOOLS as StructuredToolInterface[],
          model: this.model,
        });
        return response as AIMessage;
      } catch (e) {
        this.log(`askForActions failed: ${e}`);
        return new AIMessage({ content: 'Failed to get actions.' });
      }
    });
  }

  private async askIfDone(taskDesc: string, recentResults: string): Promise<boolean> {
    return this.withProgress('Checking if task is complete...', '', async () => {
      const prompt = `
      We were trying to complete the task: "${taskDesc}".
      Here is a history of tool outputs from the session so far: ${recentResults}

      Is the task done?
      `;

      try {
        const response = await callLlm(prompt, {
          systemPrompt: VALIDATION_SYSTEM_PROMPT,
          outputSchema: IsDoneSchema,
          model: this.model,
        });
        return (response as { done: boolean }).done;
      } catch {
        return false;
      }
    });
  }

  private async isGoalAchieved(query: string, taskOutputs: string[], tasks: Task[]): Promise<boolean> {
    return this.withProgress('Checking if main goal is achieved...', '', async () => {
      const allResults = taskOutputs.length > 0 ? taskOutputs.join('\n\n') : 'No data collected yet.';
      const tasksInfo = tasks.map((task) => {
        const status = task.done ? '✓ Done' : '✗ Not done';
        return `- [${status}] ${task.description}`;
      });
      const tasksSummary = tasksInfo.length > 0 ? tasksInfo.join('\n') : 'No tasks were planned.';

      const prompt = `
      Original user query: "${query}"
      
      Planned tasks (for cross-reference only - not a hard requirement):
      ${tasksSummary}
      
      Data and results collected from tools so far:
      ${allResults}
      
      Based on the data above, is the original user query sufficiently answered?
      Use the tasks as a helpful cross-reference, but prioritize whether the query itself is answered.
      `;

      try {
        const response = await callLlm(prompt, {
          systemPrompt: META_VALIDATION_SYSTEM_PROMPT,
          outputSchema: IsDoneSchema,
          model: this.model,
        });
        return (response as { done: boolean }).done;
      } catch (e) {
        this.log(`Meta-validation failed: ${e}`);
        return false;
      }
    });
  }

  private async optimizeToolArgs(
    toolName: string,
    initialArgs: Record<string, unknown>,
    taskDesc: string
  ): Promise<Record<string, unknown>> {
    return this.withProgress('Optimizing tool call...', '', async () => {
      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) return initialArgs;

      const prompt = `
      Task: "${taskDesc}"
      Tool: ${toolName}
      Tool Description: ${tool.description}
      Tool Parameters: ${tool.schema ? JSON.stringify(tool.schema) : '{}'}
      Initial Arguments: ${JSON.stringify(initialArgs)}
      
      Review the task and optimize the arguments to ensure all relevant parameters are used correctly.
      Pay special attention to filtering parameters that would help narrow down results to match the task.
      `;

      try {
        const response = await callLlm(prompt, {
          systemPrompt: getToolArgsSystemPrompt(),
          outputSchema: OptimizedToolArgsSchema,
          model: this.model,
        });

        if (typeof response === 'object' && response !== null && 'arguments' in response) {
          return (response as { arguments: Record<string, unknown> }).arguments || initialArgs;
        }
        return initialArgs;
      } catch (e) {
        this.log(`Argument optimization failed: ${e}, using original args`);
        return initialArgs;
      }
    });
  }

  private async executeTool(
    tool: StructuredToolInterface,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    return this.withProgress(`Executing ${toolName}...`, '', async () => {
      const result = await tool.invoke(args);
      return typeof result === 'string' ? result : JSON.stringify(result);
    });
  }

  private isRepeatingAction(lastActions: string[]): boolean {
    return lastActions.length === 4 && new Set(lastActions).size === 1;
  }

  private trackAction(actionSig: string, lastActions: string[]): void {
    lastActions.push(actionSig);
    if (lastActions.length > 4) {
      lastActions.shift();
    }
  }

  private async executeToolCall(
    toolCall: { name: string; args: unknown },
    task: Task,
    state: TaskExecutionState,
    taskStepSummaries: string[]
  ): Promise<boolean> {
    const toolName = toolCall.name;
    const initialArgs = toolCall.args as Record<string, unknown>;
    const optimizedArgs = await this.optimizeToolArgs(toolName, initialArgs, task.description);

    const actionSig = `${toolName}:${JSON.stringify(optimizedArgs)}`;
    this.trackAction(actionSig, state.lastActions);

    if (this.isRepeatingAction(state.lastActions)) {
      this.log('Detected repeating action — aborting to avoid loop.');
      return true; // Signal to abort
    }

    const toolToRun = TOOLS.find((t) => t.name === toolName);
    if (!toolToRun) {
      this.log(`Invalid tool: ${toolName}`);
      return false;
    }

    try {
      const result = await this.executeTool(toolToRun as StructuredToolInterface, toolName, optimizedArgs);
      this.callbacks.onToolRun?.(optimizedArgs, result);

      await this.contextManager.saveContext(toolName, optimizedArgs, result, task.id);

      const pointer = this.contextManager.pointers[this.contextManager.pointers.length - 1];
      const summary = `Output of ${toolName} with args ${JSON.stringify(optimizedArgs)}: ${pointer.summary}`;
      state.taskOutputSummaries.push(summary);
      taskStepSummaries.push(summary);
    } catch (e) {
      this.log(`Tool execution failed: ${e}`);
      const errorSummary = `Error from ${toolName} with args ${JSON.stringify(optimizedArgs)}: ${e}`;
      state.taskOutputSummaries.push(errorSummary);
      taskStepSummaries.push(errorSummary);
      }

    state.stepCount++;
    return false;
  }

  private async executeTask(
    task: Task,
    query: string,
    state: TaskExecutionState
  ): Promise<'continue' | 'abort' | 'goal_achieved'> {
      this.callbacks.onTaskStart?.(task.description);

      let perTaskSteps = 0;
      const taskStepSummaries: string[] = [];

      while (perTaskSteps < this.maxStepsPerTask) {
      if (state.stepCount >= this.maxSteps) {
          this.log('Global max steps reached — stopping.');
        return 'abort';
        }

        const aiMessage = await this.askForActions(task.description, taskStepSummaries.join('\n'));

        if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
          task.done = true;
          this.callbacks.onTaskDone?.(task.description);
          break;
        }

        for (const toolCall of aiMessage.tool_calls) {
        if (state.stepCount >= this.maxSteps) break;

        const shouldAbort = await this.executeToolCall(toolCall, task, state, taskStepSummaries);
        if (shouldAbort) return 'abort';

          perTaskSteps++;
        }

        if (await this.askIfDone(task.description, taskStepSummaries.join('\n'))) {
          task.done = true;
          this.callbacks.onTaskDone?.(task.description);
          break;
        }
      }

    if (task.done && (await this.isGoalAchieved(query, state.taskOutputSummaries, []))) {
        this.log('Main goal achieved. Finalizing answer.');
      return 'goal_achieved';
    }

    return 'continue';
  }

  async run(query: string): Promise<string> {
    this.callbacks.onUserQuery?.(query);

    const tasks = await this.planTasks(query);
    if (tasks.length === 0) {
      return await this.generateAnswer(query);
    }

    const state: TaskExecutionState = {
      stepCount: 0,
      lastActions: [],
      taskOutputSummaries: [],
    };

    while (tasks.some((t) => !t.done)) {
      if (state.stepCount >= this.maxSteps) {
        this.log('Global max steps reached — aborting to avoid runaway loop.');
        break;
      }

      const task = tasks.find((t) => !t.done)!;
      const result = await this.executeTask(task, query, state);

      if (result === 'abort' || result === 'goal_achieved') {
        break;
      }
    }

    return await this.generateAnswer(query);
  }

  private async generateAnswer(query: string): Promise<string> {
    const allPointers = this.contextManager.getAllPointers();

    let answerPrompt: string;

    if (allPointers.length === 0) {
      answerPrompt = `
      Original user query: "${query}"
      
      No data was collected from tools.
      `;
    } else {
      const selectedFilepaths = await this.contextManager.selectRelevantContexts(query, allPointers);
      const selectedContexts = this.contextManager.loadContexts(selectedFilepaths);

      const formattedResults = selectedContexts.map((ctx) => {
        const toolName = ctx.tool_name || 'unknown';
        const args = ctx.args || {};
        const result = ctx.result || {};
        return `Output of ${toolName} with args ${JSON.stringify(args)}:\n${JSON.stringify(result)}`;
      });

      const allResults = formattedResults.length > 0
        ? formattedResults.join('\n\n')
        : 'No relevant data was selected.';

      answerPrompt = `
      Original user query: "${query}"
      
      Data and results collected from tools:
      ${allResults}
      
      Based on the data above, provide a comprehensive answer to the user's query.
      Include specific numbers, calculations, and insights.
      `;
    }

    const stream = callLlmStream(answerPrompt, {
      systemPrompt: getAnswerSystemPrompt(),
      model: this.model,
    });

    this.callbacks.onAnswerStream?.(stream);
    return '';
  }
}
