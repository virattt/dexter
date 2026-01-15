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
