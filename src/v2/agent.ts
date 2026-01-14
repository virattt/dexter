import { AIMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { callLlm } from '../model/llm.js';
import { ContextManager } from './context.js';
import { loadSkills, getToolsFromSkills, buildSkillsPromptSection, executeTool } from './skill-loader.js';
import { buildSystemPrompt, buildIterationPrompt } from './prompts.js';
import { extractTextContent, hasToolCalls } from './utils/ai-message.js';
import type { AgentConfig, Skill, AgentEvent, ToolStartEvent, ToolEndEvent, ToolErrorEvent } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 10;

// ============================================================================
// Internal Types
// ============================================================================

interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

interface ToolExecutionResult {
  record: ToolCallRecord;
  promptEntry: string;
}

interface ToolCallsExecutionResult {
  records: ToolCallRecord[];
  promptEntries: string[];
}

/**
 * Agent - A simple ReAct-style agent that uses skills/tools to answer queries.
 *
 * Architecture:
 * 1. Load skills and build system prompt (via factory method)
 * 2. Agent loop: Call LLM -> Execute tools -> Repeat until done
 * 3. Yield events for real-time UI updates
 *
 * Usage:
 *   const agent = await Agent.create({ model: 'gpt-4o' });
 *   for await (const event of agent.run(query)) { ... }
 */
export class Agent {
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly contextManager: ContextManager;
  private readonly skills: Skill[];
  private readonly tools: StructuredToolInterface[];
  private readonly systemPrompt: string;

  private constructor(
    config: AgentConfig,
    skills: Skill[],
    tools: StructuredToolInterface[],
    systemPrompt: string
  ) {
    this.model = config.model ?? 'gpt-4o';
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.contextManager = new ContextManager();
    this.skills = skills;
    this.tools = tools;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Create a new Agent instance with loaded skills and tools.
   */
  static async create(config: AgentConfig = {}): Promise<Agent> {
    const skills = await loadSkills();
    const tools = getToolsFromSkills(skills);
    const skillsSection = buildSkillsPromptSection(skills);
    const systemPrompt = buildSystemPrompt(skillsSection);
    return new Agent(config, skills, tools, systemPrompt);
  }

  /**
   * Run the agent and yield events for real-time UI updates
   */
  async *run(query: string): AsyncGenerator<AgentEvent> {
    if (this.tools.length === 0) {
      yield { type: 'done', answer: 'No tools available. Please check your skills configuration.', toolCalls: [], iterations: 0 };
      return;
    }

    const allToolCalls: ToolCallRecord[] = [];
    let currentPrompt = query;
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.callModel(currentPrompt);
      const thinkingText = extractTextContent(response);

      // Emit thinking if there are also tool calls
      if (thinkingText && hasToolCalls(response)) {
        yield { type: 'thinking', message: thinkingText };
      }

      // No tool calls = final answer
      if (!hasToolCalls(response)) {
        yield { type: 'done', answer: thinkingText || 'No response generated.', toolCalls: allToolCalls, iterations: iteration };
        return;
      }

      // Execute tools and collect results
      const generator = this.executeToolCalls(response);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      allToolCalls.push(...result.value.records);
      currentPrompt = buildIterationPrompt(query, result.value.promptEntries);
    }

    // Max iterations reached
    const summary = this.contextManager.getSummary();
    yield {
      type: 'done',
      answer: `Reached maximum iterations (${this.maxIterations}). Here's what I found:\n\n${summary}`,
      toolCalls: allToolCalls,
      iterations: iteration
    };
  }

  /**
   * Call the LLM with the current prompt
   */
  private async callModel(prompt: string): Promise<AIMessage> {
    return await callLlm(prompt, {
      model: this.model,
      systemPrompt: this.systemPrompt,
      tools: this.tools,
    }) as AIMessage;
  }

  /**
   * Execute all tool calls from an LLM response
   */
  private async *executeToolCalls(
    response: AIMessage
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, ToolCallsExecutionResult> {
    const records: ToolCallRecord[] = [];
    const promptEntries: string[] = [];

    for (const toolCall of response.tool_calls!) {
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;

      const generator = this.executeToolCall(toolName, toolArgs);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      records.push(result.value.record);
      promptEntries.push(result.value.promptEntry);
    }

    return { records, promptEntries };
  }

  /**
   * Execute a single tool call and yield start/end/error events
   */
  private async *executeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>
  ): AsyncGenerator<ToolStartEvent | ToolEndEvent | ToolErrorEvent, ToolExecutionResult> {
    yield { type: 'tool_start', tool: toolName, args: toolArgs };

    const startTime = Date.now();

    try {
      const result = await executeTool(toolName, toolArgs);
      const duration = Date.now() - startTime;

      this.contextManager.saveToolResult(toolName, toolArgs, result);

      yield { type: 'tool_end', tool: toolName, args: toolArgs, result, duration };

      return {
        record: { tool: toolName, args: toolArgs, result },
        promptEntry: `Tool: ${toolName}\nResult: ${result}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'tool_error', tool: toolName, error: errorMessage };

      return {
        record: { tool: toolName, args: toolArgs, result: `Error: ${errorMessage}` },
        promptEntry: `Tool: ${toolName}\nError: ${errorMessage}`,
      };
    }
  }
}
