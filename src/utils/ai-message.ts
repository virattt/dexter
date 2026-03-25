import { AIMessage } from '@langchain/core/messages';

/**
 * Extract text content from an AIMessage
 */
export function extractTextContent(message: AIMessage): string {
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
export function hasToolCalls(message: AIMessage): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

/**
 * Extract the chain-of-thought reasoning block from an Ollama thinking model response.
 * Ollama stores it in `additional_kwargs.reasoning_content` when `think: true` is enabled.
 * Returns null if absent, empty, or not a string.
 */
export function extractReasoningContent(message: AIMessage): string | null {
  const rc = message.additional_kwargs?.reasoning_content;
  if (typeof rc !== 'string') return null;
  const trimmed = rc.trim();
  return trimmed.length > 0 ? trimmed : null;
}
