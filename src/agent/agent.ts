import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { createLLM } from '../model/llm.js';
import { getTools } from '../tools/registry.js';
import { loadSoulDocument, buildSystemPrompt, buildIterationPrompt } from './prompts.js';
import { createRunContext } from './run-context.js';
import { AgentToolExecutor } from './tool-executor.js';
import type { AgentConfig, AgentEvent } from './types.js';
import type { InMemoryChatHistory } from '../utils/in-memory-chat-history.js';

/**
 * High-level AI Agent that executes research queries via an iterative loop.
 */
export class Agent {
  private constructor(
    private readonly llm: BaseChatModel,
    private readonly toolMap: Map<string, StructuredToolInterface>,
    private readonly config: AgentConfig
  ) { }

  /**
   * Create a new Agent instance.
   */
  static async create(config: AgentConfig = {}): Promise<Agent> {
    const model = config.model || process.env.DEFAULT_MODEL || 'gpt-4o';
    const provider = config.modelProvider || process.env.DEFAULT_PROVIDER || 'openai';

    // Model initialization
    const llm = createLLM({
      model,
      provider,
      apiKeys: config.apiKeys,
    });

    // Tool initialization - propagate API keys for tool specialized providers (e.g. Alpha Vantage)
    const toolList = await getTools(model, config.apiKeys);
    const toolMap = new Map(toolList.map((t) => [t.name, t]));

    return new Agent(llm, toolMap, config);
  }

  /**
   * Run the agent on a user query, yielding real-time events.
   */
  async *run(query: string, history?: InMemoryChatHistory): AsyncGenerator<AgentEvent, void> {
    const ctx = createRunContext(query);
    const soulContent = await loadSoulDocument();

    // Build initial system prompt
    const systemPrompt = buildSystemPrompt(this.config.model || 'gpt-4o', soulContent);
    const maxIterations = this.config.maxIterations ?? 10;
    const startTime = Date.now();

    const toolExecutor = new AgentToolExecutor(
      this.toolMap,
      this.config.signal,
      this.config.requestToolApproval,
      this.config.sessionApprovedTools
    );

    while (ctx.iteration < maxIterations) {
      ctx.iteration++;

      // Check for cancellation
      if (this.config.signal?.aborted) {
        throw new Error('Agent execution cancelled');
      }

      // Build context (system + history + tool results)
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
      ];

      // Inject chat history if available
      if (history) {
        for (const turn of history.getRecentTurns()) {
          if (turn.role === 'user') {
            messages.push(new HumanMessage(turn.content));
          } else {
            messages.push(new AIMessage(turn.content));
          }
        }
      }

      // Add current iteration prompt
      messages.push(new HumanMessage(buildIterationPrompt(
        ctx.query,
        ctx.scratchpad.getToolResults(),
        ctx.scratchpad.formatToolUsageForPrompt()
      )));

      yield { type: 'thinking', message: ctx.iteration === 1 ? 'Analyzing query...' : 'Analyzing results...' };

      // Call LLM
      const response = await this.llm.invoke(messages, { signal: this.config.signal });

      // Handle raw thinking/reasoning if present
      if (response.content) {
        const thought = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        ctx.scratchpad.addThinking(thought);
      }

      // Check for tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // Execute all tool calls in the response
        yield* toolExecutor.executeAll(response, ctx);
        // Continue to next iteration to process tool results
        continue;
      }

      // No tool calls -> work done, final answer reached
      const totalTime = Date.now() - startTime;
      const answer = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      yield {
        type: 'done',
        answer,
        toolCalls: ctx.scratchpad.getToolCallRecords(),
        iterations: ctx.iteration,
        totalTime,
        tokenUsage: response.additional_kwargs?.tokenUsage as any,
      };
      return;
    }

    // Hit max iterations without final answer
    yield {
      type: 'done',
      answer: "I've reached the maximum number of attempts and couldn't find a final answer. Here is the information I gathered so far: \n\n" + ctx.scratchpad.getToolResults(),
      toolCalls: ctx.scratchpad.getToolCallRecords(),
      iterations: ctx.iteration,
      totalTime: Date.now() - startTime,
    };
  }
}
