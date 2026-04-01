import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import { callLlm, DEFAULT_MODEL } from '../model/llm.js';

const DEFAULT_HISTORY_LIMIT = 10;
const FULL_ANSWER_TURNS = 3;

const DEXTER_DIR = '.dexter';
const CONTEXT_DIR = 'context';
const CONTEXT_FILE = 'conversation.json';

/**
 * Represents a single conversation turn (query + answer + summary)
 */
export interface Message {
  id: number;
  query: string;
  answer: string | null;   // null until answer completes
  summary: string | null;  // LLM-generated summary, null until answer arrives
}

/**
 * System prompt for generating message summaries
 */
const MESSAGE_SUMMARY_SYSTEM_PROMPT = `You are a concise summarizer. Generate brief summaries of conversation answers.
Keep summaries to 1-2 sentences that capture the key information.`;

interface ContextFile {
  messages: Message[];
  model: string;
  savedAt: string;
}

/**
 * Manages conversation history for multi-turn conversations.
 * Persists to disk for session resume on restart.
 * Stores user queries, final answers, and LLM-generated summaries.
 */
export class InMemoryChatHistory {
  private messages: Message[] = [];
  private model: string;
  private readonly maxTurns: number;
  private filePath: string;
  private loaded = false;

  constructor(model: string = DEFAULT_MODEL, maxTurns: number = DEFAULT_HISTORY_LIMIT, baseDir: string = process.cwd()) {
    this.model = model;
    this.maxTurns = maxTurns;
    this.filePath = join(baseDir, DEXTER_DIR, CONTEXT_DIR, CONTEXT_FILE);
  }

  /**
   * Loads conversation context from disk.
   * Call this on startup to resume previous session.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (existsSync(this.filePath)) {
        const content = await readFile(this.filePath, 'utf-8');
        const data: ContextFile = JSON.parse(content);
        this.messages = data.messages || [];
        // Restore IDs to ensure consistency
        this.messages.forEach((msg, idx) => {
          msg.id = idx;
        });
      }
    } catch {
      // If there's any error reading/parsing, start fresh
      this.messages = [];
    }

    this.loaded = true;
  }

  /**
   * Saves conversation context to disk.
   * Called automatically after adding messages.
   */
  private async save(): Promise<void> {
    const dir = dirname(this.filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data: ContextFile = {
      messages: this.messages,
      model: this.model,
      savedAt: new Date().toISOString(),
    };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
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
  async saveUserQuery(query: string): Promise<void> {
    this.messages.push({
      id: this.messages.length,
      query,
      answer: null,
      summary: null,
    });

    // Persist to disk
    await this.save();
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
    lastMessage.summary = await this.generateSummary(lastMessage.query, answer);
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
        new HumanMessage(message.query),
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
   * Clears all messages and removes persisted file
   */
  async clear(): Promise<void> {
    this.messages = [];
    await this.save();
  }
}
