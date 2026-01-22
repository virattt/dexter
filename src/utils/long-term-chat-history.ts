import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Represents a conversation entry (user message + agent response pair)
 * Uses stack ordering: most recent at index 0
 */
export interface ConversationEntry {
  id: string;
  timestamp: string;
  userMessage: string;
  agentResponse: string | null;
}

interface MessagesFile {
  messages: ConversationEntry[];
}

const DEXTER_DIR = '.dexter';
const MESSAGES_DIR = 'messages';
const MESSAGES_FILE = 'chat_history.json';

/**
 * Manages persistent storage of conversation history for input history navigation.
 * Uses stack ordering (most recent first) for O(1) access to latest entries.
 * Stores messages in .dexter/messages/chat_history.json
 */
export class LongTermChatHistory {
  private filePath: string;
  private messages: ConversationEntry[] = [];
  private loaded = false;

  constructor(baseDir: string = process.cwd()) {
    this.filePath = join(baseDir, DEXTER_DIR, MESSAGES_DIR, MESSAGES_FILE);
  }

  /**
   * Loads messages from the JSON file.
   * Creates the file and directories if they don't exist.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (existsSync(this.filePath)) {
        const content = await readFile(this.filePath, 'utf-8');
        const data: MessagesFile = JSON.parse(content);
        this.messages = data.messages || [];
      } else {
        // File doesn't exist, initialize with empty messages
        this.messages = [];
        await this.save();
      }
    } catch {
      // If there's any error reading/parsing, start fresh
      this.messages = [];
    }

    this.loaded = true;
  }

  /**
   * Saves the current messages to the JSON file.
   * Creates directories if they don't exist.
   */
  private async save(): Promise<void> {
    const dir = dirname(this.filePath);
    
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data: MessagesFile = { messages: this.messages };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Adds a new user message to the history (prepends to stack).
   * Agent response is null until updateAgentResponse is called.
   */
  async addUserMessage(message: string): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    const entry: ConversationEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      userMessage: message,
      agentResponse: null,
    };

    // Prepend to stack (most recent first)
    this.messages.unshift(entry);
    await this.save();
  }

  /**
   * Updates the agent response for the most recent conversation entry.
   * O(1) lookup since most recent is at index 0.
   */
  async updateAgentResponse(response: string): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    if (this.messages.length > 0) {
      this.messages[0].agentResponse = response;
      await this.save();
    }
  }

  /**
   * Returns all conversation entries in stack order (newest first).
   */
  getMessages(): ConversationEntry[] {
    return [...this.messages];
  }

  /**
   * Returns user message strings in stack order (newest first).
   * Deduplicates consecutive duplicates only (like shell HISTCONTROL=ignoredups).
   * Used for input history navigation.
   */
  getMessageStrings(): string[] {
    const result: string[] = [];

    for (const m of this.messages) {
      const lastMessage = result[result.length - 1];
      if (lastMessage !== m.userMessage) {
        result.push(m.userMessage);
      }
    }

    return result;
  }
}
