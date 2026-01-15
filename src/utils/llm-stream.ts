import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getChatModel } from '../model/llm.js';

/**
 * Extract text content from LLM streaming chunk content.
 * Provider-agnostic: handles strings, arrays of content blocks, etc.
 */
export function extractChunkText(content: unknown): string {
  // Direct string content (OpenAI style)
  if (typeof content === 'string') {
    return content;
  }

  // Array of content blocks (Anthropic style and others)
  if (Array.isArray(content)) {
    return content
      .map(block => {
        // Handle { type: 'text', text: '...' } blocks
        if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') {
          return block.text;
        }
        // Handle plain string items in array
        if (typeof block === 'string') {
          return block;
        }
        return '';
      })
      .join('');
  }

  // Object with a text property directly
  if (content && typeof content === 'object' && 'text' in content) {
    const textValue = (content as { text: unknown }).text;
    if (typeof textValue === 'string') {
      return textValue;
    }
  }

  return '';
}

/**
 * Stream LLM response with proper content extraction.
 * Handles different content formats across providers.
 */
export async function* streamLlmResponse(
  prompt: string,
  options: { model: string; systemPrompt: string }
): AsyncGenerator<string> {
  const { model, systemPrompt } = options;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['user', '{prompt}'],
  ]);

  const llm = getChatModel(model, true);
  const chain = promptTemplate.pipe(llm);

  const stream = await chain.stream({ prompt });

  for await (const chunk of stream) {
    if (chunk && typeof chunk === 'object' && 'content' in chunk) {
      const text = extractChunkText(chunk.content);
      if (text) {
        yield text;
      }
    }
  }
}
