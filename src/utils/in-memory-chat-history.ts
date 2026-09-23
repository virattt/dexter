import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import { callLlm, DEFAULT_MODEL } from '../model/llm.js';
import { resolveProvider } from '../providers.js';

const DEFAULT_HISTORY_LIMIT = 10;
const FULL_ANSWER_TURNS = 3;

/**
 * Represents a single conversation turn (query + answer + summary)
 */
export interface Message {
  id: number;
  query: string;
  /** User messages picked up from the queue mid-run. Answered together with `query`. */
  followUps: string[];
  answer: string | null;   // null until answer completes
  summary: string | null;  // LLM-generated summary, null until answer arrives
}

/**
 * System prompt for generating message summaries
 */
const MESSAGE_SUMMARY_SYSTEM_PROMPT = `You are a concise summarizer. Generate brief summaries of conversation answers.
Keep summaries to 1-2 sentences that capture the key information.`;

/**
 * Manages in-memory conversation history for multi-turn conversations.
 * Stores user queries, final answers, and LLM-generated summaries.
 */
export class InMemoryChatHistory {
  private messages: Message[] = [];
  private model: string;
  private readonly maxTurns: number;

  constructor(model: string = DEFAULT_MODEL, maxTurns: number = DEFAULT_HISTORY_LIMIT) {
    this.model = model;
    this.maxTurns = maxTurns;
  }

  /**
   * Updates the model used for LLM calls (e.g., when user switches models)
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Generates a brief summary of an answer for later context injection
   */
  private async generateSummary(query: string, answer: string): Promise<string> {
    const answerPreview = answer.slice(0, 1500);

    const prompt = `Query: "${query}"
Answer: "${answerPreview}"

Generate a brief 1-2 sentence summary of this answer.`;

    try {
      const { response } = await callLlm(prompt, {
        systemPrompt: MESSAGE_SUMMARY_SYSTEM_PROMPT,
        model: this.model,
      });
      return typeof response === 'string' ? response.trim() : String(response).trim();
    } catch {
      return `Answer to: ${query.slice(0, 100)}`;
    }
  }

  /**
   * Saves a new user query to history immediately (before answer is available).
   */
  saveUserQuery(query: string): void {
    this.messages.push({
      id: this.messages.length,
      query,
      followUps: [],
      answer: null,
      summary: null,
    });
  }

  /** Every user message of a turn, in the order the model saw them. */
  private userMessagesOf(message: Message): string[] {
    return [message.query, ...message.followUps];
  }

  /**
   * Records a follow-up the agent picked up from the queue mid-run as its own
   * user message on the open turn, so /compact, history, and summaries see it.
   */
  addFollowUpToOpenTurn(text: string): void {
    const lastMessage = this.messages[this.messages.length - 1];
    if (!lastMessage || lastMessage.answer !== null) {
      return;
    }
    lastMessage.followUps.push(text);
  }

  /**
   * Saves the answer to the most recent message and generates a summary.
   */
  async saveAnswer(answer: string): Promise<void> {
    const lastMessage = this.messages[this.messages.length - 1];
    if (!lastMessage || lastMessage.answer !== null) {
      return;
    }

    lastMessage.answer = answer;
    lastMessage.summary = await this.generateSummary(this.userMessagesOf(lastMessage).join('\n\n'), answer);
  }

  /**
   * Returns all messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Returns recent completed turns as proper LangChain BaseMessage objects.
   * Recent turns get full answers; older turns get summaries.
   */
  getRecentTurnsAsMessages(limit: number = this.maxTurns): BaseMessage[] {
    const boundedLimit = Math.max(0, limit);
    if (boundedLimit === 0) {
      return [];
    }

    const completedMessages = this.messages.filter((message) => message.answer !== null);
    const recentMessages = completedMessages.slice(-boundedLimit);

    return recentMessages.flatMap((message, index) => {
      const isRecentTurn = index >= recentMessages.length - FULL_ANSWER_TURNS;
      const assistantContent = isRecentTurn
        ? message.answer
        : (message.summary ?? message.answer);

      return [
        ...this.userMessagesOf(message).map((text) => new HumanMessage(text)),
        new AIMessage(assistantContent ?? ''),
      ];
    });
  }

  /**
   * Returns true if there are any messages
   */
  hasMessages(): boolean {
    return this.messages.length > 0;
  }

  /**
   * Removes the last message from history.
   * Used to prune HEARTBEAT_OK turns that add no conversational value.
   */
  pruneLastTurn(): void {
    if (this.messages.length > 0) {
      this.messages.pop();
    }
  }

  /**
   * Summarize all history into a single synthetic turn, freeing context.
   */
  async compact(customInstructions?: string): Promise<string> {
    const completed = this.messages.filter(m => m.answer !== null);
    if (completed.length < 2) {
      throw new Error('Not enough history to compact.');
    }

    const transcript = completed
      .map(m => `${this.userMessagesOf(m).map((text) => `User: ${text}`).join('\n')}\nAssistant: ${m.summary ?? m.answer}`)
      .join('\n\n');

    const provider = resolveProvider(this.model);
    const fastModel = provider.fastModel ?? this.model;

    const prompt = [
      customInstructions
        ? `Summarize this conversation. Additional instructions: ${customInstructions}`
        : 'Summarize this conversation.',
      'Preserve key facts, numbers, decisions, and open questions.',
      'Be concise but do not drop important details.\n',
      transcript,
    ].join('\n');

    const { response } = await callLlm(prompt, {
      model: fastModel,
      systemPrompt: 'You are a concise summarizer. Produce a structured summary of the conversation.',
    });

    const summary = typeof response === 'string' ? response.trim() : String(response).trim();

    this.messages = [{
      id: 0,
      query: '[Compacted conversation]',
      followUps: [],
      answer: summary,
      summary,
    }];

    return summary;
  }

  /**
   * Clears all messages
   */
  clear(): void {
    this.messages = [];
  }
}
