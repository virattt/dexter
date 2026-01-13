import { AIMessage } from '@langchain/core/messages';
import { callLlm } from '../model/llm.js';
import { ContextManager } from './context.js';
import { loadSkills, getToolsFromSkills, buildSkillsPromptSection, executeTool } from './skill-loader.js';
import type { AgentConfig, Skill, AgentEvent } from './types.js';

const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Get current date formatted for prompts
 */
function getCurrentDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('en-US', options);
}

/**
 * Build the system prompt with skill information
 */
function buildSystemPrompt(skills: Skill[]): string {
  const skillsSection = buildSkillsPromptSection(skills);
  
  return `You are Dexter, an AI research assistant specialized in financial analysis.

Current date: ${getCurrentDate()}

${skillsSection}

## Guidelines

1. Use the available tools to gather data needed to answer the user's question
2. Be thorough but efficient - call multiple tools if needed
3. When you have enough information, provide a clear, well-structured answer
4. Include specific numbers and data points from your research
5. If a tool fails, try an alternative approach or explain what data is unavailable

## Response Format

When providing your final answer:
- Lead with the key finding
- Include relevant data points
- Be concise but comprehensive
- Cite the sources of your data when applicable`;
}

/**
 * Extract text content from an AIMessage
 */
function extractTextContent(message: AIMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  
  if (Array.isArray(message.content)) {
    return message.content
      .filter(block => typeof block === 'object' && 'type' in block && block.type === 'text')
      .map(block => (block as { text: string }).text)
      .join('\n');
  }
  
  return '';
}

/**
 * Check if an AIMessage has tool calls
 */
function hasToolCalls(message: AIMessage): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

export interface AgentResult {
  /** Final answer text */
  answer: string;
  /** All tool calls made during execution */
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  /** Number of iterations taken */
  iterations: number;
}

/**
 * Run the agent and yield events for real-time UI updates
 */
export async function* runAgent(
  query: string,
  config: AgentConfig
): AsyncGenerator<AgentEvent> {
  const context = new ContextManager();
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  
  // Load skills and tools
  const skills = await loadSkills();
  const systemPrompt = buildSystemPrompt(skills);
  const tools = getToolsFromSkills(skills);
  
  if (tools.length === 0) {
    yield {
      type: 'done',
      answer: 'No tools available. Please check your skills configuration.',
      toolCalls: [],
      iterations: 0,
    };
    return;
  }
  
  const allToolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];
  let currentPrompt = query;
  let iteration = 0;
  
  // Agent loop
  while (iteration < maxIterations) {
    iteration++;
    
    const response = await callLlm(currentPrompt, {
      model: config.model,
      systemPrompt,
      tools,
    }) as AIMessage;
    
    // Extract any thinking/text content
    const thinkingText = extractTextContent(response);
    if (thinkingText && hasToolCalls(response)) {
      // Only emit thinking if there's also tool calls (otherwise it's the final answer)
      yield { type: 'thinking', message: thinkingText };
    }
    
    // Check if model wants to use tools
    if (!hasToolCalls(response)) {
      // No tool calls - this is the final answer
      const answer = thinkingText || 'No response generated.';
      
      yield {
        type: 'done',
        answer,
        toolCalls: allToolCalls,
        iterations: iteration,
      };
      return;
    }
    
    // Execute tool calls
    const toolResults: string[] = [];
    
    for (const toolCall of response.tool_calls!) {
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;
      
      // Emit tool start event
      yield { type: 'tool_start', tool: toolName, args: toolArgs };
      
      const startTime = Date.now();
      
      try {
        const result = await executeTool(toolName, toolArgs);
        const duration = Date.now() - startTime;
        
        context.saveToolResult(toolName, toolArgs, result);
        
        allToolCalls.push({
          tool: toolName,
          args: toolArgs,
          result,
        });
        
        // Emit tool end event
        yield { type: 'tool_end', tool: toolName, args: toolArgs, result, duration };
        
        // Truncate very long results for the prompt
        const truncatedResult = result.length > 2000 
          ? result.slice(0, 2000) + '\n... (truncated)'
          : result;
        
        toolResults.push(`Tool: ${toolName}\nResult: ${truncatedResult}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        yield { type: 'tool_error', tool: toolName, error: errorMessage };
        toolResults.push(`Tool: ${toolName}\nError: ${errorMessage}`);
      }
    }
    
    // Build prompt for next iteration with tool results
    currentPrompt = `Original query: ${query}

Tool results from previous step:
${toolResults.join('\n\n')}

Based on these results, either:
1. Call additional tools if more data is needed
2. Provide your final answer to the user's query`;
  }
  
  // Max iterations reached
  const summary = context.getSummary();
  yield {
    type: 'done',
    answer: `Reached maximum iterations (${maxIterations}). Here's what I found:\n\n${summary}`,
    toolCalls: allToolCalls,
    iterations: iteration,
  };
}
