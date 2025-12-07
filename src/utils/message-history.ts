import { callLlm, DEFAULT_MODEL } from '../model/llm.js';
import { MESSAGE_SUMMARY_SYSTEM_PROMPT, MESSAGE_SELECTION_SYSTEM_PROMPT } from '../agent/prompts.js';
import { z } from 'zod';

/**
 * Represents a single conversation turn (query + answer + summary)
 */
export interface Message {
  id: number;
  query: string;
  answer: string;
  summary: string; // LLM-generated summary of the answer
}

/**
 * Schema for LLM to select relevant messages
 */
export const SelectedMessagesSchema = z.object({
  message_ids: z.array(z.number()).describe('List of relevant message IDs (0-indexed)'),
});

/**
 * Manages in-memory conversation history for multi-turn conversations.
 * Stores user queries, final answers, and LLM-generated summaries.
 * Follows a similar pattern to ToolContextManager: save with summary, select relevant, load full content.
 */
export class MessageHistory {
  private messages: Message[] = [];
  private model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  /**
   * Updates the model used for LLM calls (e.g., when user switches models)
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Generates a brief summary of an answer for later relevance matching
   */
  private async generateSummary(query: string, answer: string): Promise<string> {
    const answerPreview = answer.slice(0, 1500); // Limit for prompt size

    const prompt = `Query: "${query}"
Answer: "${answerPreview}"

Generate a brief 1-2 sentence summary of this answer.`;

    try {
      const response = await callLlm(prompt, {
        systemPrompt: MESSAGE_SUMMARY_SYSTEM_PROMPT,
        model: this.model,
      });
      return typeof response === 'string' ? response.trim() : String(response).trim();
    } catch {
      // Fallback to a simple summary if LLM fails
      return `Answer to: ${query.slice(0, 100)}`;
    }
  }

  /**
   * Adds a new conversation turn to history with an LLM-generated summary
   */
  async addMessage(query: string, answer: string): Promise<void> {
    const summary = await this.generateSummary(query, answer);
    this.messages.push({
      id: this.messages.length,
      query,
      answer,
      summary,
    });
  }

  /**
   * Uses LLM to select which messages are relevant to the current query
   */
  async selectRelevantMessages(currentQuery: string): Promise<Message[]> {
    if (this.messages.length === 0) {
      return [];
    }

    const messagesInfo = this.messages.map((message) => ({
      id: message.id,
      query: message.query,
      summary: message.summary,
    }));

    const prompt = `Current user query: "${currentQuery}"

Previous conversations:
${JSON.stringify(messagesInfo, null, 2)}

Select which previous messages are relevant to understanding or answering the current query.`;

    try {
      const response = await callLlm(prompt, {
        systemPrompt: MESSAGE_SELECTION_SYSTEM_PROMPT,
        model: this.model,
        outputSchema: SelectedMessagesSchema,
      });

      const selectedIds = (response as { message_ids: number[] }).message_ids || [];

      return selectedIds
        .filter((idx) => idx >= 0 && idx < this.messages.length)
        .map((idx) => this.messages[idx]);
    } catch {
      // On failure, return empty (don't inject potentially irrelevant context)
      return [];
    }
  }

  /**
   * Formats selected messages for task planning (queries + summaries only, lightweight)
   */
  formatForPlanning(messages: Message[]): string {
    if (messages.length === 0) {
      return '';
    }

    return messages
      .map((message) => `User: ${message.query}\nAssistant: ${message.summary}`)
      .join('\n\n');
  }

  /**
   * Formats selected messages for answer generation (queries + full answers)
   */
  formatForAnswerGeneration(messages: Message[]): string {
    if (messages.length === 0) {
      return '';
    }

    return messages
      .map((message) => `User: ${message.query}\nAssistant: ${message.answer}`)
      .join('\n\n');
  }

  /**
   * Returns all messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Returns true if there are any messages
   */
  hasMessages(): boolean {
    return this.messages.length > 0;
  }

  /**
   * Clears all messages
   */
  clear(): void {
    this.messages = [];
  }
}
