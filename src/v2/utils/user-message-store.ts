import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Represents a user message stored in the history
 */
export interface UserMessage {
  message: string;
  timestamp: string;
  sender: 'user';
}

interface UserMessagesFile {
  messages: UserMessage[];
}

const DEXTER_DIR = '.dexter';
const MESSAGES_DIR = 'messages';
const MESSAGES_FILE = 'user_messages.json';

/**
 * Manages persistent storage of user messages for input history navigation.
 * Stores messages in .dexter/messages/user_messages.json
 */
export class UserMessageStore {
  private filePath: string;
  private messages: UserMessage[] = [];
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
        const data: UserMessagesFile = JSON.parse(content);
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

    const data: UserMessagesFile = { messages: this.messages };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Appends a new message to the history and saves to disk.
   */
  async append(message: string): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }

    const userMessage: UserMessage = {
      message,
      timestamp: new Date().toISOString(),
      sender: 'user',
    };

    this.messages.push(userMessage);
    await this.save();
  }

  /**
   * Returns all messages in chronological order (oldest to newest).
   */
  getMessages(): UserMessage[] {
    return [...this.messages];
  }

  /**
   * Returns just the message strings in chronological order.
   */
  getMessageStrings(): string[] {
    return this.messages.map(m => m.message);
  }
}
